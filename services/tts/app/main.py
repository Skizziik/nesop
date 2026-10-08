"""TTS-сервис: синтез, менеджер моделей, кеш. Все пути ответов — относительно /data (api раздаёт их как /media/...)."""
from __future__ import annotations

from typing import Literal

import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from .manager import Manager


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "level": record.levelname.lower(), "service": "tts", "logger": record.name, "msg": record.getMessage()}
        for k in ("key", "model", "voice"):
            if hasattr(record, k):
                payload[k] = getattr(record, k)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


_h = logging.StreamHandler(sys.stdout)
_h.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_h], force=True)

MODELS_DIR = Path(os.environ.get("MODELS_DIR", "/models"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
manager: Manager


@asynccontextmanager
async def lifespan(_: FastAPI):  # type: ignore[no-untyped-def]
    global manager
    manager = Manager(MODELS_DIR, DATA_DIR)
    manager.ensure_default()
    yield


app = FastAPI(title="ItalianoPerTe TTS", lifespan=lifespan)


class SynthIn(BaseModel):
    model: str = "piper"
    voice: str | None = None
    text: str = Field(min_length=1, max_length=500)
    speed: float = Field(default=1.0, ge=0.5, le=1.5)
    variant: int = Field(default=0, ge=0, le=1000)
    ref_audio: str | None = Field(default=None, description="Путь относительно /data к референсу для клона")
    ref_text: str | None = None
    design: str | None = Field(default=None, max_length=500, description="Описание голоса для voice design")
    language: Literal["it", "en"] = Field(default="it", description="Язык фразы: лекции для англоязычных объясняют по-английски")


class InstallIn(BaseModel):
    voice: str | None = None


@app.get("/health")
def health() -> dict[str, object]:
    ready = any(p.is_installed() for p in manager.plugins.values())
    installing = [asdict(s) for s in manager.installs.values() if s.status == "downloading"]
    return {"ok": True, "ready": ready, "installing": installing, "hardware": asdict(manager.hardware)}


@app.get("/hardware")
def hardware() -> dict[str, object]:
    return asdict(manager.hardware)


@app.get("/models")
def models() -> list[dict[str, object]]:
    return manager.describe()


@app.post("/models/{pid}/install", status_code=202)
def install(pid: str, body: InstallIn | None = None) -> dict[str, object]:
    try:
        return asdict(manager.start_install(pid, body.voice if body else None))
    except KeyError as e:
        raise HTTPException(404, str(e)) from e


@app.delete("/models/{pid}")
def uninstall(pid: str, voice: str | None = None) -> dict[str, bool]:
    try:
        manager.plugin(pid).uninstall(voice)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    return {"ok": True}


@app.post("/synthesize")
async def synthesize(body: SynthIn) -> dict[str, object]:
    try:
        return await run_in_threadpool(manager.synthesize, body.model, body.voice, body.text, body.speed, body.variant, body.ref_audio, body.ref_text, body.design, body.language)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(409, str(e)) from e
