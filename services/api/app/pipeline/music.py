"""Процедурная фоновая музыка: собственная генерация → CC0, без риска Content ID и страйков.

Каждый трек — бесшовный луп из целого числа тактов: щипковые арпеджио + мягкий пэд + бас + тихий ритм.
Треки разные (тональность, темп, гармония, тембр), ролик выбирает трек по своему сиду.
"""
from __future__ import annotations

import zlib
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from .audio import write_wav

SR = 44100
F32 = NDArray[np.float32]
NOTE = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
# ступени мажора → полутоны от тоники; трезвучия по ступеням
MAJOR = [0, 2, 4, 5, 7, 9, 11]


@dataclass(frozen=True)
class Track:
    slug: str
    name: str
    key: str
    bpm: int
    progression: tuple[int, ...]  # ступени (0 = I, 4 = V, 5 = vi, 3 = IV ...)
    bars: int
    pluck_bright: float
    swing: float
    drums: bool


TRACKS = [
    Track("caffe-mattutino", "Caffè mattutino", "C", 96, (0, 4, 5, 3), 16, 0.6, 0.0, True),
    Track("passeggiata-roma", "Passeggiata a Roma", "G", 104, (0, 5, 3, 4), 16, 0.7, 0.08, True),
    Track("sole-di-napoli", "Sole di Napoli", "D", 112, (0, 3, 4, 3), 16, 0.8, 0.12, True),
    Track("piazza-tranquilla", "Piazza tranquilla", "F", 84, (0, 2, 3, 4), 12, 0.45, 0.0, False),
    Track("gelato-pomeriggio", "Gelato del pomeriggio", "A", 100, (0, 4, 5, 2, 3, 0, 3, 4), 16, 0.65, 0.1, True),
    Track("lezione-allegra", "Lezione allegra", "E", 118, (0, 3, 0, 4), 16, 0.75, 0.0, True),
    Track("tramonto-toscano", "Tramonto toscano", "Bb", 88, (5, 3, 0, 4), 12, 0.5, 0.05, False),
    Track("vespa-in-citta", "Vespa in città", "Eb", 108, (0, 5, 1, 4), 16, 0.7, 0.15, True),
]


def _midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def _chord(root_midi: int, degree: int) -> list[int]:
    """Трезвучие на ступени мажора (в тональности root)."""
    return [root_midi + MAJOR[(degree + k) % 7] + 12 * ((degree + k) // 7) for k in (0, 2, 4)]


def _pluck(freq: float, dur: float, bright: float) -> F32:
    """Щипок: несколько гармоник с быстрым затуханием верхних (как укулеле/гитара)."""
    t = np.arange(int(SR * dur)) / SR
    out = np.zeros_like(t)
    for h, a in enumerate([1.0, 0.5 * bright, 0.3 * bright, 0.15 * bright, 0.08 * bright], start=1):
        out += a * np.sin(2 * np.pi * freq * h * t) * np.exp(-t * (3.0 + 2.5 * h))
    att = np.minimum(t / 0.004, 1.0)
    return np.asarray(out * att, dtype=np.float32)


def _pad(freqs: list[float], dur: float) -> F32:
    t = np.arange(int(SR * dur)) / SR
    out = np.zeros_like(t)
    for f in freqs:
        for det in (-0.15, 0.15):  # лёгкая расстройка — «тёплый» пэд
            out += np.sin(2 * np.pi * (f + det) * t) + 0.25 * np.sin(2 * np.pi * 2 * (f + det) * t)
    env = np.minimum(t / 0.35, 1.0) * np.minimum((dur - t) / 0.35, 1.0)
    return np.asarray(out * env / (len(freqs) * 2), dtype=np.float32)


def _kick() -> F32:
    t = np.arange(int(SR * 0.25)) / SR
    f = 110 * np.exp(-t * 25) + 45
    return np.asarray(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14), dtype=np.float32)


def _hat(rng: np.random.Generator) -> F32:
    t = np.arange(int(SR * 0.05)) / SR
    n = rng.standard_normal(len(t))
    n = n - np.convolve(n, np.ones(4) / 4, mode="same")  # грубый high-pass
    return np.asarray(n * np.exp(-t * 90) * 0.5, dtype=np.float32)


def _add(buf: F32, clip: F32, at: int, gain: float) -> None:
    at %= len(buf)
    end = min(at + len(clip), len(buf))
    buf[at:end] += clip[: end - at] * gain
    rest = len(clip) - (end - at)
    if rest > 0:  # хвост заворачиваем в начало — луп бесшовный
        buf[:rest] += clip[end - at :] * gain


def render(tr: Track) -> F32:
    rng = np.random.default_rng(zlib.crc32(tr.slug.encode()))
    beat = 60.0 / tr.bpm
    bar = beat * 4
    total = int(SR * bar * tr.bars)
    buf = np.zeros(total, np.float32)
    root = 60 + NOTE[tr.key]
    if root > 64:
        root -= 12
    kick, hat = _kick(), _hat(rng)
    pattern = [0, 1, 2, 1, 2, 1, 0, 2]  # индексы нот аккорда в арпеджио (восьмые)
    for b in range(tr.bars):
        deg = tr.progression[b % len(tr.progression)]
        ch = _chord(root, deg)
        t0 = int(SR * b * bar)
        _add(buf, _pad([_midi_hz(n - 12) for n in ch], bar + 0.3), t0, 0.22)
        _add(buf, _pluck(_midi_hz(ch[0] - 24), bar * 0.9, 0.3), t0, 0.35)  # бас
        _add(buf, _pluck(_midi_hz(ch[0] - 24), beat * 0.9, 0.3), t0 + int(SR * beat * 2), 0.28)
        for i, idx in enumerate(pattern):
            if rng.random() < 0.12 and i % 2 == 1:
                continue  # иногда пропускаем ноту — живее
            off = i * beat / 2 + (tr.swing * beat / 2 if i % 2 else 0)
            note = ch[idx] + (12 if i in (3, 7) and rng.random() < 0.5 else 0)
            _add(buf, _pluck(_midi_hz(note), beat * 1.2, tr.pluck_bright), t0 + int(SR * off), 0.30)
        if tr.drums:
            for q in range(4):
                if q in (0, 2):
                    _add(buf, kick, t0 + int(SR * q * beat), 0.35)
                for e in range(2):
                    _add(buf, hat, t0 + int(SR * (q * beat + e * beat / 2 + (tr.swing * beat / 2 if e else 0))), 0.12)
    # мягкий «тёплый» low-pass (одно скользящее среднее) и нормализация с запасом
    buf = np.convolve(buf, np.ones(3) / 3, mode="same").astype(np.float32)
    peak = float(np.abs(buf).max()) or 1.0
    return np.asarray(buf / peak * 0.6, dtype=np.float32)


def ensure_music(data_dir: Path) -> list[tuple[Track, str]]:
    """Генерирует недостающие треки в /data/music. Возвращает (трек, относительный путь)."""
    out = []
    for tr in TRACKS:
        rel = f"/music/{tr.slug}.wav"
        p = data_dir / rel.lstrip("/")
        if not p.exists():
            write_wav(p, render(tr))
        out.append((tr, rel))
    return out
