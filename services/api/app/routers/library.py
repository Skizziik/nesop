"""Этап 4: библиотека хуков/призывов и ассеты (музыка, наклейки, палитры) с лицензией и источником."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..formats import FORMATS
from ..llm.generate import generate_hooks
from ..llm.providers import LLMError
from ..models import Asset, HookPattern, Video

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]


def hook_out(h: HookPattern, used_in_videos: int = 0) -> dict[str, Any]:
    return {"id": h.id, "kind": h.kind, "text": h.text, "spoken": h.spoken, "type": h.type, "formats": h.formats, "answer_mode": h.answer_mode,
            "use_count": h.use_count, "used_in_videos": used_in_videos, "last_used_at": h.last_used_at.isoformat() if h.last_used_at else None,
            "enabled": h.enabled, "source": h.source, "metrics": h.metrics}


@router.get("/hooks")
async def list_hooks(s: Session, kind: Literal["hook", "cta"] | None = None) -> list[dict[str, Any]]:
    q = select(HookPattern).order_by(HookPattern.kind, HookPattern.use_count.desc(), HookPattern.text)
    if kind:
        q = q.where(HookPattern.kind == kind)
    rows = (await s.scalars(q)).all()
    hooks_used = dict((await s.execute(select(Video.hook_pattern_id, func.count()).group_by(Video.hook_pattern_id))).all())
    ctas_used = dict((await s.execute(select(Video.cta_pattern_id, func.count()).group_by(Video.cta_pattern_id))).all())
    return [hook_out(h, (hooks_used if h.kind == "hook" else ctas_used).get(h.id, 0)) for h in rows]


class HookIn(BaseModel):
    kind: Literal["hook", "cta"] = "hook"
    text: str = Field(min_length=2, max_length=60)
    spoken: str = Field(default="", max_length=160)
    type: Literal["hidden_answer", "abc", "level", "challenge", "native_language", "debate", "streak"] = "hidden_answer"
    formats: list[str] = []
    answer_mode: Literal["hide", "reveal", "answer_tomorrow"] | None = None
    enabled: bool = True


def _check_formats(fs: list[str]) -> None:
    bad = [f for f in fs if f not in FORMATS]
    if bad:
        raise HTTPException(400, f"Неизвестные форматы: {', '.join(bad)}")


@router.post("/hooks", status_code=201)
async def create_hook(body: HookIn, s: Session) -> dict[str, Any]:
    _check_formats(body.formats)
    if (await s.scalars(select(HookPattern).where(HookPattern.kind == body.kind, HookPattern.text == body.text))).first():
        raise HTTPException(409, "Такой текст уже есть в библиотеке")
    h = HookPattern(**body.model_dump(), source="manual")
    s.add(h)
    await s.commit()
    return hook_out(h)


@router.patch("/hooks/{hid}")
async def patch_hook(hid: str, body: dict[str, Any], s: Session) -> dict[str, Any]:
    h = await s.get(HookPattern, hid)
    if h is None:
        raise HTTPException(404, "Хук не найден")
    data = HookIn.model_validate({**hook_out(h), **body}).model_dump()
    _check_formats(data["formats"])
    for k in body:
        if k in data:
            setattr(h, k, data[k])
    if h.source == "seed":
        h.source = "edited"  # правки владельца сид больше не перезаписывает
    await s.commit()
    return hook_out(h)


@router.delete("/hooks/{hid}")
async def delete_hook(hid: str, s: Session) -> dict[str, bool]:
    h = await s.get(HookPattern, hid)
    if h is None:
        raise HTTPException(404, "Хук не найден")
    await s.delete(h)
    await s.commit()
    return {"ok": True}


class GenHooksIn(BaseModel):
    count: int = Field(default=10, ge=1, le=30)
    formats: list[str] = ["list_mystery", "false_friends", "emoji_vocab"]


@router.post("/hooks/generate")
async def gen_hooks(body: GenHooksIn, s: Session) -> dict[str, Any]:
    _check_formats(body.formats)
    try:
        new = await generate_hooks(s, body.count)
    except LLMError as e:
        raise HTTPException(400, str(e)) from e
    have = set((await s.scalars(select(HookPattern.text).where(HookPattern.kind == "hook"))).all())
    added = []
    for h in new:
        text = str(h.get("text", "")).strip()[:60]
        if not text or text in have:
            continue
        hp = HookPattern(kind="hook", text=text, spoken=str(h.get("spoken", ""))[:160], formats=body.formats, source="llm")
        s.add(hp)
        added.append(hp)
        have.add(text)
    await s.commit()
    return {"added": [hook_out(h) for h in added]}


# ------------------------------------------------------------------ ассеты
KINDS = ("music", "sticker", "avatar", "mascot", "sfx", "font", "palette", "background")
ALLOWED = {"music": {".mp3", ".wav", ".ogg", ".m4a"}, "sticker": {".png", ".webp", ".svg"}, "avatar": {".mp4", ".webm", ".mov", ".png"},
           "mascot": {".png", ".svg", ".webp"}, "sfx": {".wav", ".mp3"}, "background": {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov"}}


def asset_out(a: Asset) -> dict[str, Any]:
    return {"id": a.id, "kind": a.kind, "name": a.name, "url": f"/media{a.path}" if a.path else None, "license": a.license, "source": a.source,
            "attribution": a.attribution, "data": a.data, "enabled": a.enabled}


@router.get("/assets")
async def list_assets(s: Session, kind: str | None = None) -> list[dict[str, Any]]:
    q = select(Asset).order_by(Asset.kind, Asset.name)
    if kind:
        q = q.where(Asset.kind == kind)
    return [asset_out(a) for a in (await s.scalars(q)).all()]


@router.post("/assets", status_code=201)
async def upload_asset(
    s: Session,
    file: Annotated[UploadFile, File()],
    kind: Annotated[str, Form()],
    license: Annotated[str, Form(min_length=1, max_length=120)],
    source: Annotated[str, Form(max_length=300)] = "",
    attribution: Annotated[str, Form(max_length=300)] = "",
    name: Annotated[str, Form(max_length=120)] = "",
) -> dict[str, Any]:
    """Загрузка с обязательной лицензией: без неё ассет нельзя использовать в монетизируемых роликах."""
    if kind not in ALLOWED:
        raise HTTPException(400, f"Тип ассета должен быть одним из: {', '.join(ALLOWED)}")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED[kind]:
        raise HTTPException(400, f"Для «{kind}» подходят файлы: {', '.join(sorted(ALLOWED[kind]))}")
    data = await file.read()
    if len(data) > 200 * 1024 * 1024:
        raise HTTPException(400, "Файл больше 200 MB")
    a = Asset(kind=kind, name=name or Path(file.filename or "asset").stem, license=license, source=source, attribution=attribution)
    s.add(a)
    await s.flush()
    safe = re.sub(r"[^a-z0-9_-]+", "-", a.name.lower()).strip("-")[:40] or "asset"
    rel = f"/assets/{kind}/{a.id[:8]}-{safe}{ext}"
    dest = get_settings().data_dir / rel.lstrip("/")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    a.path = rel
    if kind == "avatar" and ext in (".mp4", ".mov"):
        a.path = await _chroma_to_webm(rel)  # зелёный фон → прозрачный webm
        a.data = {**(a.data or {}), "original": rel, "chromakey": True}
    await s.commit()
    return asset_out(a)


async def _chroma_to_webm(rel: str) -> str:
    import httpx

    out = rel.rsplit(".", 1)[0] + ".webm"
    try:
        async with httpx.AsyncClient(timeout=600) as c:
            r = await c.post(f"{get_settings().renderer_url}/avatar/convert", json={"src": rel, "out": out})
    except httpx.HTTPError as e:
        raise HTTPException(503, "Рендер-сервис недоступен для обработки видео ведущей") from e
    if r.status_code >= 400:
        raise HTTPException(400, f"Не удалось вырезать зелёный фон: {r.text[:300]}")
    return out


class AssetPatch(BaseModel):
    name: str | None = None
    license: str | None = None
    source: str | None = None
    attribution: str | None = None
    enabled: bool | None = None


@router.patch("/assets/{aid}")
async def patch_asset(aid: str, body: AssetPatch, s: Session) -> dict[str, Any]:
    a = await s.get(Asset, aid)
    if a is None:
        raise HTTPException(404, "Ассет не найден")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await s.commit()
    return asset_out(a)


@router.delete("/assets/{aid}")
async def delete_asset(aid: str, s: Session) -> dict[str, bool]:
    a = await s.get(Asset, aid)
    if a is None:
        raise HTTPException(404, "Ассет не найден")
    if a.kind in ("palette", "sfx") and a.source.startswith(("content/", "app/")):
        raise HTTPException(400, "Встроенный ассет нельзя удалить — его можно выключить")
    if a.path:
        (get_settings().data_dir / a.path.lstrip("/")).unlink(missing_ok=True)
    await s.delete(a)
    await s.commit()
    return {"ok": True}
