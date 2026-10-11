"""arq-воркер: `arq app.worker.WorkerSettings`."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from sqlalchemy import select, text, update

from .config import get_settings
from .db import SessionLocal
from .logging_setup import setup
from .models import Project, Video, VideoStatus
from .pipeline.cartoon import build_cartoon
from .pipeline.ideas import fill_bank, run_ideas
from .pipeline.lecture import build_lecture
from .pipeline.produce import plan_batch, produce_video
from .pipeline.project_render import render_project


async def run_batch(ctx: dict[str, Any], batch_id: str) -> int:
    approved = await plan_batch(batch_id)
    redis: ArqRedis = ctx["redis"]
    for vid in approved:
        await redis.enqueue_job("run_video", vid)
    return len(approved)


async def run_video(ctx: dict[str, Any], video_id: str) -> None:
    await produce_video(video_id)


async def run_llm_ideas(ctx: dict[str, Any], batch_id: str, topic: str = "", like_video_id: str | None = None) -> int:
    approved = await run_ideas(batch_id, topic, like_video_id)
    redis: ArqRedis = ctx["redis"]
    for vid in approved:
        await redis.enqueue_job("run_video", vid)
    return len(approved)


async def run_fill_bank(ctx: dict[str, Any], series_id: str, count: int) -> dict[str, int]:
    return await fill_bank(series_id, count)


async def run_cartoon(ctx: dict[str, Any], project_id: str) -> None:
    await build_cartoon(project_id)


async def run_compilation(ctx: dict[str, Any], project_id: str) -> None:
    """Сборник мультиков: doc уже склеен — делаем YouTube-пакет (обложки, описание с главами) и, если просили, рендер."""
    from .pipeline.youtube import build_youtube_cartoon

    try:
        await build_youtube_cartoon(project_id)
    except Exception as e:  # noqa: BLE001 — пакет YouTube не должен ронять сборник
        log.warning("compilation youtube pack failed: %s", e)
    async with SessionLocal() as s:
        p = await s.get(Project, project_id)
        if p is None:
            return
        p.status, p.stage, p.progress = "draft", "готово к просмотру", 1.0
        auto = bool((p.params or {}).get("auto_render"))
        await s.commit()
    if auto:
        await ctx["redis"].enqueue_job("run_project_render", project_id)


async def run_lecture(ctx: dict[str, Any], project_id: str) -> None:
    await build_lecture(project_id)


async def run_project_render(ctx: dict[str, Any], project_id: str) -> None:
    await render_project(project_id)


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(get_settings().redis_url)


async def enqueue(fn: str, *args: Any) -> None:
    pool = await create_pool(redis_settings())
    try:
        await pool.enqueue_job(fn, *args)
    finally:
        await pool.aclose()


log = logging.getLogger("farm.worker")


async def wait_for_db(timeout_s: int = 180) -> None:
    """После перезапуска Docker Desktop все контейнеры стартуют одновременно: ждём, пока Postgres начнёт принимать запросы."""
    for _ in range(timeout_s // 2):
        try:
            async with SessionLocal() as s:
                await s.execute(text("SELECT 1"))
            return
        except Exception:  # noqa: BLE001 — «database is starting up» и обрыв соединения одинаково ждём
            await asyncio.sleep(2)
    raise RuntimeError("Postgres не поднялся за 3 минуты")


async def recover_stuck(redis: ArqRedis) -> int:
    """Ролики, застрявшие в approved/rendering (воркер умер посреди задачи), возвращаем в очередь, если их там нет."""
    queued = {str(j.args[0]) for j in await redis.queued_jobs() if j.function == "run_video" and j.args}
    async with SessionLocal() as s:
        ids = [v for v in (await s.scalars(select(Video.id).where(Video.status.in_([VideoStatus.approved, VideoStatus.rendering])))).all() if v not in queued]
        if ids:
            await s.execute(update(Video).where(Video.id.in_(ids)).values(status=VideoStatus.approved, progress=0.0, stage=""))
            await s.commit()
    for vid in ids:
        await redis.enqueue_job("run_video", vid)
    return len(ids)


async def startup(ctx: dict[str, Any]) -> None:
    setup("worker")
    await wait_for_db()
    n = await recover_stuck(ctx["redis"])
    if n:
        log.info("recovered %s stuck videos", n)


class WorkerSettings:
    on_startup = startup
    functions = [run_batch, run_video, run_llm_ideas, run_fill_bank, run_lecture, run_cartoon, run_compilation, run_project_render]
    redis_settings = redis_settings()
    max_jobs = get_settings().worker_max_jobs
    job_timeout = 60 * 60 * 6  # длинные лекции: генерация + рендер 20 минут видео на CPU
    keep_result = 3600
