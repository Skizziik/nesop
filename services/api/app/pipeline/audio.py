"""Сборка голосовой дорожки: строки синтезируются по отдельности, тишина по краям обрезается,
таймлайн собирается с паузами из настроек. Это даёт точную подсветку без forced alignment."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

from ..formats.base import Placement, Segment

SR = 44100


def load_mono(path: Path, sr: int = SR) -> np.ndarray:
    data, file_sr = sf.read(str(path), dtype="float32", always_2d=True)
    a = data.mean(axis=1)
    if file_sr != sr and len(a):
        n = int(round(len(a) * sr / file_sr))
        a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a)
    return np.asarray(a, dtype=np.float32)


def trim_silence(a: np.ndarray, sr: int = SR, rel_thr: float = 0.02, pad_head: float = 0.02, pad_tail: float = 0.05) -> np.ndarray:
    if not len(a):
        return a
    peak = float(np.abs(a).max())
    if peak <= 1e-6:
        return np.zeros(0, np.float32)
    nz = np.flatnonzero(np.abs(a) > rel_thr * peak)
    lo = max(int(nz[0]) - int(pad_head * sr), 0)
    hi = min(int(nz[-1]) + int(pad_tail * sr), len(a))
    return a[lo:hi]


@dataclass
class Track:
    audio: np.ndarray
    placements: list[Placement]
    total: float


def assemble(segments: list[Segment], clips: dict[str, np.ndarray], lead_in: float, sr: int = SR) -> Track:
    """Кладёт клипы последовательно. Слот = max(длина клипа, min_dur) + пауза."""
    t = lead_in
    placements: list[Placement] = []
    for seg in segments:
        clip = clips.get(seg.key, np.zeros(0, np.float32))
        dur = len(clip) / sr
        slot = max(dur, seg.min_dur)
        placements.append(Placement(seg.key, round(t, 4), round(t + dur, 4), round(t + slot + seg.gap_after, 4)))
        t += slot + seg.gap_after
    total = round(t, 3)
    buf = np.zeros(int(np.ceil(total * sr)) + 1, np.float32)
    for p in placements:
        pc = clips.get(p.key)
        if pc is None or not len(pc):
            continue
        s = int(round(p.start * sr))
        buf[s : s + len(pc)] += pc[: max(len(buf) - s, 0)]
    peak = float(np.abs(buf).max()) or 1.0
    return Track(audio=(buf / peak * 0.89).astype(np.float32), placements=placements, total=total)


def envelope(a: np.ndarray, fps: int = 30, sr: int = SR) -> list[float]:
    """RMS по кадрам (0..1) — для маскота с «ртом по амплитуде» (этап 6)."""
    hop = sr // fps
    n = int(np.ceil(len(a) / hop))
    if n == 0:
        return []
    padded = np.zeros(n * hop, np.float32)
    padded[: len(a)] = a
    rms = np.sqrt((padded.reshape(n, hop) ** 2).mean(axis=1))
    m = float(rms.max()) or 1.0
    return [round(float(x / m), 3) for x in rms]


def write_wav(path: Path, a: np.ndarray, sr: int = SR) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), a, sr, subtype="PCM_16")
