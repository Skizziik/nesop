"""Qwen3-TTS (Apache-2.0): встроенные голоса (0.6B CustomVoice), клон по образцу (0.6B Base), voice design (1.7B VoiceDesign).

Voice design даёт новый голос на каждый вызов, поэтому по описанию один раз генерируется эталонная фраза, сохраняется,
и дальше все строки озвучиваются клоном с этого эталона — голос одинаковый во всех роликах серии.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

import numpy as np

from . import time_stretch


def _size() -> str:
    """1.7B заметно чище звучит; на GPU от 7 GB влезает (держим в памяти одну модель). QWEN3_SIZE=0.6B — принудительно лёгкая."""
    forced = os.environ.get("QWEN3_SIZE")
    if forced in ("0.6B", "1.7B"):
        return forced
    try:
        import torch

        if torch.cuda.is_available() and torch.cuda.get_device_properties(0).total_memory >= 7 * 1024**3:
            return "1.7B"
    except Exception:  # noqa: BLE001 — нет torch/GPU → лёгкая модель
        pass
    return "0.6B"


SIZE = _size()
CUSTOM = f"Qwen/Qwen3-TTS-12Hz-{SIZE}-CustomVoice"
BASE = f"Qwen/Qwen3-TTS-12Hz-{SIZE}-Base"
DESIGN = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
DESIGN_REF_TEXT = "Ciao a tutti e benvenuti! Oggi impariamo insieme qualcosa di nuovo in italiano: ascoltate bene e ripetete con me."
SR = 24000
LANGS = {"it": "Italian", "en": "English"}


def download() -> None:
    from huggingface_hub import snapshot_download

    snapshot_download(CUSTOM)
    snapshot_download(BASE)


class Engine:
    def __init__(self, device: str) -> None:
        import torch

        self.torch = torch
        self.dev = "cuda:0" if device == "cuda" and torch.cuda.is_available() else "cpu"
        self.kw = {"device_map": self.dev, "dtype": torch.bfloat16 if self.dev != "cpu" else torch.float32, "attn_implementation": "sdpa"}
        self.models: dict[str, Any] = {}
        self.prompts: dict[str, Any] = {}
        self.asr: Any = None
        self.designs = Path(os.environ.get("HF_HOME", "/models/hf")).parent / "designs"
        self.designs.mkdir(parents=True, exist_ok=True)

    def model(self, repo: str) -> Any:
        from qwen_tts import Qwen3TTSModel

        if repo not in self.models:
            # в 8 GB двум моделям 1.7B тесно: перед загрузкой выгружаем остальные
            for other in list(self.models):
                self.unload(other)
            self.models[repo] = Qwen3TTSModel.from_pretrained(repo, **self.kw)
        return self.models[repo]

    def unload(self, repo: str) -> None:
        if self.models.pop(repo, None) is not None and self.dev != "cpu":
            self.torch.cuda.empty_cache()

    def design_ref(self, description: str) -> Path:
        """Эталонный образец голоса по описанию (кешируется на диске по хешу описания)."""
        path = self.designs / f"{hashlib.sha1(description.encode()).hexdigest()[:16]}.wav"
        if not path.exists():
            import soundfile as sf

            d = self.model(DESIGN)
            wavs, sr = d.generate_voice_design(text=DESIGN_REF_TEXT, instruct=description, language="Italian")
            sf.write(str(path), wavs[0].astype(np.float32), sr)
            self.unload(DESIGN)  # 1.7B больше не нужна: дальше работает клон на 0.6B Base, влезаем в 8 GB
        return path

    def synth(self, req: dict[str, Any]) -> tuple[np.ndarray, int]:
        text, speed = req["text"], float(req.get("speed") or 1.0)
        lang = LANGS.get(req.get("language") or "it", "Italian")
        ref, ref_text = req.get("ref_audio"), req.get("ref_text") or None
        if req.get("design"):
            # Гибрид: ICL (продолжение эталонной фразы) держит манеру и интонацию одинаковыми во всём ролике, но на 2-5 словах
            # иногда «глотает» слова; x-vector (только тембр) на коротких стабильнее, зато интонация «гуляет» от фразы к фразе.
            # QWEN3_CLONE_MODE = xvec (по умолчанию — выбор владельца на слух, A/B 2026-10-10) | hybrid | icl.
            mode = req.get("clone_mode") or os.environ.get("QWEN3_CLONE_MODE", "xvec")
            icl = mode == "icl" or (mode == "hybrid" and len(text.split()) >= 6)
            ref, ref_text = str(self.design_ref(req["design"])), (DESIGN_REF_TEXT if icl else None)
        # детерминированный сид: тот же текст и номер дубля → тот же звук (повторный рендер не меняет голос)
        self.torch.manual_seed(int(hashlib.sha1(f"{text}|{req.get('seed') or 0}".encode()).hexdigest()[:8], 16))
        if ref:
            key = f"{ref}|{ref_text}"
            b = self.model(BASE)
            if key not in self.prompts:
                self.prompts[key] = b.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text, x_vector_only_mode=ref_text is None)
            wavs, sr = b.generate_voice_clone(text=text, language=lang, voice_clone_prompt=self.prompts[key])
        else:
            m = self.model(CUSTOM)
            wavs, sr = m.generate_custom_voice(text=text, language=lang, speaker=req.get("voice") or "Serena")
        audio = wavs[0].astype(np.float32)
        # фазовый вокодер (librosa) даёт «металлический» звук и путает распознавание — для мелких поправок темпа не растягиваем
        return (audio if abs(speed - 1.0) <= 0.1 else time_stretch(audio, speed)), int(sr)


ASR = "openai/whisper-large-v3-turbo"  # ~1.6 GB fp16: влезает в 8 GB рядом с Qwen3 1.7B


def transcribe(engine: Engine, req: dict[str, Any]) -> str:
    """Распознаёт озвученную фразу — проверка, что модель не проглотила/не исказила слова."""
    if engine.asr is None:
        from transformers import pipeline

        dtype = engine.torch.float16 if engine.dev != "cpu" else engine.torch.float32
        engine.asr = pipeline("automatic-speech-recognition", model=ASR, torch_dtype=dtype, device=engine.dev)
    import soundfile as sf

    audio, sr = sf.read(req["path"], dtype="float32", always_2d=True)
    lang = {"it": "italian", "en": "english"}.get(req.get("language") or "it", "italian")
    out = engine.asr({"raw": audio.mean(axis=1), "sampling_rate": sr}, generate_kwargs={"language": lang, "task": "transcribe"})
    return str(out.get("text", "")).strip()


def load(device: str) -> Engine:
    return Engine(device)


def synth(engine: Engine, req: dict[str, Any]) -> tuple[np.ndarray, int]:
    return engine.synth(req)
