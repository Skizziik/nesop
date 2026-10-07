"""arq-воркер: `arq app.worker.WorkerSettings`."""
from __future__ import annotations

from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from .config import get_settings
from .logging_setup import setup
from .pipeline.produce import plan_batch, produce_video


async def run_batch(ctx: dict[str, Any], batch_id: str) -> int:
    approved = await plan_batch(batch_id)
    redis: ArqRedis = ctx["redis"]
    for vid in approved:
        await redis.enqueue_job("run_video", vid)
    return len(approved)


async def run_video(ctx: dict[str, Any], video_id: str) -> None:
    await produce_video(video_id)


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(get_settings().redis_url)


async def enqueue(fn: str, *args: Any) -> None:
    pool = await create_pool(redis_settings())
    try:
        await pool.enqueue_job(fn, *args)
    finally:
        await pool.aclose()


async def startup(ctx: dict[str, Any]) -> None:
    setup("worker")


class WorkerSettings:
    on_startup = startup
    functions = [run_batch, run_video]
    redis_settings = redis_settings()
    max_jobs = get_settings().worker_max_jobs
    job_timeout = 60 * 30
    keep_result = 3600
