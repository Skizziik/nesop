from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .db import SessionLocal
from .logging_setup import setup
from .routers import core, llm, studio
from .seeds import seed_all

setup("api")
log = logging.getLogger("farm.api")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings().data_dir.mkdir(parents=True, exist_ok=True)
    async with SessionLocal() as s:
        await seed_all(s)
    yield


app = FastAPI(title="ItalianoPerTe Farm API", lifespan=lifespan)
app.include_router(core.router)
app.include_router(studio.router)
app.include_router(llm.router)
app.mount("/media", StaticFiles(directory=str(get_settings().data_dir), check_dir=False), name="media")


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled")
    return JSONResponse(status_code=500, content={"detail": f"Внутренняя ошибка: {type(exc).__name__}: {exc}"[:500]})
