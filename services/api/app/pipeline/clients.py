from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ..config import get_settings


class ServiceError(RuntimeError):
    pass


async def tts_synthesize(text: str, model: str, voice: str | None, speed: float, variant: int = 0,
                         ref_audio: str | None = None, ref_text: str | None = None, design: str | None = None) -> dict[str, Any]:
    st = get_settings()
    async with httpx.AsyncClient(timeout=120) as c:
        for attempt in range(60):  # первый запуск: голос по умолчанию может ещё качаться
            r = await c.post(f"{st.tts_url}/synthesize", json={"model": model, "voice": voice, "text": text, "speed": speed, "variant": variant,
                                                               "ref_audio": ref_audio, "ref_text": ref_text, "design": design})
            if r.status_code == 409 and attempt < 59:
                await asyncio.sleep(5)
                continue
            if r.status_code >= 400:
                raise ServiceError(f"TTS: {r.status_code} {r.text[:300]}")
            return r.json()  # type: ignore[no-any-return]
    raise ServiceError("TTS: голос не установился за 5 минут")


async def render(props: dict[str, Any], out_dir: str, on_progress: Callable[[float], Awaitable[None]], composition: str = "Short",
                 timeout_s: int | None = None) -> dict[str, Any]:
    st = get_settings()
    limit = timeout_s or st.render_timeout_s
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{st.renderer_url}/render", json={"props": props, "out_dir": out_dir, "composition": composition})
        if r.status_code >= 400:
            raise ServiceError(f"Renderer: {r.status_code} {r.text[:300]}")
        job_id = r.json()["job_id"]
        last = -1.0
        for _ in range(limit):
            await asyncio.sleep(1)
            s = (await c.get(f"{st.renderer_url}/render/{job_id}")).json()
            if s["status"] == "done":
                return s  # type: ignore[no-any-return]
            if s["status"] == "error":
                raise ServiceError(f"Рендер упал: {s['error']}")
            if s["progress"] - last >= 0.05:
                last = s["progress"]
                await on_progress(last)
    raise ServiceError(f"Рендер не уложился в {limit} сек")


async def probe(url: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(url)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            return {"ok": r.status_code == 200, "status": r.status_code, **({"detail": body} if body else {})}
    except (httpx.HTTPError, ValueError) as e:
        return {"ok": False, "error": type(e).__name__}
