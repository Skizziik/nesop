"""Календарь публикаций (каркас этапа 7) и экспорт/импорт базы."""
from __future__ import annotations

import json
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..models import Asset, HookPattern, Lesson, Publication, Series, Setting, Video, VideoStatus, VoiceProfile
from ..serializers import video_out

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]


def _day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time.min, tzinfo=UTC)
    return start, start + timedelta(days=1)


@router.get("/calendar")
async def calendar(s: Session, start: date, days: int = 14) -> dict[str, Any]:
    lo = datetime.combine(start, time.min, tzinfo=UTC)
    hi = lo + timedelta(days=days)
    pubs = (await s.execute(select(Publication, Video).join(Video, Video.id == Publication.video_id)
                            .where(Publication.planned_at >= lo, Publication.planned_at < hi).order_by(Publication.planned_at))).all()
    planned_ids = set((await s.scalars(select(Publication.video_id))).all())
    unplanned = (await s.scalars(select(Video).where(Video.status == VideoStatus.ready).order_by(Video.created_at.desc()).limit(200))).all()
    return {
        "limit_per_day": get_settings().max_publish_per_day,
        "upload_enabled": get_settings().youtube_upload_enabled,
        "items": [{"id": p.id, "date": p.planned_at.date().isoformat() if p.planned_at else None, "status": p.status, "video": video_out(v)} for p, v in pubs],
        "unplanned": [video_out(v) for v in unplanned if v.id not in planned_ids],
    }


class PlanIn(BaseModel):
    video_id: str
    date: date


@router.post("/calendar", status_code=201)
async def plan(body: PlanIn, s: Session) -> dict[str, Any]:
    v = await s.get(Video, body.video_id)
    if v is None or v.status not in (VideoStatus.ready, VideoStatus.scheduled):
        raise HTTPException(400, "Планировать можно только готовые ролики")
    lo, hi = _day_bounds(body.date)
    n = (await s.execute(select(func.count()).select_from(Publication).where(Publication.planned_at >= lo, Publication.planned_at < hi))).scalar_one()
    limit = get_settings().max_publish_per_day
    if n >= limit:
        raise HTTPException(409, f"На {body.date.strftime('%d.%m')} уже {n} роликов — лимит {limit} в день (политика YouTube против массового контента)")
    pub = (await s.scalars(select(Publication).where(Publication.video_id == v.id))).first()
    slot = lo + timedelta(hours=12 + 3 * n)  # разносим по дню: 12:00, 15:00, 18:00
    if pub is None:
        pub = Publication(video_id=v.id, platform="youtube", status="planned", planned_at=slot)
        s.add(pub)
    else:
        pub.planned_at, pub.status = slot, "planned"
    v.status = VideoStatus.scheduled
    await s.commit()
    return {"id": pub.id, "date": body.date.isoformat()}


@router.delete("/calendar/{pid}")
async def unplan(pid: str, s: Session) -> dict[str, bool]:
    pub = await s.get(Publication, pid)
    if pub is None:
        raise HTTPException(404, "Нет такой записи")
    v = await s.get(Video, pub.video_id)
    if v is not None and v.status == VideoStatus.scheduled:
        v.status = VideoStatus.ready
    await s.delete(pub)
    await s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ экспорт / импорт
EXPORT = [("series", Series), ("lessons", Lesson), ("hook_patterns", HookPattern), ("voice_profiles", VoiceProfile), ("settings", Setting), ("assets", Asset)]


def _row(obj: Any) -> dict[str, Any]:
    out = {}
    for c in obj.__table__.columns:
        v = getattr(obj, c.key)
        out[c.key] = v.isoformat() if isinstance(v, datetime) else (v.value if hasattr(v, "value") else v)
    return out


@router.get("/export")
async def export_db(s: Session) -> Response:
    """Вся «настройка фермы»: серии, банк уроков, хуки, голоса, настройки, ассеты (метаданные). Ролики и медиа — в volume /data."""
    data: dict[str, Any] = {"version": 1, "exported_at": datetime.now(UTC).isoformat()}
    for name, model in EXPORT:
        data[name] = [_row(o) for o in (await s.scalars(select(model))).all()]
    body = json.dumps(data, ensure_ascii=False, indent=1)
    return Response(body, media_type="application/json", headers={"Content-Disposition": 'attachment; filename="sipofitalian-export.json"'})


@router.post("/import")
async def import_db(s: Session, file: Annotated[UploadFile, File()]) -> dict[str, Any]:
    """Импорт: добавляет недостающие записи по id (существующие не перезаписываются)."""
    try:
        data = json.loads(await file.read())
    except json.JSONDecodeError as e:
        raise HTTPException(400, "Файл не JSON") from e
    stats: dict[str, int] = {}
    for name, model in EXPORT:
        added = 0
        pk = "key" if model is Setting else "id"
        for row in data.get(name, []):
            if await s.get(model, row.get(pk)) is not None:
                continue
            cols = {c.key: c for c in model.__table__.columns}
            vals = {}
            for k, v in row.items():
                if k not in cols:
                    continue
                if isinstance(v, str) and "DateTime" in type(cols[k].type).__name__:
                    v = datetime.fromisoformat(v)
                vals[k] = v
            s.add(model(**vals))
            added += 1
        await s.flush()
        stats[name] = added
    await s.commit()
    return {"ok": True, "added": stats}
