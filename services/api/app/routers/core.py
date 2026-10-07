"""Главная, пачки, библиотека, серии (чтение), события SSE."""
from __future__ import annotations

import asyncio
import io
import zipfile
from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session, utcnow
from ..events import CHANNEL, redis
from ..formats import FORMATS
from ..models import Batch, JobEvent, Lesson, LlmCall, Series, Video, VideoStatus
from ..pipeline.clients import probe
from ..serializers import batch_out, event_out, lesson_out, series_out, video_out
from ..worker import enqueue

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/health")
async def health(s: Session) -> dict[str, Any]:
    st = get_settings()
    services: dict[str, Any] = {}
    try:
        await s.execute(select(1))
        services["postgres"] = {"ok": True}
    except Exception as e:  # noqa: BLE001
        services["postgres"] = {"ok": False, "error": type(e).__name__}
    try:
        services["redis"] = {"ok": bool(await redis().ping())}
    except Exception as e:  # noqa: BLE001
        services["redis"] = {"ok": False, "error": type(e).__name__}
    tts, rend = await asyncio.gather(probe(f"{st.tts_url}/health"), probe(f"{st.renderer_url}/health"))
    services["tts"], services["renderer"] = tts, rend
    try:
        workers = await redis().keys("arq:*health-check*")  # arq обновляет этот ключ, пока воркер жив
        services["worker"] = {"ok": bool(workers)}
    except Exception as e:  # noqa: BLE001
        services["worker"] = {"ok": False, "error": type(e).__name__}
    services["api"] = {"ok": True}
    return {"ok": all(v.get("ok") for v in services.values()), "services": services}


@router.get("/stats")
async def stats(s: Session) -> dict[str, Any]:
    by_status = dict((await s.execute(select(Video.status, func.count()).group_by(Video.status))).all())
    now = utcnow()
    day = now - timedelta(days=1)
    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async def cost(since: Any) -> dict[str, float]:
        row = (await s.execute(select(func.coalesce(func.sum(LlmCall.cost_usd), 0), func.count()).where(LlmCall.created_at >= since))).one()
        return {"usd": round(float(row[0]), 4), "calls": int(row[1])}

    return {
        "videos": {k.value: v for k, v in by_status.items()},
        "llm": {"day": await cost(day), "month": await cost(month)},
        "lessons": int((await s.execute(select(func.count()).select_from(Lesson))).scalar_one()),
    }


# ------------------------------------------------------------------ серии
@router.get("/series")
async def list_series(s: Session) -> list[dict[str, Any]]:
    rows = (await s.scalars(select(Series).where(Series.archived.is_(False)).order_by(Series.created_at))).all()
    lessons = dict((await s.execute(select(Lesson.series_id, func.count()).group_by(Lesson.series_id))).all())
    ready = dict((await s.execute(select(Video.series_id, func.count()).where(Video.status == VideoStatus.ready).group_by(Video.series_id))).all())
    return [series_out(x, {"lessons": lessons.get(x.id, 0), "ready": ready.get(x.id, 0)}) | {"implemented": x.format in FORMATS} for x in rows]


@router.get("/series/{sid}/lessons")
async def series_lessons(sid: str, s: Session) -> list[dict[str, Any]]:
    return [lesson_out(x) for x in (await s.scalars(select(Lesson).where(Lesson.series_id == sid).order_by(Lesson.slug))).all()]


# ------------------------------------------------------------------ пачки
class BatchIn(BaseModel):
    series_id: str | None = Field(default=None, description="null = микс серий")
    count: int = Field(ge=1, le=50)
    auto_approve: bool = True


@router.post("/batches", status_code=202)
async def create_batch(body: BatchIn, s: Session) -> dict[str, Any]:
    if body.series_id:
        ser = await s.get(Series, body.series_id)
        if ser is None:
            raise HTTPException(404, "Серия не найдена")
        if ser.format not in FORMATS:
            raise HTTPException(400, f"Формат «{ser.format}» этой серии ещё не реализован")
    b = Batch(series_id=body.series_id, requested=body.count, auto_approve=body.auto_approve)
    s.add(b)
    await s.commit()
    await enqueue("run_batch", b.id)
    return batch_out(b)


async def _batch_counts(s: AsyncSession, ids: list[str]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {i: {} for i in ids}
    if not ids:
        return out
    for bid, status, n in (await s.execute(select(Video.batch_id, Video.status, func.count()).where(Video.batch_id.in_(ids)).group_by(Video.batch_id, Video.status))).all():
        if bid:
            out[bid][status.value] = n
    return out


@router.get("/batches")
async def list_batches(s: Session, limit: int = 20) -> list[dict[str, Any]]:
    rows = list((await s.scalars(select(Batch).order_by(Batch.created_at.desc()).limit(limit))).all())
    counts = await _batch_counts(s, [b.id for b in rows])
    return [batch_out(b, counts[b.id]) for b in rows]


@router.get("/batches/{bid}")
async def get_batch(bid: str, s: Session) -> dict[str, Any]:
    b = await s.get(Batch, bid)
    if b is None:
        raise HTTPException(404, "Пачка не найдена")
    vids = (await s.scalars(select(Video).where(Video.batch_id == bid).order_by(Video.created_at))).all()
    counts = await _batch_counts(s, [bid])
    return batch_out(b, counts[bid]) | {"videos": [video_out(v) for v in vids]}


@router.get("/batches/{bid}/zip")
async def batch_zip(bid: str, s: Session) -> StreamingResponse:
    st = get_settings()
    vids = (await s.scalars(select(Video).where(Video.batch_id == bid, Video.status == VideoStatus.ready))).all()
    if not vids:
        raise HTTPException(404, "В пачке нет готовых роликов")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for i, v in enumerate(vids, 1):
            base = st.data_dir / (v.out_dir or "").lstrip("/")
            name = f"{i:02d}_{(v.title or v.id)[:40]}".replace("/", "-").replace(":", "")
            for f in ("video.mp4", "cover.png", "meta.json"):
                if (base / f).exists():
                    z.write(base / f, f"{name}/{f}")
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="batch_{bid[:8]}.zip"'})


# ------------------------------------------------------------------ ролики
@router.get("/videos")
async def list_videos(
    s: Session,
    status: Annotated[list[str] | None, Query()] = None,
    series_id: str | None = None,
    batch_id: str | None = None,
    limit: int = 60,
    offset: int = 0,
) -> dict[str, Any]:
    q = select(Video)
    if status:
        q = q.where(Video.status.in_([VideoStatus(x) for x in status]))
    if series_id:
        q = q.where(Video.series_id == series_id)
    if batch_id:
        q = q.where(Video.batch_id == batch_id)
    total = (await s.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await s.scalars(q.order_by(Video.created_at.desc()).limit(limit).offset(offset))).all()
    return {"total": total, "items": [video_out(v) for v in rows]}


@router.get("/videos/{vid}")
async def get_video(vid: str, s: Session) -> dict[str, Any]:
    v = await s.get(Video, vid)
    if v is None:
        raise HTTPException(404, "Ролик не найден")
    evs = (await s.scalars(select(JobEvent).where(JobEvent.video_id == vid).order_by(JobEvent.created_at))).all()
    return video_out(v, full=True) | {"events": [event_out(e) for e in evs]}


class VideoPatch(BaseModel):
    published_manually: bool | None = None
    published_url: str | None = None
    answer_comment_status: str | None = None


@router.patch("/videos/{vid}")
async def patch_video(vid: str, body: VideoPatch, s: Session) -> dict[str, Any]:
    v = await s.get(Video, vid)
    if v is None:
        raise HTTPException(404, "Ролик не найден")
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    if body.published_manually:
        v.status = VideoStatus.published
    elif body.published_manually is False and v.status == VideoStatus.published:
        v.status = VideoStatus.ready
    await s.commit()
    return video_out(v)


@router.post("/videos/{vid}/render", status_code=202)
async def rerender(vid: str, s: Session) -> dict[str, Any]:
    v = await s.get(Video, vid)
    if v is None:
        raise HTTPException(404, "Ролик не найден")
    if v.status in (VideoStatus.rendering,):
        raise HTTPException(409, "Ролик уже рендерится")
    v.status, v.error, v.progress = VideoStatus.approved, None, 0.0
    await s.commit()
    await enqueue("run_video", v.id)
    return video_out(v)


@router.delete("/videos/{vid}")
async def delete_video(vid: str, s: Session) -> dict[str, bool]:
    v = await s.get(Video, vid)
    if v is None:
        raise HTTPException(404, "Ролик не найден")
    await s.delete(v)
    await s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ SSE
@router.get("/events")
async def events(request: Request) -> StreamingResponse:
    async def gen() -> AsyncIterator[str]:
        pubsub = redis().pubsub()
        await pubsub.subscribe(CHANNEL)
        try:
            yield "retry: 3000\n\n"
            while not await request.is_disconnected():
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15)
                if msg is None:
                    yield ": ping\n\n"
                    continue
                yield f"data: {msg['data']}\n\n"
        finally:
            await pubsub.unsubscribe(CHANNEL)
            await pubsub.aclose()  # type: ignore[no-untyped-call]

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/meta/formats")
async def formats() -> dict[str, Any]:
    return {"implemented": list(FORMATS)}

