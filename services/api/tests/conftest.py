"""Тесты гоняются в контейнере api против отдельной БД <db>_test (создаётся автоматически)."""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

_base = os.environ.get("DATABASE_URL", "postgresql+asyncpg://farm:farm@postgres:5432/farm")
TEST_DB_URL = _base.rsplit("/", 1)[0] + "/" + _base.rsplit("/", 1)[1] + "_test"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ.setdefault("DATA_DIR", "/tmp/farm-test-data")
os.environ.setdefault("CONTENT_DIR", str(Path(__file__).resolve().parents[3] / "content") if not Path("/srv/content").exists() else "/srv/content")


@pytest.fixture(scope="session")
async def db() -> AsyncIterator[None]:
    import asyncpg

    from app import models  # noqa: F401
    from app.db import Base, engine

    admin = _base.replace("postgresql+asyncpg", "postgresql")
    conn = await asyncpg.connect(admin)
    name = TEST_DB_URL.rsplit("/", 1)[1]
    if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname=$1", name):
        await conn.execute(f'CREATE DATABASE "{name}"')
    await conn.close()
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def session(db: None) -> AsyncIterator[object]:
    from app.db import SessionLocal

    async with SessionLocal() as s:
        yield s
