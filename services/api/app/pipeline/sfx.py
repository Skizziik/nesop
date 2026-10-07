"""Процедурные SFX (собственная генерация → без лицензионных ограничений, CC0)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from .audio import write_wav

SR = 44100


F32 = NDArray[np.float32]


def _f32(x: object) -> F32:
    return np.asarray(x, dtype=np.float32)


def _t(dur: float) -> np.ndarray:
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def _env(t: np.ndarray, attack: float, decay: float) -> np.ndarray:
    return np.minimum(t / max(attack, 1e-4), 1.0) * np.exp(-t / decay)


def pop() -> F32:
    t = _t(0.12)
    f = 900 * np.exp(-t * 18) + 280
    return _f32(np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(t, 0.002, 0.03))


def tick() -> F32:
    t = _t(0.05)
    rng = np.random.default_rng(1)
    click = rng.standard_normal(len(t)) * _env(t, 0.0005, 0.006)
    return _f32(0.6 * click + 0.4 * np.sin(2 * np.pi * 2400 * t) * _env(t, 0.0005, 0.01))


def ding() -> F32:
    t = _t(1.0)
    tone = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(1318.5, 1.0), (2637, 0.35), (3955, 0.12)])
    return _f32(tone * _env(t, 0.003, 0.35) * 0.6)


def whoosh() -> F32:
    t = _t(0.45)
    rng = np.random.default_rng(2)
    noise = rng.standard_normal(len(t))
    # простой «резонатор» с плывущей частотой поверх шума
    sweep = np.sin(2 * np.pi * np.cumsum(300 + 2500 * (t / t[-1])) / SR)
    shape = np.sin(np.pi * t / t[-1]) ** 2
    out = (0.5 * noise * np.abs(sweep) + 0.15 * sweep) * shape
    return _f32(out / np.abs(out).max() * 0.7)


def buzz() -> F32:
    t = _t(0.35)
    sq = np.sign(np.sin(2 * np.pi * 140 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 147 * t)) * 0.5
    return _f32(sq * _env(t, 0.005, 0.2) * 0.4)


def confetti() -> F32:
    t = _t(0.8)
    rng = np.random.default_rng(3)
    out = np.zeros_like(t)
    for _ in range(14):
        s = int(rng.uniform(0, 0.55) * SR)
        f = rng.uniform(1800, 4200)
        tt = t[: len(t) - s]
        out[s:] += np.sin(2 * np.pi * f * tt) * _env(tt, 0.001, 0.04) * rng.uniform(0.2, 0.5)
    return _f32(out / np.abs(out).max() * 0.6)


GENERATORS = {"pop": pop, "tick": tick, "ding": ding, "whoosh": whoosh, "buzz": buzz, "confetti": confetti}


def ensure_sfx(data_dir: Path) -> list[Path]:
    out = []
    for name, gen in GENERATORS.items():
        p = data_dir / "sfx" / f"{name}.wav"
        if not p.exists():
            write_wav(p, gen())
        out.append(p)
    return out
