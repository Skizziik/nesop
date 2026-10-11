"""Каталог ассетов мультиков для дашборда: записи каталога, сколько раз ассет встречался в эпизодах, превью каждого ассета."""
from __future__ import annotations

import asyncio
import hashlib
from collections import Counter
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..models import Project
from ..pipeline.cartoon import CATALOG
from ..pipeline.clients import ServiceError, still

router = APIRouter(prefix="/api/cartoon")
Session = Annotated[AsyncSession, Depends(get_session)]
Kind = Literal["locations", "props", "outfits", "fx", "actions", "characters"]

# версия каталога: превью перерисовываются, когда меняется каталог
VERSION = hashlib.sha1(repr(sorted(CATALOG.items(), key=lambda kv: kv[0])).encode()).hexdigest()[:10]
_render_slots = asyncio.Semaphore(2)  # не больше двух кадров одновременно — рендерер делит CPU с видео


def usage_of(doc: dict[str, Any]) -> dict[str, Counter[str]]:
    """Что встречается в одном эпизоде (CartoonDoc): локации, предметы, костюмы, эффекты, действия, герои."""
    u: dict[str, Counter[str]] = {k: Counter() for k in ("locations", "props", "outfits", "fx", "actions", "characters")}
    for sc in doc.get("scenes") or []:
        u["locations"][sc.get("location") or "garden"] += 1
        for pr in sc.get("props") or []:
            u["props"][pr.get("id") or pr.get("prop") or ""] += 1
        for a in sc.get("actors") or []:
            u["characters"][a.get("id") or ""] += 1
            for w in a.get("wear") or []:
                u["outfits"][w] += 1
            for k in a.get("keys") or []:
                if k.get("action"):
                    u["actions"][k["action"]] += 1
                if k.get("fx"):
                    u["fx"][k["fx"]] += 1
                if (k.get("hold") or {}).get("id"):
                    u["props"][k["hold"]["id"]] += 1
    for c in u.values():
        c.pop("", None)
    return u


@router.get("/catalog")
async def get_catalog(s: Session) -> dict[str, Any]:
    rows = (await s.execute(select(Project).where(Project.kind == "cartoon"))).scalars().all()
    total: dict[str, Counter[str]] = {k: Counter() for k in ("locations", "props", "outfits", "fx", "actions", "characters")}
    episodes: dict[str, dict[str, int]] = {k: {} for k in total}
    for p in rows:
        for kind, c in usage_of(p.doc or {}).items():
            total[kind].update(c)
            for aid in c:
                episodes[kind][aid] = episodes[kind].get(aid, 0) + 1
    return {
        "version": VERSION,
        "catalog": CATALOG,
        "episodes_total": len(rows),
        "usage": {k: dict(v) for k, v in total.items()},
        "episodes": episodes,
    }


@router.get("/catalog/preview/{kind}/{aid}.png")
async def preview(kind: Kind, aid: str) -> FileResponse:
    known = {
        "locations": [x["id"] for x in CATALOG["locations"]],
        "props": [x["id"] for x in CATALOG["props"]],
        "outfits": ["none", *[x["id"] for x in CATALOG["outfits"]]],
        "fx": [x["id"] for x in CATALOG["fx"]],
        "actions": [x["id"] for x in CATALOG["actions"]],
        "characters": [x["id"] for x in CATALOG["characters"]],
    }[kind]
    if aid not in known:
        raise HTTPException(404, "нет такого ассета в каталоге")
    rel = f"cache/catalog/{VERSION}/{kind}_{aid}.png"
    path = get_settings().data_dir / rel
    if not path.exists():
        async with _render_slots:
            if not path.exists():
                try:
                    await still({"kind": kind, "only": aid}, rel, composition="AssetSheet", frame=30)
                except ServiceError as e:
                    raise HTTPException(502, str(e)) from e
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
