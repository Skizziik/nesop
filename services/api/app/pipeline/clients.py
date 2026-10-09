from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from ..config import get_settings


class ServiceError(RuntimeError):
    pass


async def tts_synthesize(text: str, model: str, voice: str | None, speed: float, variant: int = 0,
                         ref_audio: str | None = None, ref_text: str | None = None, design: str | None = None, language: str = "it") -> dict[str, Any]:
    st = get_settings()
    async with httpx.AsyncClient(timeout=120) as c:
        for attempt in range(60):  # первый запуск: голос по умолчанию может ещё качаться
            r = await c.post(f"{st.tts_url}/synthesize", json={"model": model, "voice": voice, "text": text, "speed": speed, "variant": variant,
                                                               "ref_audio": ref_audio, "ref_text": ref_text, "design": design, "language": language})
            if r.status_code == 409 and attempt < 59:
                await asyncio.sleep(5)
                continue
            if r.status_code >= 400:
                raise ServiceError(f"TTS: {r.status_code} {r.text[:300]}")
            return r.json()  # type: ignore[no-any-return]
    raise ServiceError("TTS: голос не установился за 5 минут")


async def still(props: dict[str, Any], out_rel: str, composition: str = "Thumbnail", frame: int = 0) -> str:
    """Один кадр через рендерер (обложки). out_rel — путь относительно /data."""
    st = get_settings()
    try:
        async with httpx.AsyncClient(timeout=180) as c:
            r = await c.post(f"{st.renderer_url}/still", json={"props": props, "out": out_rel, "composition": composition, "frame": frame})
    except httpx.HTTPError as e:
        raise ServiceError(f"Renderer недоступен: {type(e).__name__}") from e
    if r.status_code >= 400:
        raise ServiceError(f"Renderer: {r.status_code} {r.text[:300]}")
    return out_rel


async def tts_transcribe(path: str, language: str = "it") -> str | None:
    """Whisper в TTS-сервисе. None — проверка недоступна (Qwen3 не установлен) — тогда просто пропускаем."""
    st = get_settings()
    try:
        async with httpx.AsyncClient(timeout=600) as c:
            r = await c.post(f"{st.tts_url}/transcribe", json={"path": path, "language": language})
            return str(r.json()["text"]) if r.status_code == 200 else None
    except httpx.HTTPError:
        return None


_NUM = {
    "it": "zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove venti".split(),
    "en": "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(),
}


def speech_match(expected: str, heard: str, language: str = "it") -> float:
    """Доля совпадения слов (0..1) между текстом и распознанным — без регистра, пунктуации и апострофов; «8» = «otto»."""
    import difflib
    import re
    import unicodedata

    nums = _NUM.get(language, _NUM["it"])

    def words(s: str) -> list[str]:
        s = unicodedata.normalize("NFKD", s.lower())
        s = "".join(ch for ch in s if not unicodedata.combining(ch))
        return [nums[int(w)] if w.isdigit() and int(w) <= 20 else w for w in re.findall(r"[a-z0-9]+", s)]

    a, b = words(expected), words(heard)
    if not a:
        return 1.0
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


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
        misses = 0
        for _ in range(limit):
            await asyncio.sleep(1)
            try:
                s = (await c.get(f"{st.renderer_url}/render/{job_id}")).json()
                misses = 0
            except (httpx.HTTPError, ValueError) as e:
                # на склейке длинного видео рендерер может отвечать медленно — это не повод бросать задачу
                misses += 1
                if misses > 120:
                    raise ServiceError(f"Рендерер не отвечает: {type(e).__name__}") from e
                continue
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
