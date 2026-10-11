"""Процедурные SFX, атмосферы и сведение звука мультика (собственная генерация → CC0, чистый numpy).

- Разовые звуки: boing, hop, pop, footstep (своя высота у каждого героя), whoosh, sparkle, ding, chime, splash, clap, heart,
  snore, bell, knock, drumroll, notes, droplet, exclaim, hmm, poof, uhoh, thump, crunch, nom (+ старые pop/tick/ding/whoosh/buzz/confetti
  для роликов-форматов — GENERATORS, /data/sfx).
- Атмосферы — бесшовные лупы ~20 с: rain, wind, birds, waves, crickets.
- `scene_events(scenes)` — какие звуки положить по ключам сцен CartoonDoc (шаги по фазе походки из actions.ts, прыжки,
  хлопки, эффекты над головой, карточки слов, вопросы зрителю, переходы, заставки, атмосфера по локации/погоде/времени).
- `mix_cartoon(...)` — сведение эпизода блоками по 20 с (память не растёт с длиной): голоса (выравнивание громкости),
  музыка (фон с дакингом под репликами, песни, заставка, стингеры), SFX + атмосфера; общий предохранитель от перегруза.
"""
from __future__ import annotations

import math
import wave
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from . import music as mu
from .music import F32, F64, SR, fft_filter

# ------------------------------------------------------------------ helpers


def _t(dur: float) -> F64:
    return np.arange(int(SR * dur), dtype=np.float64) / SR


def _env(t: F64, attack: float, decay: float) -> F64:
    return np.asarray(np.minimum(t / max(attack, 1e-4), 1.0) * np.exp(-t / decay), np.float64)


def _out(x: F64, peak: float = 0.9) -> F32:
    """Разовый звук: без постоянной составляющей, мягкие края, нормировка пика."""
    x = np.asarray(x, np.float64)
    if len(x) > 256:
        x = fft_filter(x, lo=25, order=1)
    m = float(np.abs(x).max()) or 1.0
    x = x / m * peak
    na, nr = min(len(x), 24), min(len(x), int(0.02 * SR))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr) ** 2
    return np.asarray(x, np.float32)


def _sweep(f0: float, f1: float, dur: float, curve: float = 3.0) -> F64:
    """Синус с экспоненциально-гладким переходом частоты f0 → f1 (фаза — интеграл)."""
    t = _t(dur)
    k = 1 - np.exp(-t * curve / max(dur, 1e-3))
    k /= k[-1] if len(k) and k[-1] else 1.0
    f = f0 + (f1 - f0) * k
    return np.asarray(np.sin(2 * np.pi * np.cumsum(f) / SR), np.float64)


def _rng(name: str) -> np.random.Generator:
    return np.random.default_rng(zlib.crc32(name.encode()))


def _add(buf: F64, clip: F64, at: int, gain: float = 1.0, wrap: bool = False) -> None:
    mu._place(buf, np.asarray(clip, np.float64), at, gain, wrap)


def shaped_noise(n: int, gains: Callable[[F64, F64], F64], seed: int, wrap: bool = True, frame: int = 2048) -> F64:
    """Шум с меняющимся во времени спектром (STFT-синтез): gains(times[:,None], freqs[None,:]) → амплитуды.
    wrap=True — круговое наложение кадров, луп бесшовный (n кратно frame/4)."""
    hop = frame // 4
    nb = -(-n // hop) + (0 if wrap else 4)
    m = nb if wrap else nb - 3
    times = ((np.arange(m) * hop + frame / 2) / SR)[:, None]
    if wrap:
        times = times % (n / SR)
    freqs = np.fft.rfftfreq(frame, 1 / SR)[None, :]
    g = gains(times, freqs)
    rng = np.random.default_rng(seed)
    spec = (rng.standard_normal(g.shape) + 1j * rng.standard_normal(g.shape)) * g
    frames = np.fft.irfft(spec, frame, axis=1) * np.hanning(frame)[None, :]
    blocks = np.zeros((nb, hop))
    fr = frames.reshape(m, 4, hop)
    idx = np.arange(m)
    for j in range(4):
        if wrap:
            blocks[(idx + j) % nb] += fr[:, j]
        else:
            blocks[idx + j] += fr[:, j]
    return blocks.reshape(-1)[:n]


def _band(f: F64, lo: float, hi: float, order: int = 2) -> F64:
    return np.asarray(1 / np.sqrt(1 + (f / hi) ** (2 * order)) / np.sqrt(1 + (lo / np.maximum(f, 1.0)) ** (2 * order)), np.float64)


# ------------------------------------------------------------------ разовые звуки (старые — для форматов роликов)
def pop() -> F32:
    """Пузырьковый «плоп»: короткий синус, взлетающий вверх."""
    t = _t(0.12)
    x = _sweep(380, 1150, 0.12, 6) * _env(t, 0.001, 0.028)
    x += 0.25 * _sweep(760, 2300, 0.12, 6) * _env(t, 0.001, 0.012)
    return _out(x)


def tick() -> F32:
    t = _t(0.05)
    rng = np.random.default_rng(1)
    click = rng.standard_normal(len(t)) * _env(t, 0.0005, 0.006)
    return _out(0.6 * click + 0.4 * np.sin(2 * np.pi * 2400 * t) * _env(t, 0.0005, 0.01), 0.8)


def ding() -> F32:
    """Мягкий колокольчик (карточка слова)."""
    t = _t(1.4)
    f = 1046.5
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in [(1, 1.0, 0.55), (2.0, 0.25, 0.3), (2.76, 0.18, 0.2), (5.4, 0.06, 0.08)])
    return _out(np.asarray(x) * np.minimum(t / 0.002, 1.0), 0.8)


def whoosh() -> F32:
    """Мягкий «вжух»: шум с полосой, проезжающей вверх и обратно."""
    dur = 0.5
    n = int(SR * dur)

    def g(tt: F64, f: F64) -> F64:
        k = np.clip(tt / dur, 0, 1)
        fc = 350 + 2600 * np.sin(np.pi * k) ** 1.5
        amp = np.sin(np.pi * k) ** 2
        return np.asarray(amp * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / 0.9) ** 2), np.float64)

    return _out(shaped_noise(n, g, 2, wrap=False), 0.75)


def buzz() -> F32:
    t = _t(0.35)
    sq = np.sign(np.sin(2 * np.pi * 140 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 147 * t)) * 0.5
    return _out(fft_filter(sq, hi=2500) * _env(t, 0.005, 0.2), 0.5)


def confetti() -> F32:
    t = _t(0.8)
    rng = np.random.default_rng(3)
    out = np.zeros_like(t)
    for _ in range(14):
        s = int(rng.uniform(0, 0.55) * SR)
        f = rng.uniform(1800, 4200)
        tt = t[: len(t) - s]
        out[s:] += np.sin(2 * np.pi * f * tt) * _env(tt, 0.001, 0.04) * rng.uniform(0.2, 0.5)
    return _out(out, 0.6)


GENERATORS = {"pop": pop, "tick": tick, "ding": ding, "whoosh": whoosh, "buzz": buzz, "confetti": confetti}


# ------------------------------------------------------------------ звуки мультика
def boing() -> F32:
    """Пружинка «бвойнг»: подъём высоты + затухающее вибрато, мягкий тембр."""
    dur = 0.55
    t = _t(dur)
    f = 170 * (1 + 0.9 * (1 - np.exp(-t * 22))) * (1 + 0.22 * np.sin(2 * np.pi * 13 * t) * np.exp(-t * 4.5))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * _env(t, 0.004, 0.18)
    return _out(fft_filter(x, hi=3500), 0.85)


def hop() -> F32:
    """Заячий прыжок: короткая лёгкая «пружинка» выше и мягче, чем boing."""
    dur = 0.28
    t = _t(dur)
    f = 320 * (1 + 0.7 * (1 - np.exp(-t * 30))) * (1 + 0.12 * np.sin(2 * np.pi * 16 * t) * np.exp(-t * 8))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * _env(t, 0.003, 0.07)
    return _out(fft_filter(x, hi=4000), 0.8)


def thump() -> F32:
    """Мягкое приземление."""
    t = _t(0.16)
    x = _sweep(130, 60, 0.16, 5) * _env(t, 0.002, 0.045)
    x += 0.3 * fft_filter(_rng("thump").standard_normal(len(t)), hi=500) * _env(t, 0.001, 0.02)
    return _out(x, 0.85)


STEP_PITCH = {"benny": 1.15, "mia": 1.32, "ollie": 0.78, "dot": 1.02, "mama": 0.9}


@lru_cache(maxsize=64)
def footstep(char: str = "benny", variant: int = 0) -> F32:
    """Мультяшный мягкий шаг: низкий «топ» + тихий шорох; высота — по герою, 4 вариации (не «пулемёт»)."""
    p = STEP_PITCH.get(char, 1.0) * (1.0, 1.06, 0.95, 1.03)[variant % 4]
    dur = 0.12
    t = _t(dur)
    x = _sweep(150 * p, 85 * p, dur, 6) * _env(t, 0.002, 0.03)
    rng = _rng(f"step:{char}:{variant}")
    x += 0.35 * fft_filter(rng.standard_normal(len(t)), lo=400 * p, hi=2200 * p) * _env(t, 0.001, 0.012)
    return _out(x, 0.85)


def sparkle() -> F32:
    """Волшебный «звень-звень»: восходящие пинги пентатоники глокеншпиля + тихий шиммер."""
    dur = 1.3
    n = int(SR * dur)
    out = np.zeros(n)
    rng = _rng("sparkle")
    penta = [0, 2, 4, 7, 9]
    for k in range(9):
        nt = 84 + penta[k % 5] + 12 * (k // 5)
        at = int((k * 0.07 + rng.uniform(0, 0.02)) * SR)
        _add(out, mu.bar("glock", mu.midi_hz(nt), 0.3), at, 0.5 + 0.06 * k)
    t = _t(dur)
    out += 0.05 * fft_filter(rng.standard_normal(n), lo=7000, hi=14000) * np.sin(np.pi * np.minimum(t / 0.9, 1)) ** 2
    return _out(out, 0.8)


def chime() -> F32:
    """«Правильно!» — две ноты вверх (G5 → C6)."""
    out = np.zeros(int(SR * 1.4))
    _add(out, mu.bar("glock", mu.midi_hz(79), 0.3), 0, 0.8)
    _add(out, mu.bar("glock", mu.midi_hz(84), 0.6), int(0.13 * SR), 1.0)
    _add(out, mu.bar("marimba", mu.midi_hz(72), 0.3), int(0.13 * SR), 0.5)
    return _out(out, 0.8)


def splash() -> F32:
    """Лужа: шумовой «плюх» + разлетающиеся капельки."""
    dur = 0.7
    n = int(SR * dur)
    t = _t(dur)
    rng = _rng("splash")
    body = fft_filter(rng.standard_normal(n), lo=350, hi=4200) * _env(t, 0.004, 0.09)
    out = body
    for _ in range(9):
        at = int(rng.uniform(0.03, 0.45) * SR)
        f0 = rng.uniform(700, 1300)
        d = _sweep(f0, f0 * rng.uniform(1.6, 2.4), 0.05, 4) * _env(_t(0.05), 0.001, 0.015)
        _add(out, d, at, rng.uniform(0.2, 0.45))
    return _out(out, 0.8)


def clap() -> F32:
    return _out(mu.clap(1), 0.85)


def heart() -> F32:
    """«Блуп-блуп» — два мягких тёплых тона вверх (сердечки)."""
    out = np.zeros(int(SR * 0.5))
    for k, (f0, f1) in enumerate([(500, 760), (700, 1060)]):
        d = 0.16
        t = _t(d)
        ph = _sweep(f0, f1, d, 5)
        x = (ph + 0.2 * np.sin(2 * np.arcsin(np.clip(ph, -1, 1)))) * np.sin(np.pi * np.minimum(t / d, 1)) ** 1.5
        _add(out, x, int(k * 0.15 * SR), 1.0 - 0.15 * k)
    return _out(fft_filter(out, hi=3000), 0.8)


def snore() -> F32:
    """Мультяшный храп «хррр… фьюю»: вдох-рокот и выдох-свисток."""
    dur = 2.0
    n = int(SR * dur)
    t = _t(dur)
    rng = _rng("snore")
    rumble = fft_filter(rng.standard_normal(n), lo=120, hi=700) * (0.6 + 0.4 * np.tanh(3 * np.sin(2 * np.pi * 32 * t)))
    inhale = rumble * np.clip(t / 0.8, 0, 1) ** 1.5 * (t < 0.95) * np.clip((0.95 - t) / 0.08, 0, 1)
    k = np.clip((t - 1.0) / 0.8, 0, 1)
    f = 980 - 380 * k
    ex = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * k) ** 2 * (t >= 1.0)
    exn = fft_filter(rng.standard_normal(n), lo=600, hi=2500) * np.sin(np.pi * k) ** 2 * (t >= 1.0) * 0.15
    return _out(0.9 * inhale + 0.35 * ex + exn, 0.7)


def bell() -> F32:
    """Колокольчик с лёгким «биением»."""
    t = _t(2.0)
    f = 1174.7
    x = np.zeros_like(t)
    for r, a, d in [(1.0, 1.0, 1.2), (1.003, 0.6, 1.1), (2.0, 0.4, 0.7), (2.92, 0.22, 0.45), (4.2, 0.1, 0.25)]:
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d)
    return _out(x * np.minimum(t / 0.002, 1.0), 0.75)


def knock() -> F32:
    """«Тук-тук» в деревянную дверь."""
    out = np.zeros(int(SR * 0.5))
    for k in range(2):
        t = _t(0.12)
        x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in [(185, 1.0, 0.05), (430, 0.6, 0.025), (980, 0.25, 0.012)])
        x = np.asarray(x) + 0.4 * fft_filter(_rng(f"knock{k}").standard_normal(len(t)), lo=900, hi=4000) * _env(t, 0.0005, 0.004)
        _add(out, x, int(k * 0.19 * SR), 1.0 - 0.1 * k)
    return _out(out, 0.85)


def drumroll() -> F32:
    """Барабанная дробь с крещендо и финальным ударом."""
    dur = 1.9
    n = int(SR * dur)
    out = np.zeros(n)
    rng = _rng("drumroll")
    hit_t = 1.35
    k = 0
    while k / 24 < hit_t:
        at = k / 24 + rng.uniform(-0.004, 0.004)
        tt = _t(0.06)
        s = fft_filter(rng.standard_normal(len(tt)), lo=1200, hi=6000) * _env(tt, 0.0008, 0.018) + 0.5 * np.sin(2 * np.pi * 210 * tt) * _env(tt, 0.001, 0.02)
        _add(out, s, int(at * SR), 0.25 + 0.6 * (at / hit_t) ** 1.5)
        k += 1
    _add(out, mu.kick(), int(hit_t * SR), 1.4)
    _add(out, mu.shimmer(), int(hit_t * SR), 0.8)
    return _out(out, 0.85)


def notes() -> F32:
    """Нотки над головой: три весёлые ноты ксилофона."""
    out = np.zeros(int(SR * 0.9))
    for k, nt in enumerate((84, 88, 91)):
        _add(out, mu.bar("xylo", mu.midi_hz(nt), 0.2), int(k * 0.11 * SR), 0.9)
    return _out(out, 0.8)


def droplet() -> F32:
    """Капелька пота: «плинк»."""
    t = _t(0.15)
    return _out(_sweep(650, 1600, 0.15, 8) * _env(t, 0.001, 0.04), 0.8)


def exclaim() -> F32:
    """«!» — быстрый свисток вверх."""
    return _out(mu.whistle(1500, 0.14, glide_from=600, vib=0.0), 0.75)


def hmm() -> F32:
    """«?» над головой — два тона вопросом."""
    out = np.zeros(int(SR * 0.7))
    _add(out, mu.bar("marimba", mu.midi_hz(72), 0.2), 0, 0.9)
    _add(out, mu.whistle(mu.midi_hz(79), 0.22, glide_from=mu.midi_hz(74)), int(0.16 * SR), 0.6)
    return _out(out, 0.75)


def poof() -> F32:
    """Мягкий «пуф» облачком."""
    t = _t(0.45)
    x = fft_filter(_rng("poof").standard_normal(len(t)), lo=120, hi=1100) * _env(t, 0.006, 0.09)
    return _out(x, 0.8)


def uhoh() -> F32:
    """«Ой-ой»: две ноты маримбы вниз."""
    out = np.zeros(int(SR * 0.9))
    _add(out, mu.bar("marimba", mu.midi_hz(76), 0.3), 0, 1.0)
    _add(out, mu.bar("marimba", mu.midi_hz(72), 0.4), int(0.22 * SR), 0.95)
    return _out(out, 0.75)


def crunch() -> F32:
    """Укус яблока/печенья: «хрум» — три быстрых шумовых щелчка + низкий призвук."""
    out = np.zeros(int(SR * 0.3))
    rng = _rng("crunch")
    for k in range(3):
        t = _t(0.05)
        x = fft_filter(rng.standard_normal(len(t)), lo=1400, hi=6000) * _env(t, 0.0008, 0.012)
        x += 0.4 * np.sin(2 * np.pi * (240 - 40 * k) * t) * _env(t, 0.001, 0.02)
        _add(out, x, int((k * 0.045 + rng.uniform(0, 0.008)) * SR), 1.0 - 0.2 * k)
    return _out(out, 0.8)


@lru_cache(maxsize=4)
def nom(variant: int = 0) -> F32:
    """Мультяшное «ням»: мягкий закрытый «мм»-тон с подъёмом (жевание)."""
    d = 0.16
    t = _t(d)
    f0 = (210, 240, 190, 225)[variant % 4]
    ph = _sweep(f0, f0 * 1.35, d, 4)
    x = (ph + 0.3 * np.sin(2 * np.arcsin(np.clip(ph, -1, 1)))) * np.sin(np.pi * t / d) ** 2
    return _out(fft_filter(x, hi=1600), 0.75)


ONESHOTS: dict[str, Callable[[], F32]] = {
    "boing": boing, "hop": hop, "thump": thump, "pop": pop, "whoosh": whoosh, "sparkle": sparkle, "ding": ding, "chime": chime,
    "splash": splash, "clap": clap, "heart": heart, "snore": snore, "bell": bell, "knock": knock, "drumroll": drumroll,
    "notes": notes, "droplet": droplet, "exclaim": exclaim, "hmm": hmm, "poof": poof, "uhoh": uhoh, "tick": tick,
    "crunch": crunch, "nom": nom,
}


# ------------------------------------------------------------------ атмосферы (бесшовные лупы)
AMB_HOP = 512
AMB_SECONDS = 20.0


def _amb_n(seconds: float = AMB_SECONDS) -> int:
    return int(round(seconds * SR / AMB_HOP)) * AMB_HOP


def _periodic(tt: F64, period: float, harmonics: list[tuple[int, float, float]]) -> F64:
    """Плавная модуляция, периодичная по длине лупа: сумма гармоник (номер, амплитуда, фаза)."""
    return np.asarray(sum(a * np.sin(2 * np.pi * k * tt / period + p) for k, a, p in harmonics) if harmonics else np.zeros_like(tt), np.float64)


def _amb_out(x: F64, rms_db: float = -24.0) -> F32:
    """Атмосфера: без DC (круговой фильтр), громкость по RMS, пик ≤ 0.8; края лупа не трогаем."""
    x = fft_filter(x - float(np.mean(x)), lo=30, order=1, circular=True)
    rms = float(np.sqrt(np.mean(x**2))) or 1.0
    x = x * (10 ** (rms_db / 20) / rms)
    pk = float(np.abs(x).max())
    if pk > 0.8:
        x = mu.limit(x, ceiling=0.8, wrap=True)
    return np.asarray(x, np.float32)


def rain() -> F32:
    n = _amb_n()
    dur = n / SR

    def g(tt: F64, f: F64) -> F64:
        mod = 1 + 0.12 * _periodic(tt, dur, [(1, 1.0, 0.3), (3, 0.5, 1.9)])
        return np.asarray(mod * _band(f, 500, 9000, 1) / np.sqrt(np.maximum(f, 50) / 1000), np.float64)

    x = shaped_noise(n, g, 11)
    x /= float(np.sqrt(np.mean(x**2))) or 1.0
    rng = _rng("rain")
    tick_n = int(0.003 * SR)
    for _ in range(int(dur * 70)):  # капли по листьям/лужам
        at = int(rng.uniform(0, n))
        if rng.random() < 0.15:
            f0 = rng.uniform(1500, 3200)
            d = _sweep(f0, f0 * 1.5, 0.03, 4) * _env(_t(0.03), 0.0008, 0.01)
            _add(x, d, at, rng.uniform(0.3, 0.9), wrap=True)
        else:
            d = rng.standard_normal(tick_n) * np.exp(-np.arange(tick_n) / (0.0006 * SR))
            _add(x, d, at, rng.uniform(0.4, 1.4), wrap=True)
    return _amb_out(x, -24)


def wind() -> F32:
    n = _amb_n()
    dur = n / SR

    def g(tt: F64, f: F64) -> F64:
        gust = 0.55 + 0.45 * np.clip(_periodic(tt, dur, [(1, 0.7, 0.0), (2, 0.4, 2.1), (5, 0.2, 4.0)]), -1, 1)
        fc = 280 + 520 * gust
        return np.asarray(gust * np.exp(-0.5 * (np.log2(np.maximum(f, 20) / fc) / 1.1) ** 2), np.float64)

    return _amb_out(shaped_noise(n, g, 12), -25)


def _chirp(kind: str, rng: np.random.Generator) -> F64:
    if kind == "tweet":
        out = np.zeros(int(SR * 0.5))
        base = rng.uniform(2600, 3400)
        for k in range(int(rng.integers(2, 5))):
            d = rng.uniform(0.05, 0.08)
            c = _sweep(base, base * rng.uniform(1.25, 1.5), d, 2) * np.sin(np.pi * _t(d) / d) ** 2
            _add(out, c, int(k * 0.11 * SR), 1.0 - 0.1 * k)
        return out
    if kind == "trill":
        d = rng.uniform(0.25, 0.4)
        t = _t(d)
        f = rng.uniform(4200, 5200) + 300 * np.sin(2 * np.pi * 9 * t)
        am = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(22, 30) * t)
        return np.asarray(np.sin(2 * np.pi * np.cumsum(f) / SR) * am * np.sin(np.pi * t / d), np.float64)
    # «чи-рик»: два тона вниз с вибрато
    out = np.zeros(int(SR * 0.45))
    f0 = rng.uniform(2800, 3500)
    for k, (a, b) in enumerate([(1.0, 1.1), (0.85, 0.75)]):
        d = 0.12
        t = _t(d)
        f = np.linspace(f0 * a, f0 * b, len(t)) * (1 + 0.03 * np.sin(2 * np.pi * 40 * t))
        _add(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2, int(k * 0.17 * SR))
    return out


def birds() -> F32:
    n = _amb_n()
    dur = n / SR
    rng = _rng("birds")

    def g(tt: F64, f: F64) -> F64:  # тихий «воздух» сада
        return 0.12 * _band(f, 250, 2500, 1) * np.ones_like(tt)

    bed = shaped_noise(n, g, 13)
    bed /= float(np.sqrt(np.mean(bed**2))) or 1.0
    x = bed * 0.06
    t_at = 0.3
    while t_at < dur - 0.2:
        kind = ("tweet", "trill", "cheer")[int(rng.integers(0, 3))]
        c = _chirp(kind, rng)
        if rng.random() < 0.4:  # дальняя птица — тише и глуше
            c = fft_filter(c, hi=3500) * 0.5
        _add(x, c, int(t_at * SR), rng.uniform(0.25, 0.5), wrap=True)
        t_at += rng.uniform(0.9, 2.6)
    return _amb_out(x, -27)


def waves() -> F32:
    n = _amb_n()
    dur = n / SR
    period = dur / 3

    def g(tt: F64, f: F64) -> F64:
        ph = (tt % period) / period
        swell = np.where(ph < 0.35, np.sin(np.pi / 2 * ph / 0.35) ** 2, np.exp(-(ph - 0.35) * 4.0))
        fc = 350 + 1900 * swell
        lp = 1 / np.sqrt(1 + (f / fc) ** 4)
        foam = 0.25 * np.where(ph > 0.3, np.exp(-(ph - 0.3) * 6), 0) * _band(f, 2500, 9000, 1)
        return np.asarray((0.25 + swell) * lp * _band(f, 60, 20000, 1) + foam, np.float64)

    return _amb_out(shaped_noise(n, g, 14), -24)


def crickets() -> F32:
    n = _amb_n()
    dur = n / SR
    rng = _rng("crickets")

    def g(tt: F64, f: F64) -> F64:
        return 0.1 * _band(f, 80, 900, 1) * np.ones_like(tt)

    bed = shaped_noise(n, g, 15)
    x = bed / (float(np.sqrt(np.mean(bed**2))) or 1.0) * 0.05
    for c, (fr, rate, gain) in enumerate([(4400, 0.62, 0.5), (4850, 0.81, 0.32), (4100, 1.1, 0.22)]):
        pulse_d = 0.014
        tt = _t(pulse_d)
        pulse = np.sin(2 * np.pi * fr * tt) * np.sin(np.pi * tt / pulse_d) ** 2
        t_at = rng.uniform(0, rate)
        while t_at < dur:
            for p in range(int(rng.integers(3, 5))):
                _add(x, pulse, int((t_at + p * 0.032) * SR), gain * (0.8 + 0.2 * p / 3), wrap=True)
            t_at += rate * rng.uniform(0.9, 1.1)
        _ = c
    return _amb_out(fft_filter(x, hi=7000, circular=True), -29)


AMBIENCE: dict[str, Callable[[], F32]] = {"rain": rain, "wind": wind, "birds": birds, "waves": waves, "crickets": crickets}


# ------------------------------------------------------------------ кэш клипов по имени
@lru_cache(maxsize=128)
def clip(name: str) -> F32:
    """Звук по имени: 'boing', 'step:mia:2', 'amb:rain', 'theme', 'sting:yay:0', 'bg:sunny'."""
    parts = name.split(":")
    if parts[0] == "nom":
        return nom(int(parts[1]) if len(parts) > 1 else 0)
    if parts[0] == "step":
        return footstep(parts[1], int(parts[2]) if len(parts) > 2 else 0)
    if parts[0] == "amb":
        return AMBIENCE[parts[1]]()
    if parts[0] == "theme":
        return mu.theme_jingle()
    if parts[0] == "goodbye":
        return mu.theme_jingle("goodbye")
    if parts[0] == "sting":
        return mu.sting(parts[1], int(parts[2]) if len(parts) > 2 else 0)
    if parts[0] == "bg":
        return mu.bg_loop(parts[1])
    if name in ONESHOTS:
        return ONESHOTS[name]()
    if name in GENERATORS:
        return GENERATORS[name]()
    raise KeyError(name)


def ensure_sfx(data_dir: Path) -> list[Path]:
    """Старые звуки форматов роликов → /data/sfx (как раньше: генерируются, если файла нет)."""
    from .audio import write_wav  # лениво: модуль не тянет soundfile при импорте

    out = []
    for name, gen in GENERATORS.items():
        p = data_dir / "sfx" / f"{name}.wav"
        if not p.exists():
            write_wav(p, gen())
        out.append(p)
    return out


# ------------------------------------------------------------------ звуковые события по сценам CartoonDoc
@dataclass
class Ev:
    t: float  # глобальное время, с
    name: str
    gain: float
    bus: str = "sfx"
    duck: float = 1.0  # множитель громкости, пока звучит голос (1 — не приглушать)


@dataclass
class Bed:
    start: float
    dur: float
    name: str
    gain: float
    bus: str
    duck: float
    fade: float = 1.2


TRANSITIONS = ("cut", "fade", "iris", "wipe", "star", "bubble")
def _outdoor_locations() -> set[str]:
    """Уличные локации — из каталога (новые ферма/пруд/горка/кемпинг получают птиц, дождь и сверчков как улица)."""
    import json

    try:
        cat = json.loads(Path(__file__).with_name("cartoon_catalog.json").read_text(encoding="utf-8"))
        return {loc["id"] for loc in cat.get("locations", []) if loc.get("outdoor", True)}
    except (OSError, ValueError):
        return {"garden", "garden_evening", "playground", "beach", "forest"}


OUTDOOR = _outdoor_locations()
FX_SOUND = {"hearts": ("heart", 0.26), "sparkles": ("sparkle", 0.24), "zzz": ("snore", 0.3), "notes": ("notes", 0.22),
            "sweat": ("droplet", 0.22), "exclaim": ("exclaim", 0.2), "question": ("hmm", 0.24), "puff": ("poof", 0.3)}
WALK_SPEED = {"walk": 8.0, "run": 13.0, "tiptoe": 6.0}  # фаза шага = tl * speed (actions.ts); стопа встаёт на землю при фазе kπ (rig.tsx stepCycle)
STEP_GAIN = {"walk": 0.2, "run": 0.16, "tiptoe": 0.08}
HOP_PERIOD = 0.55  # actions.ts hop: присед 0–0.25, полёт до конца периода
JUMP_PERIOD = 0.8  # actions.ts: присед 0–0.15, полёт 0.15–0.85, приземление
CLAP_W = 11.0  # actions.ts: ладони вместе при sin(tl*11) = 1

# громкости (клипы нормированы по пику ~0.8–0.9; голос ≈ −20 dBFS RMS)
# стингеры тихие (не «орут»), фон под репликами −11 dB, атмосфера −6 dB; итог выравнивается до −14 LUFS / −1 dBTP
G_THEME, G_STORY, G_TRANSITION, G_QUESTION, G_YAY, G_WHOOSH = 0.5, 0.4, 0.18, 0.24, 0.28, 0.12
G_BG, G_SONG = 0.24, 0.52
DUCK_BG, DUCK_SONG, DUCK_AMB, DUCK_THEME = 0.28, 0.56, 0.5, 0.45
TARGET_LUFS, CEILING = -14.0, 0.87  # 0.87 ≈ −1.2 dBFS по сэмплам — запас под межсэмпловые пики (−1 dBTP)


def _world(sc: dict[str, Any]) -> tuple[str, str]:
    w = sc.get("world") or {}
    weather = str(sc.get("weather") or w.get("weather") or "clear")
    time_ = str(sc.get("time") or w.get("time") or ("evening" if sc.get("location") == "garden_evening" else "day"))
    return weather, time_


def ambience_for(sc: dict[str, Any]) -> list[tuple[str, float]]:
    """Атмосфера сцены по локации, погоде и времени суток (имя лупа, громкость)."""
    loc = str(sc.get("location") or "")
    weather, time_ = _world(sc)
    out_ = loc in OUTDOOR
    beds: list[tuple[str, float]] = []
    if weather == "rain":
        beds.append(("rain", 0.55 if out_ else 0.2))
    elif weather == "snow":
        beds.append(("wind", 0.28 if out_ else 0.1))
    elif weather in ("windy", "leaves"):
        beds.append(("wind", 0.4 if out_ else 0.12))
    if loc == "beach":
        beds.append(("waves", 0.5))
    if out_ and weather != "rain":
        if time_ == "night":
            beds.append(("crickets", 0.45))
        elif time_ == "evening":
            beds.append(("crickets", 0.3))
        else:
            beds.append(("birds", {"forest": 0.55, "playground": 0.3, "beach": 0.2}.get(loc, 0.42)))
        if loc == "forest" and weather == "clear":
            beds.append(("wind", 0.14))
    elif not out_ and time_ == "night":
        beds.append(("crickets", 0.12))
    return beds


def bg_variant(sc: dict[str, Any]) -> str:
    loc = str(sc.get("location") or "")
    _, time_ = _world(sc)
    if time_ == "night" or loc == "bedroom":
        return "lullaby"
    if loc == "playground":
        return "playful"
    if loc in ("living_room", "kitchen") or time_ == "evening":
        return "cozy"
    return "sunny"


def _segments(keys: list[dict[str, Any]], dur: float) -> list[tuple[float, float, str]]:
    """Отрезки действий актёра (как Episode.actorAt: последнее действие до t)."""
    acts = sorted(((float(k.get("t", 0)), i, str(k["action"])) for i, k in enumerate(keys) if k.get("action")), key=lambda a: (a[0], a[1]))
    out = []
    for j, (t0, _, a) in enumerate(acts):
        t1 = acts[j + 1][0] if j + 1 < len(acts) else dur
        if t1 > t0:
            out.append((t0, min(t1, dur), a))
    return out


def transition_for(scenes: list[dict[str, Any]], i: int) -> str:
    """Python-копия transitions.tsx → transitionFor: переход на входе в сцену i (cut / fade / iris / wipe / star / bubble)."""
    sc = scenes[i]
    if sc.get("transitionIn") in TRANSITIONS:
        return str(sc["transitionIn"])
    kind = sc.get("kind")
    if i == 0:
        return "cut" if kind == "intro" else "fade"
    prev = scenes[i - 1]
    if kind == "intro":
        return "fade"
    if kind == "outro":
        return "iris"
    if kind == "bumper":
        return "star"
    if kind == "title":
        return "wipe" if prev.get("kind") == "bumper" else "star"
    if kind == "song":
        return "bubble"
    if prev.get("location") == sc.get("location") and prev.get("kind") != "song":
        return "fade"
    return "wipe" if i % 2 == 0 else "iris"


def scene_events(scenes: list[dict[str, Any]]) -> tuple[list[Ev], list[Bed]]:
    """Разовые звуки и подложки (фон-музыка, атмосфера) по сценам эпизода. Детерминировано.

    intro → тема «Benny and Friends»; bumper («Story time!» / «Song time!») → короткий весёлый хук темы;
    outro → прощальная версия темы под рассказчиком (её кладёт mix_cartoon и продлевает сцену); переходы
    iris / wipe / star / bubble → мягкий «вжух» (iris — на сжатии круга в конце прошлой сцены)."""
    evs: list[Ev] = []
    beds: list[Bed] = []
    last_yay = -99.0
    trans_i = 0
    bump_i = 0
    for si, sc in enumerate(scenes):
        S = float(sc.get("start", 0))
        D = float(sc.get("duration", 0))
        kind = sc.get("kind") or "story"
        tr = transition_for(scenes, si)
        if tr in ("iris", "wipe", "star", "bubble") and si:
            evs.append(Ev(max(0.0, S - (0.35 if tr == "iris" else 0.05)), "whoosh", G_WHOOSH, duck=0.8))
        if kind == "intro":
            evs.append(Ev(S, "theme", G_THEME, "music", DUCK_THEME))
            continue
        if kind == "bumper":
            evs.append(Ev(S + 0.15, f"sting:story:{bump_i}", G_STORY, "music", 0.6))
            bump_i += 1
            continue
        if kind in ("song", "outro"):
            continue  # у песни своя подложка; прощание — в mix_cartoon
        if kind == "story" and tr in ("wipe", "iris") and si and scenes[si - 1].get("kind") in ("story", "song"):
            evs.append(Ev(max(0.0, S - 0.05), f"sting:transition:{trans_i % 3}", G_TRANSITION, "music", 1.0))  # новая локация — тихая музыкальная связка
            trans_i += 1
        # фон-музыка (и под заставкой истории) и атмосфера (склеиваются с соседними одинаковыми сценами в mix_cartoon)
        beds.append(Bed(S, D, f"bg:{bg_variant(sc)}", G_BG, "music", DUCK_BG, 1.5))
        if kind == "title":
            continue
        for name, g in ambience_for(sc):
            beds.append(Bed(S, D, f"amb:{name}", g, "sfx", DUCK_AMB, 1.0))
        scene_yay = False
        last_uhoh = -99.0
        for actor in sc.get("actors") or []:
            ch = str(actor.get("id") or "")
            keys = list(actor.get("keys") or [])
            for t0, t1, a in _segments(keys, D):
                if a in WALK_SPEED:
                    sp = WALK_SPEED[a]
                    if a == "run":
                        evs.append(Ev(S + t0, "whoosh", 0.14, duck=0.7))
                    k = 1
                    while t0 + k * math.pi / sp < t1 - 0.03:
                        evs.append(Ev(S + t0 + k * math.pi / sp, f"step:{ch}:{k % 4}", STEP_GAIN[a], duck=0.75))
                        k += 1
                elif a == "jump":
                    for k in range(3):
                        up = t0 + 0.12 + JUMP_PERIOD * k
                        if up >= t1:
                            break
                        evs.append(Ev(S + up, "boing", 0.3 * (1.0, 0.75, 0.6)[k], duck=0.8))
                        if t0 + 0.68 + JUMP_PERIOD * k < t1:
                            evs.append(Ev(S + t0 + 0.68 + JUMP_PERIOD * k, f"step:{ch}:{k % 4}", 0.14, duck=0.8))
                elif a == "hop":
                    for k in range(4):
                        up = t0 + 0.25 * HOP_PERIOD + HOP_PERIOD * k
                        if up >= t1:
                            break
                        evs.append(Ev(S + up, "hop", 0.22 * (1.0, 0.8, 0.7, 0.6)[k], duck=0.8))
                elif a == "spin":
                    evs.append(Ev(S + t0 + 0.15, "whoosh", 0.12, duck=0.8))
                elif a == "high_five" and t0 + 0.47 < t1:
                    evs.append(Ev(S + t0 + 0.47, "clap", 0.24, duck=0.85))
                elif a == "clap":
                    k = 0
                    while k < 8 and t0 + (math.pi / 2 + 2 * math.pi * k) / CLAP_W < t1:
                        evs.append(Ev(S + t0 + (math.pi / 2 + 2 * math.pi * k) / CLAP_W, "clap", 0.2, duck=0.8))
                        k += 1
                elif a == "cheer" and not scene_yay and S + t0 - last_yay > 20:
                    evs.append(Ev(S + t0 + 0.1, f"sting:yay:{len(evs) % 3}", G_YAY, "music", 0.7))
                    scene_yay, last_yay = True, S + t0
                elif a == "scared" and S + t0 - last_uhoh > 8:
                    evs.append(Ev(S + t0 + 0.05, "uhoh", 0.2, duck=0.8))
                    last_uhoh = S + t0
                elif a == "eat":  # «ням-ням» после укуса (сам укус — по состоянию предмета bitten)
                    for k in range(3):
                        if t0 + 0.95 + 0.38 * k < t1:
                            evs.append(Ev(S + t0 + 0.95 + 0.38 * k, f"nom:{k}", 0.16, duck=0.85))
            for k in keys:
                if "fx" in k and k["fx"] in FX_SOUND:
                    name, g = FX_SOUND[k["fx"]]
                    evs.append(Ev(S + float(k.get("t", 0)), name, g, duck=0.8))
                if "hold" in k:  # старый формат (до предметов сцены)
                    evs.append(Ev(S + float(k.get("t", 0)), "pop", 0.22 if k["hold"] else 0.12, duck=0.85))
        for it in sc.get("items") or []:  # предметы: передать / бросить (полёт 0.75 с) / уронить / укусить
            for k in it.get("keys") or []:
                t = S + float(k.get("t", 0))
                anim = k.get("anim")
                if anim == "pass":
                    evs.append(Ev(t + 0.4, "pop", 0.2, duck=0.85))
                elif anim == "throw":
                    evs.append(Ev(t, "whoosh", 0.16, duck=0.8))
                    evs.append(Ev(t + 0.75, "pop", 0.24, duck=0.85))
                elif anim == "drop":
                    evs.append(Ev(t + 0.38, "thump", 0.16, duck=0.85))
                elif anim == "float_away":
                    evs.append(Ev(t, "exclaim", 0.14, duck=0.85))
                if k.get("state") == "bitten":
                    evs.append(Ev(t, "crunch", 0.22, duck=0.85))
        for ov in sc.get("overlays") or []:
            t = S + float(ov.get("t", 0))
            if ov.get("kind") == "word":
                evs.append(Ev(t, "ding", 0.22, duck=0.85))
            elif ov.get("kind") == "question":
                evs.append(Ev(t, "sting:question:0", G_QUESTION, "music", 1.0))
                evs.append(Ev(t + float(ov.get("dur", 2.8)) - 0.1, "chime", 0.2, duck=0.9))
    evs.sort(key=lambda e: (e.t, e.name))
    out: list[Ev] = []
    for e in evs:  # один и тот же звук в один момент (два героя дают «пять») — один раз, не двойная громкость
        if out and out[-1].name == e.name and e.t - out[-1].t < 0.02:
            continue
        out.append(e)
    return out, beds


def merge_beds(beds: list[Bed], gap: float = 0.05) -> list[Bed]:
    """Склейка одинаковых подложек соседних сцен — луп играет непрерывно, без перезапуска."""
    out: list[Bed] = []
    for b in sorted(beds, key=lambda b: (b.name, b.start)):
        if out and out[-1].name == b.name and b.start - (out[-1].start + out[-1].dur) <= gap and abs(out[-1].gain - b.gain) < 1e-6:
            out[-1].dur = b.start + b.dur - out[-1].start
        else:
            out.append(Bed(b.start, b.dur, b.name, b.gain, b.bus, b.duck, b.fade))
    return sorted(out, key=lambda b: b.start)


# ------------------------------------------------------------------ сведение
def speech_gain(c: F64 | F32, target_db: float = -14.5) -> float:
    """Множитель, выравнивающий громкость реплики: RMS речи (активные кадры) → target (пики потом срезает лимитер)."""
    a = np.asarray(c, np.float64)
    if not len(a):
        return 1.0
    hop = 1024
    n = len(a) // hop
    if n < 1:
        rms = float(np.sqrt(np.mean(a**2)))
    else:
        fr = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
        act = fr[fr > fr.max() * 0.18]
        rms = float(np.sqrt(np.mean(act**2))) if len(act) else float(fr.max())
    if rms <= 1e-6:
        return 1.0
    return float(np.clip(10 ** (target_db / 20) / rms, 0.25, 6.0))


@dataclass
class _Pl:
    start: int
    end: int
    data: F32
    gain: float
    duck: float
    loop: bool = False
    fade_in: int = 0
    fade_out: int = 0


def _k_weight(x: F64) -> F64:
    """Приближение K-взвешивания BS.1770 в частотной области: срез < 38 Гц + полка до +4 dB на высоких."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    shelf = 1 + (10 ** (4 / 20) - 1) * f**2 / (f**2 + 2458.0**2)  # +0.69 dB на 1 кГц (997 Гц, 0 dBFS → −3.01 LUFS)
    hp = 1 / np.sqrt(1 + (38.0 / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(np.fft.rfft(x) * shelf * hp, n)


def _k_block_powers(x: F64, block: float = 0.4) -> list[float]:
    """Средняя мощность K-взвешенного сигнала по блокам 400 мс (для интегральной громкости)."""
    if not len(x):
        return []
    y = _k_weight(np.asarray(x, np.float64))
    bn = int(block * SR)
    nb = len(y) // bn
    if nb == 0:
        return [float(np.mean(y**2))]
    return [float(v) for v in (y[: nb * bn].reshape(nb, bn) ** 2).mean(axis=1)]


def integrated_lufs(powers: list[float]) -> float:
    """Интегральная громкость с гейтами −70 LUFS (абсолютный) и −10 LU (относительный), как в BS.1770."""
    p = np.asarray(powers, np.float64)
    if not len(p):
        return -70.0
    lk = -0.691 + 10 * np.log10(p + 1e-15)
    p = p[lk > -70]
    if not len(p):
        return -70.0
    rel = -0.691 + 10 * math.log10(float(p.mean())) - 10
    p2 = p[-0.691 + 10 * np.log10(p + 1e-15) > rel]
    return -0.691 + 10 * math.log10(float((p2 if len(p2) else p).mean()))


LIM_BLK = 64


def master_gain(x: F64, ceiling: float = CEILING, release: float = 0.15) -> F64:
    """Кривая общего лимитера (по сэмплам): блочные пики → минимум по окну (просмотр вперёд) → сглаживание.
    Сглаженная кривая нигде не выше нужной — перегруза нет; блочная сетка от начала отрезка."""
    n = len(x)
    if n == 0:
        return np.ones(0)
    nb = -(-n // LIM_BLK)
    a = np.zeros(nb * LIM_BLK)
    a[:n] = np.abs(x)
    env = a.reshape(nb, LIM_BLK).max(axis=1)
    if float(env.max()) <= ceiling:
        return np.ones(n)
    g = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    r = max(1, int(release * SR / LIM_BLK / 4))
    g = mu._sliding(mu._sliding(g, r, "min", False), r, "mean", False)
    # непрерывная кусочно-линейная кривая по границам блоков: на границе — минимум соседей, значит внутри блока ≤ его g
    edges = np.minimum(np.concatenate([[g[0]], g]), np.concatenate([g, [g[-1]]]))
    return np.interp(np.arange(n), np.arange(nb + 1) * LIM_BLK, edges)


class Mixer:
    """Три шины (voice / music / sfx) → три WAV-стема одинаковой длины; рендер блоками, общий лимитер по сумме."""

    CTRL = 100  # Гц — частота огибающей дакинга

    def __init__(self, total: float) -> None:
        self.total = total
        self.n = int(math.ceil(total * SR))
        self.buses: dict[str, list[_Pl]] = {"voice": [], "music": [], "sfx": []}
        self.spans: list[tuple[float, float]] = []

    def add(self, bus: str, data: F32, at: float, gain: float = 1.0, duck: float = 1.0) -> None:
        s = int(round(at * SR))
        if gain <= 0 or not len(data) or s >= self.n:
            return
        self.buses[bus].append(_Pl(s, min(self.n, s + len(data)), data, gain, duck))

    def voice(self, data: F32, at: float, wet: float = 0.0) -> None:
        """Реплика: выравнивание громкости; wet — немного реверба (вокал в песнях)."""
        x = np.asarray(data, np.float64)
        x = x * speech_gain(x)
        if wet > 0 and len(x):
            x = np.concatenate([x, np.zeros(int(0.6 * SR))])
            x = (x + wet * mu.reverb(x, 1.1)) * 0.92
        if len(x):
            x = mu.limit(x, ceiling=0.82, release=0.06)  # ровная громкость: пики речи — мягким лимитером, не общим уровнем
        self.add("voice", np.asarray(x, np.float32), at, 1.0)
        self.spans.append((at, at + len(data) / SR))

    def loop(self, bus: str, data: F32, start: float, dur: float, gain: float, duck: float = 1.0, fade: float = 1.0) -> None:
        s = max(0, int(round(start * SR)))
        e = min(self.n, int(round((start + dur) * SR)))
        if e - s < SR // 4 or gain <= 0:
            return
        f = min(int(fade * SR), (e - s) // 2)
        self.buses[bus].append(_Pl(s, e, data, gain, duck, True, f, f))

    def _duck_ctrl(self) -> F64:
        m = int(math.ceil(self.total * self.CTRL)) + 2
        ctrl = np.zeros(m)
        merged: list[list[float]] = []
        for a, b in sorted(self.spans):
            if merged and a - merged[-1][1] < 0.9:  # короткие паузы между репликами — музыка не «качается»
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        for a, b in merged:
            ctrl[max(0, int((a - 0.12) * self.CTRL)) : min(m, int((b + 0.3) * self.CTRL) + 1)] = 1.0
        k = int(0.12 * self.CTRL)
        return np.asarray(mu._sliding(ctrl, k, "mean", False))

    def _chunk(self, a: int, b: int, ctrl: F64, ctrl_t: F64) -> dict[str, F64]:
        """Шины на отрезке сэмплов [a, b)."""
        duck_s = np.interp(np.arange(a, b) / SR, ctrl_t, ctrl)
        out: dict[str, F64] = {}
        for bus, pls in self.buses.items():
            buf = np.zeros(b - a)
            for pl in pls:
                if pl.end <= a or pl.start >= b:
                    continue
                s, e = max(a, pl.start), min(b, pl.end)
                if pl.loop:
                    rel = np.arange(s, e) - pl.start
                    seg = pl.data[rel % len(pl.data)].astype(np.float64)
                    if pl.fade_in:
                        seg *= np.clip(rel / pl.fade_in, 0, 1) ** 2
                    if pl.fade_out:
                        seg *= np.clip((pl.end - np.arange(s, e)) / pl.fade_out, 0, 1) ** 2
                else:
                    seg = pl.data[s - pl.start : e - pl.start].astype(np.float64)
                g = pl.gain if pl.duck >= 1 else pl.gain * (1 - (1 - pl.duck) * duck_s[s - a : e - a])
                buf[s - a : e - a] += seg * g
            out[bus] = buf
        return out

    def render(self, paths: dict[str, Path] | None, gain: float = 1.0, chunk: float = 20.0) -> dict[str, dict[str, float]]:
        """Рендер блоками. paths=None — только замер. gain — мастер-усиление перед общим лимитером: кривая лимитера
        считается по СУММЕ и применяется ко всем стемам одинаково (сумма стемов = залимитированный мастер). Блоки
        считаются с запасом по краям, сетка лимитера общая — стыков между блоками нет."""
        ctrl = self._duck_ctrl()
        ctrl_t = np.arange(len(ctrl)) / self.CTRL
        writers: dict[str, wave.Wave_write] = {}
        for bus, p in (paths or {}).items():
            p.parent.mkdir(parents=True, exist_ok=True)
            w = wave.open(str(p), "wb")
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            writers[bus] = w
        stats = {b: {"peak": 0.0, "sumsq": 0.0} for b in self.buses}
        sum_peak = 0.0
        limited = 0
        lufs_blocks: list[float] = []
        cn = int(chunk * SR) // LIM_BLK * LIM_BLK
        margin = 64 * LIM_BLK  # ≈ 0.09 с > радиуса сглаживания лимитера
        try:
            for c0 in range(0, self.n, cn):
                c1 = min(self.n, c0 + cn)
                a, b = max(0, c0 - margin), min(self.n, c1 + margin)
                out = self._chunk(a, b, ctrl, ctrl_t)
                mix = (out["voice"] + out["music"] + out["sfx"]) * gain
                g = master_gain(mix, CEILING)
                sl = slice(c0 - a, c1 - a)
                limited += int(np.sum(g[sl] < 0.999))
                res_out = {bus: np.clip(x[sl] * gain * g[sl], -0.98, 0.98) for bus, x in out.items()}
                mix_c = res_out["voice"] + res_out["music"] + res_out["sfx"]
                sum_peak = max(sum_peak, float(np.abs(mix_c).max(initial=0.0)))
                lufs_blocks += _k_block_powers(mix_c)
                for bus, x in res_out.items():
                    stats[bus]["peak"] = max(stats[bus]["peak"], float(np.abs(x).max(initial=0.0)))
                    stats[bus]["sumsq"] += float(np.sum(x**2))
                    if bus in writers:
                        writers[bus].writeframes(np.round(x * 32767).astype("<i2").tobytes())
        finally:
            for w in writers.values():
                w.close()
        res = {b: {"peak": round(s["peak"], 4), "rms_db": round(10 * math.log10(s["sumsq"] / max(1, self.n) + 1e-12), 1)} for b, s in stats.items()}
        res["mix"] = {"peak": round(sum_peak, 4), "limited_pct": round(100 * limited / max(1, self.n), 2), "lufs": round(integrated_lufs(lufs_blocks), 2)}
        return res


def mix_cartoon(scenes: list[dict[str, Any]], clips: list[tuple[float, Any]], songs: list[dict[str, Any]], total: float,
                out_dir: Path, url_base: str) -> tuple[list[dict[str, Any]], float, dict[str, Any]]:
    """Сводит эпизод в три стема (voices / music / sfx). Возвращает (doc.audio, новая длительность, статистика).

    В сцене outro («Bye bye!») под прощанием рассказчика звучит прощальная версия темы — сцена продлевается под неё.
    Громкость: замер → мастер-усиление до −14 LUFS → общий лимитер (−1 dBTP) → контрольный замер и поправка → запись."""
    evs, beds = scene_events(scenes)
    end_total = total
    if scenes and scenes[-1].get("kind") == "outro":
        last = scenes[-1]
        S = float(last.get("start", 0))
        at = 0.3  # под прощание рассказчика (приглушается под репликой), финальный аккорд — уже в тишине
        need = at + mu.theme_length("goodbye") + 1.4
        if need > float(last.get("duration", 0)):
            last["duration"] = round(need, 3)
            end_total = round(S + need, 3)
        evs.append(Ev(S + at, "goodbye", G_THEME, "music", DUCK_THEME))
    song_spans = [(float(s["start"]), float(s["start"]) + float(s["dur"])) for s in songs]
    m = Mixer(end_total + 0.5)
    for at, c in clips:
        sung = any(a - 0.1 <= at < b for a, b in song_spans)
        m.voice(np.asarray(c, np.float32), float(at), wet=0.16 if sung else 0.0)
    for s in songs:
        m.add("music", mu.render_song(s["plan"]), float(s["start"]), G_SONG, DUCK_SONG)
    for b in merge_beds(beds):
        m.loop(b.bus, clip(b.name), b.start, b.dur, b.gain, b.duck, b.fade)
    for e in evs:
        m.add(e.bus, clip(e.name), e.t, e.gain, e.duck)
    raw = m.render(None, gain=1.0)["mix"]["lufs"]
    g = float(np.clip(10 ** ((TARGET_LUFS - raw) / 20), 0.25, 4.0)) if raw > -69 else 1.0
    lim = m.render(None, gain=g)["mix"]["lufs"]  # лимитер чуть «съедает» громкость — одна поправка
    g *= float(np.clip(10 ** ((TARGET_LUFS - lim) / 20), 1.0, 1.5)) if lim > -69 else 1.0
    stats = m.render({"voice": out_dir / "voices.wav", "music": out_dir / "music.wav", "sfx": out_dir / "sfx.wav"}, gain=g)
    stats["mix"]["gain_db"] = round(20 * math.log10(g), 2)
    audio = [{"src": f"{url_base}/{name}.wav", "start": 0, "volume": 1} for name in ("voices", "music", "sfx")]
    return audio, end_total, {"events": len(evs), "beds": len(beds), **stats}
