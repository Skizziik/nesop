"""Рендер проекта-таймлайна (композиция Timeline) в mp4 + обложка."""
from __future__ import annotations

import asyncio
import json
from typing import Any

from ..config import get_settings
from ..db import SessionLocal, utcnow
from ..events import publish
from ..models import Project
from . import clients


async def _set(pid: str, **fields: Any) -> None:
    async with SessionLocal() as s:
        p = await s.get(Project, pid)
        if p is None:
            return
        for k, v in fields.items():
            setattr(p, k, v)
        await s.commit()
    await publish({"type": "project", "project_id": pid, **{k: v for k, v in fields.items() if k in ("status", "stage", "progress", "error")}})


async def render_project(pid: str) -> None:
    st = get_settings()
    async with SessionLocal() as s:
        p = await s.get(Project, pid)
        if p is None:
            return
        doc, rev, meta = dict(p.doc), p.revision, dict(p.meta or {})
    rel = f"/projects/{pid}/r{rev}-{utcnow().strftime('%H%M%S')}"
    (st.data_dir / rel.lstrip("/")).mkdir(parents=True, exist_ok=True)

    async def on_progress(x: float) -> None:
        await _set(pid, progress=round(x, 3), stage=f"рендер {int(x * 100)}%")

    try:
        await _set(pid, status="rendering", stage="рендер 0%", progress=0.0, error=None)
        # ~1 сек реального времени рендера на 1 сек видео на CPU с запасом ×6
        cartoon = "scenes" in doc  # мультик: CartoonDoc (композиция Cartoon), иначе таймлайн
        timeout = int(max(900, float(doc.get("duration_s") or doc.get("duration") or 60) * 6))
        await clients.render(doc, rel, on_progress, composition="Cartoon" if cartoon else "Timeline", timeout_s=timeout)
        (st.data_dir / rel.lstrip("/") / "meta.json").write_text(json.dumps(meta.get("youtube", {"title": doc.get("title")}), ensure_ascii=False, indent=2), encoding="utf-8")
        await _set(pid, status="ready", stage="готово", progress=1.0, out_dir=rel)
    except asyncio.CancelledError:  # таймаут задачи arq: проект не должен навсегда остаться «в рендере»
        await asyncio.shield(_set(pid, status="failed", stage="ошибка рендера", error="Рендер прерван (таймаут задачи)"))
        raise
    except Exception as e:  # noqa: BLE001 — ошибка видна в проекте
        await _set(pid, status="failed", stage="ошибка рендера", error=(str(e) or type(e).__name__)[:2000])
