"""Переозвучка одной фразы лекции из редактора: новый дубль Qwen (проверка Whisper) вклеивается на место старого в дорожку голоса."""
from __future__ import annotations

import copy
from typing import Any

import numpy as np

from ..config import get_settings
from ..models import Project, Series
from . import clients
from .audio import SR, envelope, load_mono, trim_silence, write_wav
from .lecture import ASR_OK, _word_times
from .produce import default_voice, voice_config

MAX_SPEEDUP = 1.15  # сильнее ускорять нельзя — слышно


class RevoiceError(Exception):
    pass


def _media_to_rel(src: str) -> str:
    return src.removeprefix("/media").lstrip("/")


def _fit(a: np.ndarray, n: int) -> np.ndarray:
    """Ускоряет клип до n сэмплов простой интерполяцией (только для небольших поправок ≤ 15%)."""
    if len(a) <= n:
        return a
    return np.asarray(np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a), dtype=np.float32)


async def revoice_sentence(s: Any, p: Project, clip_id: str) -> dict[str, Any]:
    st = get_settings()
    doc = copy.deepcopy(p.doc)
    subs = sorted((c for t in doc["tracks"] if t["kind"] == "subtitle" for c in t["clips"]), key=lambda c: c["start"])
    c = next((x for x in subs if x["id"] == clip_id), None)
    if c is None:
        raise RevoiceError("Это не фраза субтитров")
    voice_clip = next((x for t in doc["tracks"] if t["kind"] == "audio" and t["id"] == "voice" for x in t["clips"]), None)
    if voice_clip is None:
        raise RevoiceError("В проекте нет дорожки голоса — переозвучка работает для лекций")
    text = str(c["props"].get("text", "")).strip()
    if not text:
        raise RevoiceError("Пустой текст фразы")
    lang = c["props"].get("lang") or ("it" if c["props"].get("tr") else "en")
    nxt = next((x["start"] for x in subs if x["start"] > c["start"] + 0.01), doc.get("duration_s", c["start"] + c["duration"] + 1))
    slot = max(0.4, float(nxt) - float(c["start"]) - 0.08)

    series = await s.get(Series, p.series_id) if p.series_id else None
    vcfg = voice_config((p.params or {}).get("voice"), series.voice if series else None, await default_voice(s))
    take0 = int(c["props"].get("take", 0)) + 1
    best: tuple[float, np.ndarray, str, int] | None = None
    for variant in range(take0, take0 + 3):
        r = await clients.tts_synthesize(text, vcfg["model"], vcfg.get("voice"), float(vcfg.get("speed", 0.95)), variant, vcfg.get("ref_audio"),
                                         vcfg.get("ref_text"), vcfg.get("design"), language=lang)
        clip = trim_silence(load_mono(st.data_dir / r["path"].lstrip("/")))
        heard = await clients.tts_transcribe(r["path"], lang)
        score = clients.speech_match(text, heard, lang) if heard is not None else 1.0
        fits = len(clip) <= slot * SR * MAX_SPEEDUP
        # приоритет: разборчивый и помещается → разборчивый → помещается
        rank = score + (0.5 if fits else 0.0)
        if best is None or rank > best[0]:
            best = (rank, clip, heard or "", variant)
        if score >= ASR_OK and fits:
            break
    assert best is not None
    _, new, heard, variant = best
    score = clients.speech_match(text, heard, lang) if heard else 1.0

    voice_rel = _media_to_rel(voice_clip["props"]["src"])
    buf = load_mono(st.data_dir / voice_rel)
    a = int(round(float(c["start"]) * SR))
    n_slot = int(slot * SR)
    old = buf[a : a + n_slot]
    loud = old[np.abs(old) > 0.02]
    if len(loud) and len(new):
        new = new * float(np.sqrt((loud**2).mean()) / max(np.sqrt((new[np.abs(new) > 0.02] ** 2).mean()) if (np.abs(new) > 0.02).any() else 1.0, 1e-6))
    new = _fit(np.clip(new, -1, 1).astype(np.float32), n_slot)
    end = min(len(buf), a + n_slot)
    buf[a:end] = 0.0
    buf[a : a + len(new)] = new[: max(0, len(buf) - a)]

    rev = int(p.revision) + 1
    new_rel = f"projects/{p.id}/voice-r{rev}.wav"
    write_wav(st.data_dir / new_rel, buf)
    voice_clip["props"]["src"] = f"/media/{new_rel}"
    dur = round(len(new) / SR, 3)
    c["duration"] = round(dur + 0.1, 3)
    c["props"].update({"take": variant, "lang": lang, "words": _word_times(text, dur)})
    doc["envelope"] = envelope(buf)
    return {"doc": doc, "score": round(score, 2), "heard": heard, "take": variant, "duration": dur}
