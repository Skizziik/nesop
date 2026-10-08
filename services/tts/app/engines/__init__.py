"""Движки TTS, работающие в подпроцессе (app.runner). Каждый: download(), load(device), synth(model, req) -> (np.ndarray, sr)."""
from __future__ import annotations

import numpy as np


def time_stretch(audio: np.ndarray, speed: float) -> np.ndarray:
    """Для моделей без параметра скорости: растяжение без изменения высоты (librosa есть в зависимостях этих моделей)."""
    if abs(speed - 1.0) < 0.02 or len(audio) < 2048:
        return audio
    import librosa

    return np.asarray(librosa.effects.time_stretch(audio.astype(np.float32), rate=float(speed)), dtype=np.float32)
