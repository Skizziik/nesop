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

CUSTOM = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
BASE = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
DESIGN = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
DESIGN_REF_TEXT = "Ciao a tutti e benvenuti! Oggi impariamo insieme qualcosa di nuovo in italiano: ascoltate bene e ripetete con me."
SR = 24000


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
        self.designs = Path(os.environ.get("HF_HOME", "/models/hf")).parent / "designs"
        self.designs.mkdir(parents=True, exist_ok=True)

    def model(self, repo: str) -> Any:
        from qwen_tts import Qwen3TTSModel

        if repo not in self.models:
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
        ref, ref_text = req.get("ref_audio"), req.get("ref_text") or None
        if req.get("design"):
            ref, ref_text = str(self.design_ref(req["design"])), DESIGN_REF_TEXT
        if req.get("seed"):
            self.torch.manual_seed(int(req["seed"]))
        if ref:
            key = f"{ref}|{ref_text}"
            b = self.model(BASE)
            if key not in self.prompts:
                self.prompts[key] = b.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text, x_vector_only_mode=ref_text is None)
            wavs, sr = b.generate_voice_clone(text=text, language="Italian", voice_clone_prompt=self.prompts[key])
        else:
            m = self.model(CUSTOM)
            wavs, sr = m.generate_custom_voice(text=text, language="Italian", speaker=req.get("voice") or "Serena")
        return time_stretch(wavs[0].astype(np.float32), speed), int(sr)


def load(device: str) -> Engine:
    return Engine(device)


def synth(engine: Engine, req: dict[str, Any]) -> tuple[np.ndarray, int]:
    return engine.synth(req)
