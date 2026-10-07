"""Trace этапов (таблица job_events) + публикация прогресса в Redis pub/sub (→ SSE в дашборд)."""
from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import update

from .config import get_settings
from .db import SessionLocal
from .models import JobEvent, Video

CHANNEL = "farm:events"
log = logging.getLogger("farm.events")
_redis: Redis | None = None


def redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


async def publish(payload: dict[str, Any]) -> None:
    try:
        await redis().publish(CHANNEL, json.dumps(payload, ensure_ascii=False, default=str))
    except Exception:  # noqa: BLE001 — прогресс не должен ронять пайплайн
        log.warning("publish failed", exc_info=True)


async def record(stage: str, status: str, message: str = "", *, video_id: str | None = None, batch_id: str | None = None,
                 data: dict[str, Any] | None = None, duration_ms: int | None = None) -> None:
    async with SessionLocal() as s:
        s.add(JobEvent(video_id=video_id, batch_id=batch_id, stage=stage, status=status, message=message, data=data or {}, duration_ms=duration_ms))
        await s.commit()
    log.info("%s %s %s", stage, status, message, extra={"video_id": video_id, "batch_id": batch_id, "stage": stage, "status": status})
    await publish({"type": "event", "stage": stage, "status": status, "message": message, "video_id": video_id, "batch_id": batch_id})


async def set_video(video_id: str, **fields: Any) -> None:
    async with SessionLocal() as s:
        await s.execute(update(Video).where(Video.id == video_id).values(**fields))
        await s.commit()
    public = {k: (v.value if hasattr(v, "value") else v) for k, v in fields.items() if k in ("status", "stage", "progress", "error")}
    await publish({"type": "video", "video_id": video_id, **public})


@asynccontextmanager
async def stage(name: str, video_id: str, batch_id: str | None, progress: float) -> AsyncIterator[dict[str, Any]]:
    """Этап пайплайна: старт → ok/error в trace, с длительностью. В yield-словарь можно положить data для trace."""
    await set_video(video_id, stage=name, progress=progress)
    await record(name, "start", video_id=video_id, batch_id=batch_id)
    t0 = time.monotonic()
    extra: dict[str, Any] = {}
    try:
        yield extra
    except Exception as e:
        await record(name, "error", str(e)[:2000], video_id=video_id, batch_id=batch_id, duration_ms=int((time.monotonic() - t0) * 1000))
        raise
    await record(name, "ok", extra.pop("message", ""), video_id=video_id, batch_id=batch_id, data=extra, duration_ms=int((time.monotonic() - t0) * 1000))
