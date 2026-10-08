"""Kyutai Pocket TTS (код MIT, веса CC-BY-4.0): итальянская модель для CPU, голоса-эмбеддинги (giovanni — итальянский)."""
from __future__ import annotations

from typing import Any

import numpy as np


def download() -> None:
    from pocket_tts import TTSModel

    TTSModel.load_model(language="italian")


class Engine:
    def __init__(self, device: str) -> None:
        from pocket_tts import TTSModel

        self.m = TTSModel.load_model(language="italian")
        if device == "cuda":
            try:
                self.m = self.m.to("cuda")
            except Exception:  # noqa: BLE001 — GPU для pocket неофициален, остаёмся на CPU
                pass
        self.states: dict[str, Any] = {}

    def synth(self, req: dict[str, Any]) -> tuple[np.ndarray, int]:
        voice = req.get("voice") or "giovanni"
        if voice not in self.states:
            self.states[voice] = self.m.get_state_for_audio_prompt(voice)
        audio = self.m.generate_audio(self.states[voice], req["text"]).detach().cpu().squeeze().numpy().astype(np.float32)
        from . import time_stretch

        try:
            audio = time_stretch(audio, float(req.get("speed") or 1.0))
        except ImportError:
            pass  # librosa в зависимостях pocket нет — скорость не меняем
        return audio, int(self.m.sample_rate)


def load(device: str) -> Engine:
    return Engine(device)


def synth(engine: Engine, req: dict[str, Any]) -> tuple[np.ndarray, int]:
    return engine.synth(req)
