"""Процедурная музыка: собственная генерация → CC0, без риска Content ID и страйков.

Чистый numpy (без scipy): инструменты — укулеле (Karplus-Strong), маримба, ксилофон, глокеншпиль, электропиано (FM),
мягкий бас, «свисток»-мелодия; перкуссия — мягкая бочка, хлопки, шейкер, бубен, вуд-блок. Мастеринг — FFT-фильтры,
реверб свёрткой, «клеящая» компрессия и пиковый лимитер с просмотром вперёд.

Что есть:
- `render(Track)` — бесшовные лупы для уроков (TRACKS, /data/music);
- `bg_loop(variant)` — мягкий фон мультика под диалоги (sunny / cozy / playful / lullaby), бесшовный луп;
- `render_song(SongPlan)` — подложка песенки на сетке тактов: вступление-хук, куплеты, припевы, концовка «та-да»,
  ответные мелодические фразы в паузах между строками вокала;
- `theme_jingle()` — заставка «Benny and Friends» (~7 с), `sting(kind)` — переходы, «вопрос», «ура», заставка истории.
Всё детерминировано: одинаковые входы → одинаковые сэмплы.
"""
from __future__ import annotations

import zlib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

SR = 44100
F32 = NDArray[np.float32]
F64 = NDArray[np.float64]
NOTE = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
MAJOR = [0, 2, 4, 5, 7, 9, 11]


# ------------------------------------------------------------------ DSP
def _t(n: int) -> F64:
    return np.arange(n, dtype=np.float64) / SR


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


_midi_hz = midi_hz  # совместимость со старым именем


def fft_filter(x: F64, lo: float = 0.0, hi: float = 0.0, order: int = 2, circular: bool = False) -> F64:
    """Фильтр с АЧХ Баттерворта в частотной области (нулевая фаза). circular — для лупов (хвост заворачивается)."""
    n = len(x)
    if n == 0:
        return np.asarray(x, np.float64)
    m = n if circular else n + min(8192, n)
    f = np.fft.rfftfreq(m, 1 / SR)
    h = np.ones_like(f)
    if hi:
        h /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        h /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(np.fft.rfft(x, m) * h, m)[:n]


def _sliding(a: F64, k: int, op: str, wrap: bool) -> F64:
    """Скользящий max/min/mean окна 2k+1 (k маленькое — по блокам)."""
    if k <= 0:
        return a
    p = np.pad(a, k, mode="wrap" if wrap else "edge")
    if op == "mean":
        c = np.cumsum(np.concatenate([[0.0], p]))
        return np.asarray((c[2 * k + 1 :] - c[: -2 * k - 1]) / (2 * k + 1), np.float64)
    out = p[k : k + len(a)].copy()
    fn = np.maximum if op == "max" else np.minimum
    for s in range(-k, k + 1):
        if s:
            fn(out, p[k + s : k + s + len(a)], out=out)
    return out


def limit(x: F64, ceiling: float = 0.89, release: float = 0.12, wrap: bool = False) -> F64:
    """Пиковый лимитер с просмотром вперёд: блочная огибающая → минимум по окну → сглаживание (никогда не выше нужного)."""
    blk = 64
    n = len(x)
    if n == 0:
        return x
    nb = -(-n // blk)
    a = np.zeros(nb * blk)
    a[:n] = np.abs(x)
    env = a.reshape(nb, blk).max(axis=1)
    g = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    r = max(1, int(release * SR / blk / 2))
    g = _sliding(_sliding(g, r, "min", wrap), r, "mean", wrap)
    centers = (np.arange(nb) + 0.5) * blk
    gs = np.interp(np.arange(n), centers, g, period=n if wrap else None)
    return np.clip(x * gs, -ceiling, ceiling)


def compress(x: F64, threshold: float = 0.25, ratio: float = 2.5, window: float = 0.05, wrap: bool = False) -> F64:
    """Мягкая «клеящая» компрессия по RMS-огибающей (без резких скачков)."""
    blk = 256
    n = len(x)
    if n == 0:
        return x
    nb = -(-n // blk)
    a = np.zeros(nb * blk)
    a[:n] = x
    rms = np.sqrt((a.reshape(nb, blk) ** 2).mean(axis=1) + 1e-12)
    rms = _sliding(rms, max(1, int(window * SR / blk)), "mean", wrap)
    over = np.maximum(rms / threshold, 1.0)
    g = over ** (1 / ratio - 1)
    g = _sliding(g, max(1, int(window * SR / blk)), "mean", wrap)
    centers = (np.arange(nb) + 0.5) * blk
    return x * np.interp(np.arange(n), centers, g, period=n if wrap else None)


@lru_cache(maxsize=8)
def _ir(decay: float = 1.3, seed: int = 7) -> F64:
    """Импульсная характеристика «уютной комнаты»: ранние отражения + темнеющий шумовой хвост."""
    n = int(SR * decay)
    t = _t(n)
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(n)
    bright = fft_filter(noise, lo=250, hi=7000)
    dark = fft_filter(noise, lo=200, hi=1800)
    mixk = np.minimum(t / (decay * 0.6), 1.0)
    ir = (bright * (1 - mixk) + dark * mixk) * np.exp(-6.9 * t / decay)
    ir[: int(0.014 * SR)] = 0.0  # пред-задержка
    for d, a in [(0.007, 0.5), (0.011, 0.35), (0.017, 0.3), (0.023, 0.22)]:
        ir[int(d * SR)] += a * 6
    ir /= np.sqrt(np.sum(ir**2))
    return np.asarray(ir, np.float64)


def reverb(x: F64, decay: float = 1.3, circular: bool = False) -> F64:
    """Только «мокрый» сигнал реверба той же длины (circular — хвост заворачивается в начало лупа)."""
    ir = _ir(decay)
    n = len(x)
    m = n + len(ir)
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)
    out = y[:n].copy()
    if circular:
        tail = y[n:]
        for s in range(0, len(tail), n):
            seg = tail[s : s + n]
            out[: len(seg)] += seg
    return out


def _env(n: int, attack: float, tau: float, release: float = 0.0, hold: float | None = None) -> F64:
    """Атака → экспоненциальное затухание (tau, с); если задан hold — затухание до конца ноты и быстрый релиз."""
    t = _t(n)
    e = np.minimum(t / max(attack, 1e-4), 1.0) * np.exp(-t / tau)
    if hold is not None and release > 0:
        e *= np.clip((hold + release - t) / release, 0.0, 1.0)
    return np.asarray(e, np.float64)


def _fade_edges(x: F64, a: float = 0.003, r: float = 0.02) -> F64:
    n = len(x)
    if n == 0:
        return x
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    x[: min(na, n)] *= np.linspace(0, 1, min(na, n))
    x[-min(nr, n) :] *= np.linspace(1, 0, min(nr, n))
    return x


# ------------------------------------------------------------------ инструменты (каждая нота — float64 массив с хвостом)
@lru_cache(maxsize=512)
def _ks_cached(f: float, dur: float, bright: float, seed: int) -> F64:
    """Укулеле/гитара: Karplus-Strong блоками по периоду (векторно), затем точная подстройка высоты ресемплом."""
    n = int(SR * dur)
    period = SR / f
    N = max(4, int(period - 0.5))
    rng = np.random.default_rng(seed)
    # начальная форма струны: треугольник (щипок пальцем в точке p) + немного шума — сильная основная, живая атака
    p = 0.22 + 0.04 * seed
    xs = np.arange(N) / N
    tri = np.where(xs < p, xs / p, (1 - xs) / (1 - p))
    exc = tri - tri.mean() + (0.15 + 0.35 * bright) * rng.uniform(-1, 1, N)
    k = 1 + int((1 - bright) * 4)
    exc = np.convolve(np.concatenate([exc, exc, exc]), np.ones(k) / k, "same")[N : 2 * N]
    exc -= exc.mean()
    exc /= float(np.abs(exc).max()) or 1.0
    t60 = float(np.clip(2.2 * (220.0 / f) ** 0.45, 0.6, 3.0))
    rho = 10 ** (-3 / (f * t60))
    m = int(n * 1.03) + 2 * N + 2
    buf = np.zeros(m + 1)
    buf[1 : N + 1] = exc
    i = N + 1
    while i < m + 1:
        j = min(i + N, m + 1)
        buf[i:j] = rho * 0.5 * (buf[i - N : j - N] + buf[i - N - 1 : j - N - 1])
        i = j
    y = buf[1:]
    ratio = f / (SR / (N + 0.5))
    pos = np.arange(n) * ratio
    out = np.interp(pos, np.arange(len(y)), y)
    out = fft_filter(out, lo=90, hi=3500 + 4000 * bright)
    return _fade_edges(out, 0.001, 0.03)


def pluck(f: float, dur: float, bright: float = 0.5, seed: int = 0) -> F64:
    return _ks_cached(round(f, 3), round(dur, 2), round(bright, 2), seed % 4)


@lru_cache(maxsize=512)
def _bar_cached(kind: str, f: float, dur: float) -> F64:
    """Ударные «пластинки»: маримба (1:4:10), ксилофон (1:3:6), глокеншпиль (неграмоничные 1:2.76:5.4:8.93), музыкальная шкатулка."""
    if kind == "marimba":
        parts = [(1.0, 1.0, 1.0), (3.93, 0.22, 0.25), (9.2, 0.05, 0.08)]
        tau = float(np.clip(0.42 * (440 / f) ** 0.5, 0.15, 0.9))
    elif kind == "xylo":
        parts = [(1.0, 1.0, 1.0), (3.0, 0.3, 0.35), (6.0, 0.08, 0.15)]
        tau = float(np.clip(0.2 * (440 / f) ** 0.4, 0.08, 0.35))
    elif kind == "box":
        parts = [(1.0, 1.0, 1.0), (2.0, 0.25, 0.5), (4.1, 0.12, 0.2)]
        tau = 0.7
    else:  # glock
        parts = [(1.0, 1.0, 1.0), (2.76, 0.35, 0.4), (5.4, 0.15, 0.2), (8.93, 0.06, 0.1)]
        tau = 1.3
    n = int(SR * (dur + 5 * tau))
    n = min(n, int(SR * 3.5))
    t = _t(n)
    out = np.zeros(n)
    for r, a, tk in parts:
        if f * r < SR / 2.2:
            out += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (tau * tk))
    out *= np.minimum(t / 0.0015, 1.0)
    rng = np.random.default_rng(int(f))
    nc = int(0.004 * SR)
    click = rng.standard_normal(nc) * np.exp(-np.arange(nc) / (0.0008 * SR))
    out[:nc] += 0.04 * fft_filter(click, lo=1500, hi=6000)
    return _fade_edges(out, 0.0005, 0.05)


def bar(kind: str, f: float, dur: float = 0.3) -> F64:
    return _bar_cached(kind, round(f, 3), round(min(dur, 1.0), 2))


@lru_cache(maxsize=512)
def _epiano_cached(f: float, dur: float, vel: float) -> F64:
    """Тёплое электропиано (FM, модулятор 1:1 + звон «язычка» 14:1)."""
    rel = 0.25
    n = int(SR * (dur + rel + 0.05))
    t = _t(n)
    idx = (1.4 * vel + 0.3) * np.exp(-t * 2.5) + 0.25
    mod = np.sin(2 * np.pi * f * t)
    tine = 0.08 * vel * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 30)
    body = np.sin(2 * np.pi * f * t + idx * mod) + tine
    env = np.minimum(t / 0.003, 1.0) * (0.55 * np.exp(-t / 0.35) + 0.45 * np.exp(-t / 2.5))
    env *= np.clip((dur + rel - t) / rel, 0.0, 1.0)
    return _fade_edges(body * env, 0.001, 0.01)


def epiano(f: float, dur: float, vel: float = 0.7) -> F64:
    return _epiano_cached(round(f, 3), round(dur, 2), round(vel, 2))


@lru_cache(maxsize=256)
def _bass_cached(f: float, dur: float) -> F64:
    """Мягкий «пальцевый» бас: синус + немного обертонов, лёгкое насыщение, быстрый релиз."""
    rel = 0.06
    n = int(SR * (dur + rel))
    t = _t(n)
    x = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(4 * np.pi * f * t) + 0.07 * np.sin(6 * np.pi * f * t)
    env = np.minimum(t / 0.006, 1.0) * (0.45 + 0.55 * np.exp(-t / 0.25))
    env *= np.clip((dur + rel - t) / rel, 0.0, 1.0)
    return _fade_edges(np.tanh(1.4 * x * env) / np.tanh(1.4), 0.002, 0.01)


def bass(f: float, dur: float) -> F64:
    return _bass_cached(round(f, 3), round(dur, 2))


def whistle(f: float, dur: float, glide_from: float | None = None, vib: float = 0.006) -> F64:
    """Детская «свистулька/окарина»: синус с поздним вибрато, дыханием и (опционально) подъездом с другой ноты."""
    rel = 0.08
    n = int(SR * (dur + rel))
    t = _t(n)
    freq = np.full(n, f)
    if glide_from:
        g = np.minimum(t / 0.07, 1.0)
        freq = glide_from + (f - glide_from) * (1 - (1 - g) ** 2)
    vdepth = vib * np.clip((t - 0.12) / 0.25, 0.0, 1.0)
    freq = freq * (1 + vdepth * np.sin(2 * np.pi * 5.6 * t))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    x = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    rng = np.random.default_rng(int(f * 10) % 100000)
    breath = fft_filter(rng.standard_normal(n), lo=f * 0.8, hi=f * 3) * 0.06
    env = np.minimum(t / 0.025, 1.0) * np.clip((dur + rel - t) / rel, 0.0, 1.0) * (0.85 + 0.15 * np.exp(-t / 0.1))
    return _fade_edges((x + breath) * env, 0.002, 0.01)


# перкуссия
@lru_cache(maxsize=4)
def kick() -> F64:
    n = int(SR * 0.3)
    t = _t(n)
    f = 52 + 95 * np.exp(-t * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    x += 0.12 * np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.004)
    return _fade_edges(fft_filter(x, hi=3000), 0.0005, 0.03)


@lru_cache(maxsize=8)
def clap(seed: int = 0) -> F64:
    n = int(SR * 0.22)
    t = _t(n)
    rng = np.random.default_rng(100 + seed)
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=3200)
    env = np.zeros(n)
    for k, d in enumerate((0.0, 0.009, 0.017, 0.024)):
        s = int(d * SR)
        env[s:] += (0.6 if k < 3 else 1.0) * np.exp(-(t[: n - s]) / (0.006 if k < 3 else 0.055))
    return _fade_edges(noise * env, 0.0005, 0.03)


@lru_cache(maxsize=8)
def shaker(seed: int = 0) -> F64:
    n = int(SR * 0.09)
    t = _t(n)
    rng = np.random.default_rng(200 + seed)
    noise = fft_filter(rng.standard_normal(n), lo=5500, hi=13000)
    env = np.minimum(t / 0.012, 1.0) * np.exp(-t / 0.028)
    return _fade_edges(noise * env, 0.001, 0.01)


@lru_cache(maxsize=8)
def tambourine(seed: int = 0) -> F64:
    n = int(SR * 0.25)
    t = _t(n)
    rng = np.random.default_rng(300 + seed)
    x = 0.4 * fft_filter(rng.standard_normal(n), lo=6000, hi=14000) * np.exp(-t / 0.05)
    for _ in range(8):
        f = rng.uniform(5000, 9500)
        x += 0.12 * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / rng.uniform(0.04, 0.12))
    return _fade_edges(x * np.minimum(t / 0.002, 1.0), 0.0005, 0.02)


@lru_cache(maxsize=4)
def woodblock(high: bool = True) -> F64:
    n = int(SR * 0.12)
    t = _t(n)
    f = 1050 if high else 760
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.025) + 0.4 * np.sin(2 * np.pi * f * 2.4 * t) * np.exp(-t / 0.01)
    return _fade_edges(x * np.minimum(t / 0.0007, 1.0), 0.0003, 0.02)


@lru_cache(maxsize=2)
def shimmer(dur: float = 1.6) -> F64:
    """Мягкая «тарелка»-шиммер для финального аккорда."""
    n = int(SR * dur)
    t = _t(n)
    rng = np.random.default_rng(404)
    x = fft_filter(rng.standard_normal(n), lo=6500, hi=15000) * np.minimum(t / 0.01, 1.0) * np.exp(-t / (dur / 4))
    return _fade_edges(x, 0.001, 0.1)


# ------------------------------------------------------------------ гармония
def scale_note(tonic: int, deg: int) -> int:
    """MIDI-нота ступени мажора (deg может быть любым целым; 0 — тоника)."""
    return tonic + MAJOR[deg % 7] + 12 * (deg // 7)


def chord_tones(tonic: int, degree: int) -> list[int]:
    return [scale_note(tonic, degree + k) for k in (0, 2, 4)]


def voicing(tonic: int, degree: int, lo: int = 57, hi: int = 69) -> list[int]:
    """Аккорд в узком регистре (плавное голосоведение без скачков)."""
    out = []
    for n in chord_tones(tonic, degree):
        while n < lo:
            n += 12
        while n >= hi:
            n -= 12
        out.append(n)
    return sorted(out)


def _tonic(key: str, base: int = 60) -> int:
    t = base + NOTE.get(key, 0)
    return t - 12 if t > base + 5 else t


# мотивы: (доля от начала фразы, ступень от корня аккорда, длительность в долях) — короткие, «запоминающиеся» детские фразы
MOTIFS: list[list[tuple[float, int, float]]] = [
    [(0, 4, 0.5), (0.5, 2, 0.5), (1, 4, 0.5), (1.5, 5, 0.5), (2, 4, 1.0), (3, 2, 1.0)],
    [(0, 0, 0.5), (0.5, 1, 0.5), (1, 2, 0.5), (1.5, 4, 0.5), (2, 7, 1.5)],
    [(0, 2, 0.75), (0.75, 2, 0.25), (1, 4, 0.5), (1.5, 2, 0.5), (2, 0, 1.0), (3, 4, 1.0)],
    [(0, 7, 0.5), (0.5, 4, 0.5), (1, 5, 0.5), (1.5, 4, 0.5), (2, 2, 0.5), (2.5, 4, 1.5)],
    [(0, 4, 0.5), (0.5, 5, 0.25), (0.75, 4, 0.25), (1, 2, 0.5), (1.5, 1, 0.5), (2, 0, 2.0)],
    [(0, 2, 0.5), (0.5, 4, 0.5), (1, 7, 0.5), (1.5, 4, 0.5), (2, 5, 0.5), (2.5, 4, 0.5), (3, 2, 1.0)],
]
PROGRESSIONS: list[tuple[int, ...]] = [(0, 4, 5, 3), (0, 3, 4, 0), (0, 5, 3, 4), (0, 3, 0, 4), (0, 3, 5, 4)]
SONG_KEYS = ["C", "D", "F", "G"]  # светлые «детские» тональности


# ------------------------------------------------------------------ партитура
class Score:
    """Раскладка нот по долям в шины dry / verb; для лупов хвосты заворачиваются в начало (бесшовно)."""

    def __init__(self, bpm: float, beats: float, tail: float = 2.0, loop: bool = False, seed: int = 0) -> None:
        self.beat = 60.0 / bpm
        self.loop = loop
        self.n = int(round(SR * beats * self.beat))
        size = self.n if loop else self.n + int(SR * tail)
        self.dry = np.zeros(size)
        self.verb = np.zeros(size)
        self.rng = np.random.default_rng(seed)

    def at(self, clip: F64, beat_pos: float, gain: float, send: float = 0.15, jitter: float = 0.004) -> None:
        if gain <= 0:
            return
        j = self.rng.uniform(-jitter, jitter) if jitter else 0.0
        s = int(round((beat_pos * self.beat + j) * SR))
        g = gain * (1 + self.rng.uniform(-0.06, 0.06))
        for buf, k in ((self.dry, 1.0), (self.verb, send)):
            if k > 0:
                _place(buf, clip, s, g * k, self.loop)

    def mix(self, verb_decay: float = 1.3, wet: float = 1.0) -> F64:
        return self.dry + wet * reverb(self.verb, verb_decay, circular=self.loop)


def _place(buf: F64, clip: F64, at: int, gain: float, wrap: bool) -> None:
    n = len(buf)
    if wrap:
        at %= n
        pos = 0
        while pos < len(clip):
            s = (at + pos) % n
            k = min(len(clip) - pos, n - s)
            buf[s : s + k] += clip[pos : pos + k] * gain
            pos += k
        return
    if at >= n:
        return
    if at < 0:
        clip = clip[-at:]
        at = 0
    k = min(len(clip), n - at)
    buf[at : at + k] += clip[:k] * gain


def _finish(x: F64, peak: float = 0.89, wrap: bool = False, glue: bool = True) -> F32:
    x = x - float(np.mean(x))
    x = fft_filter(x, lo=35, order=2, circular=wrap)
    m = float(np.abs(x).max()) or 1.0
    x = x / m * 0.7
    if glue:
        x = compress(x, threshold=0.2, ratio=2.2, wrap=wrap)
        x = x / (float(np.abs(x).max()) or 1.0) * 0.95
    x = limit(x * 1.12, ceiling=peak, wrap=wrap)
    if not wrap:  # разовый фрагмент: мягкий хвост в ноль, без щелчка в конце
        nf = min(len(x), int(0.35 * SR))
        x[-nf:] *= np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
        x[: min(len(x), 32)] *= np.linspace(0, 1, min(len(x), 32))
    return np.asarray(x, dtype=np.float32)


def _strum(sc: Score, notes: list[int], beat_pos: float, dur_beats: float, gain: float, bright: float, up: bool = False, seed: int = 0) -> None:
    order = notes[::-1] if up else notes
    for k, nt in enumerate(order):
        sc.at(pluck(midi_hz(nt), dur_beats * sc.beat + 0.25, bright, seed + k), beat_pos + k * 0.012 / sc.beat, gain * (0.8 if up else 1.0), send=0.12)


def _motif_notes(tonic: int, degree: int, motif: list[tuple[float, int, float]], lo: int = 67, hi: int = 86) -> list[tuple[float, int, float]]:
    out = []
    for off, d, ln in motif:
        nt = scale_note(tonic + 12, degree + d)
        while nt < lo:
            nt += 12
        while nt > hi:
            nt -= 12
        out.append((off, nt, ln))
    return out


# ------------------------------------------------------------------ фоновые лупы мультика
BG_VARIANTS = ("sunny", "cozy", "playful", "lullaby")


@lru_cache(maxsize=8)
def bg_loop(variant: str = "sunny", seed: int = 1) -> F32:
    """Мягкий бесшовный луп под диалоги: тёплый, без резкой перкуссии, мелодия редкая (не утомляет)."""
    cfgs: dict[str, tuple[float, str, tuple[int, ...], str, float]] = {
        "sunny": (96, "F", (0, 5, 3, 4), "marimba", 0.5),
        "cozy": (86, "C", (0, 3, 0, 4), "marimba", 0.0),
        "playful": (106, "G", (0, 3, 4, 3), "xylo", 0.8),
        "lullaby": (70, "F", (0, 5, 3, 4), "box", 0.0),
    }
    bpm, key, prog, lead, perc = cfgs.get(variant, cfgs["sunny"])
    bars = 16
    tonic = _tonic(key)
    sc = Score(bpm, bars * 4, loop=True, seed=zlib.crc32(f"bg:{variant}:{seed}".encode()))
    rng = np.random.default_rng(seed)
    motif_a = MOTIFS[(seed + 1) % len(MOTIFS)]
    motif_b = MOTIFS[(seed + 4) % len(MOTIFS)]
    arp = [0, 1, 2, 1, 3, 1, 2, 1]
    for b in range(bars):
        deg = prog[b % len(prog)]
        v = voicing(tonic, deg)
        root = scale_note(tonic, deg) - 24
        while root < 36:
            root += 12
        p0 = b * 4
        if variant == "lullaby":
            for i in range(6):  # шкатулка: тихое арпеджио восьмыми
                nt = [*v, v[0] + 12][arp[i]] + 12
                sc.at(bar("box", midi_hz(nt), 0.6), p0 + i * 0.5 + (0.5 if i >= 4 else 0), 0.16, send=0.35)
            sc.at(epiano(midi_hz(v[0]), 4 * sc.beat, 0.35), p0, 0.10, send=0.4)
            sc.at(epiano(midi_hz(v[2]), 4 * sc.beat, 0.35), p0, 0.08, send=0.4)
            sc.at(bass(midi_hz(root), 3.5 * sc.beat), p0, 0.22, send=0.05)
        elif variant == "cozy":
            for k, (pos, ln) in enumerate([(0, 1.5), (1.5, 2.5)]):  # электропиано — мягкие аккорды
                for nt in v:
                    sc.at(epiano(midi_hz(nt), ln * sc.beat, 0.45 if k == 0 else 0.35), p0 + pos, 0.07, send=0.3)
            sc.at(bass(midi_hz(root), 1.8 * sc.beat), p0, 0.24, send=0.03)
            sc.at(bass(midi_hz(root + 7), 1.6 * sc.beat), p0 + 2, 0.18, send=0.03)
        else:
            for i, idx in enumerate(arp):  # укулеле — щипковое арпеджио
                if i % 2 and rng.random() < 0.15:
                    continue
                nt = [*v, v[0] + 12][idx]
                sc.at(pluck(midi_hz(nt), 1.2 * sc.beat, 0.45, i), p0 + i * 0.5, 0.15 if i % 2 == 0 else 0.11, send=0.15)
            sc.at(bass(midi_hz(root), 1.7 * sc.beat), p0, 0.26, send=0.03)
            sc.at(bass(midi_hz(root + (7 if b % 2 else 12)), 0.8 * sc.beat), p0 + 2, 0.18, send=0.03)
            if variant == "playful":
                sc.at(bass(midi_hz(root + 7), 0.4 * sc.beat), p0 + 3.5, 0.14, send=0.03)
        if perc:
            for e in range(8):
                sc.at(shaker(e % 3), p0 + e * 0.5, perc * (0.07 if e % 2 else 0.04), send=0.05)
            if variant == "playful":
                sc.at(kick(), p0, 0.18, send=0.0)
                if b % 2:
                    sc.at(woodblock(b % 4 == 1), p0 + 3.5, 0.05, send=0.1)
        # редкая мелодия: 1 такт из 4, чтобы не спорить с голосами
        if b % 4 == 2:
            mt = (motif_a, motif_b)[(b // 4) % 2]
            for off, nt, ln in _motif_notes(tonic, deg, mt):
                sc.at(bar(lead, midi_hz(nt), ln * sc.beat), p0 + off, 0.15 if lead != "box" else 0.12, send=0.3)
        if b == bars - 1 and variant != "lullaby":  # блёстка-переход в начало лупа
            for k, nt in enumerate(v):
                sc.at(bar("glock", midi_hz(nt + 24), 0.3), p0 + 3 + k * 0.25, 0.05, send=0.4)
    x = sc.mix(1.6 if variant == "lullaby" else 1.3)
    x = fft_filter(x, hi=6500 if variant != "playful" else 8000, order=1, circular=True)  # мягкий верх — меньше утомляет
    return _finish(x, peak=0.7, wrap=True, glue=True)


# ------------------------------------------------------------------ песенки
@dataclass(frozen=True)
class Section:
    kind: str  # intro | verse | chorus | break (танцевальный проигрыш) | outro
    bars: int
    sung: float = 0.0  # в долях от начала секции: где кончается вокал (0 — без вокала)


@dataclass(frozen=True)
class SongPlan:
    seed: int
    bpm: float
    key: str
    prog: tuple[int, ...]
    sections: tuple[Section, ...]

    @property
    def beats(self) -> float:
        return float(sum(s.bars for s in self.sections) * 4)

    @property
    def duration(self) -> float:
        return self.beats * 60.0 / self.bpm


def song_plan(seed: int, bpm: float, sections: list[Section] | tuple[Section, ...]) -> SongPlan:
    """Тональность и гармония песенки — по сиду (разные песни звучат по-разному, но каждая детерминирована)."""
    return SongPlan(seed, float(bpm), SONG_KEYS[seed % len(SONG_KEYS)], PROGRESSIONS[(seed // 7) % len(PROGRESSIONS)], tuple(sections))


SONG_TAIL = 2.2


def render_song(plan: SongPlan) -> F32:
    """Подложка песенки длиной plan.duration + хвост ~2 с: точно по сетке, вокал (TTS) кладётся на сильные доли строк."""
    tonic = _tonic(plan.key)
    sc = Score(plan.bpm, plan.beats, tail=SONG_TAIL, seed=plan.seed)
    hook = MOTIFS[plan.seed % len(MOTIFS)]
    answer = MOTIFS[(plan.seed + 3) % len(MOTIFS)]
    strum_pat = [(0, False, 1.0), (1, False, 0.5), (1.5, True, 0.5), (2.5, True, 0.5), (3, False, 0.5), (3.5, True, 0.5)]
    bar_i = 0
    pos = 0.0
    for si, sec in enumerate(plan.sections):
        chorus = sec.kind in ("chorus", "break")
        for b in range(sec.bars):
            deg = plan.prog[bar_i % len(plan.prog)]
            v = voicing(tonic, deg, 59, 71)
            root = scale_note(tonic, deg) - 24
            while root < 38:
                root += 12
            p0 = pos + b * 4
            last_bar = sec.kind == "outro" and b == sec.bars - 1
            if last_bar:  # финальный аккорд «та-да»
                tv = voicing(tonic, 0, 59, 71)
                _strum(sc, tv + [tv[0] + 12], p0, 3.5, 0.2, 0.7, seed=9)
                for nt in tv:
                    sc.at(epiano(midi_hz(nt), 3 * sc.beat, 0.7), p0, 0.08, send=0.3)
                sc.at(bass(midi_hz(tonic - 24 if tonic - 24 >= 38 else tonic - 12), 3 * sc.beat), p0, 0.32, send=0.05)
                sc.at(kick(), p0, 0.3, send=0.0)
                sc.at(shimmer(), p0, 0.12, send=0.3)
                for k, nt in enumerate([0, 2, 4, 7, 9, 11, 14]):
                    sc.at(bar("glock", midi_hz(scale_note(tonic + 12, nt)), 0.4), p0 - 1 + k * (1 / 7), 0.07 + 0.01 * k, send=0.4)
                continue
            # укулеле — бодрый страм
            for off, up, ln in strum_pat:
                _strum(sc, v, p0 + off, ln, 0.13 if chorus else 0.11, 0.6 if chorus else 0.5, up=up, seed=int(off * 2))
            # бас: тоника на 1, квинта на 3, подход восьмой в следующий такт
            sc.at(bass(midi_hz(root), 1.4 * sc.beat), p0, 0.34, send=0.03)
            sc.at(bass(midi_hz(root + 7), 0.9 * sc.beat), p0 + 2, 0.28, send=0.03)
            if chorus or sec.kind == "intro":
                sc.at(bass(midi_hz(root + 12), 0.4 * sc.beat), p0 + 1.5, 0.18, send=0.03)
                sc.at(bass(midi_hz(root + 9), 0.4 * sc.beat), p0 + 3.5, 0.18, send=0.03)
            # барабаны: мягкая бочка, хлопки на 2 и 4, шейкер, в припеве бубен
            sc.at(kick(), p0, 0.34, send=0.0)
            sc.at(kick(), p0 + 2, 0.26, send=0.0)
            if sec.kind != "intro" or b == sec.bars - 1:
                sc.at(clap(b % 3), p0 + 1, 0.16 if chorus else 0.12, send=0.25)
                sc.at(clap((b + 1) % 3), p0 + 3, 0.16 if chorus else 0.12, send=0.25)
            for e in range(8):
                sc.at(shaker(e % 3), p0 + e * 0.5, 0.06 if e % 2 else 0.035, send=0.05)
                if chorus and e % 2:
                    sc.at(tambourine(e % 3), p0 + e * 0.5, 0.05, send=0.1)
            if chorus:  # электропиано-«стабы» на слабые доли
                for nt in v:
                    sc.at(epiano(midi_hz(nt + 12), 0.4 * sc.beat, 0.6), p0 + 1.5, 0.035, send=0.25)
                    sc.at(epiano(midi_hz(nt + 12), 0.4 * sc.beat, 0.6), p0 + 3.5, 0.035, send=0.25)
            bar_i += 1
        # мелодия: во вступлении и концовке — хук; в строках — ответная фраза в паузе после вокала (call & response)
        if sec.kind in ("intro", "outro", "break"):
            for b in range(sec.bars - (1 if sec.kind == "outro" else 0)):
                deg = plan.prog[(bar_i - sec.bars + b) % len(plan.prog)] if sec.kind != "outro" else plan.prog[(bar_i + b) % len(plan.prog)]
                # хук в «поющемся» регистре (D4–A4 у свистульки), ксилофон — октавой выше
                for off, nt, ln in _motif_notes(tonic, deg, [m for m in hook if m[0] < 4], lo=62, hi=74):
                    sc.at(whistle(midi_hz(nt), ln * sc.beat * 0.9), pos + b * 4 + off, 0.12, send=0.25)
                    sc.at(bar("xylo", midi_hz(nt + 12), ln * sc.beat), pos + b * 4 + off, 0.12, send=0.2)
                    if sec.kind == "break":
                        sc.at(bar("glock", midi_hz(nt + 24), ln * sc.beat), pos + b * 4 + off, 0.05, send=0.35)
            if sec.kind == "intro":  # глиссандо-приглашение «поём!»
                for k, nt in enumerate([0, 2, 4, 7]):
                    sc.at(bar("glock", midi_hz(scale_note(tonic + 24, nt)), 0.3), pos + sec.bars * 4 - 1 + k * 0.25, 0.07, send=0.4)
        elif sec.sung > 0:
            free_from = float(np.ceil(sec.sung * 2) / 2) + 0.5
            room = sec.bars * 4 - free_from
            if room >= 1.5:
                start_bar = int(free_from // 4)
                deg = plan.prog[(bar_i - sec.bars + start_bar) % len(plan.prog)]
                mt = answer if not chorus else hook
                for off, nt, ln in _motif_notes(tonic, deg, mt):
                    if off + ln <= room:
                        inst = "glock" if chorus else "xylo"
                        sc.at(bar(inst, midi_hz(nt), ln * sc.beat), pos + free_from + off, 0.12 if chorus else 0.15, send=0.3)
                        if chorus:
                            sc.at(bar("xylo", midi_hz(nt - 12), ln * sc.beat), pos + free_from + off, 0.1, send=0.2)
        if si + 1 < len(plan.sections) and plan.sections[si + 1].kind == "chorus" and sec.kind != "chorus":
            p_end = pos + sec.bars * 4  # барабанная «подводка» к припеву
            for k in range(4):
                sc.at(woodblock(k % 2 == 0), p_end - 1 + k * 0.25, 0.06 + 0.01 * k, send=0.1)
        pos += sec.bars * 4
    return _finish(sc.mix(1.2), peak=0.89)


# ------------------------------------------------------------------ заставка и стингеры
THEME_BPM = 140.0
# «Benny and Friends»: (доля, MIDI в до мажоре, длительность в долях); последний такт — ритм слов «Ben-ny and Friends!»
THEME_MELODY: list[tuple[float, int, float]] = [
    (0, 72, 0.5), (0.5, 76, 0.5), (1, 79, 1.0), (2, 76, 0.5), (2.5, 79, 0.5), (3, 81, 1.0),
    (4, 81, 0.5), (4.5, 79, 0.5), (5, 77, 0.5), (5.5, 76, 0.5), (6, 74, 1.5),
    (8, 74, 0.5), (8.5, 77, 0.5), (9, 79, 0.5), (9.5, 83, 0.5), (10, 86, 1.0), (11, 83, 0.5), (11.5, 79, 0.5),
    (12, 79, 0.5), (12.5, 81, 0.5), (13, 83, 0.5), (13.5, 84, 2.5),
]
THEME_PROG = (0, 3, 4, 0)


THEME_VARIANTS = {"hello": 140.0, "goodbye": 112.0}


def theme_length(variant: str = "hello") -> float:
    """Длина заставки до конца финальной ноты (без хвоста реверба)."""
    return 16 * 60.0 / THEME_VARIANTS.get(variant, THEME_BPM)


@lru_cache(maxsize=4)
def theme_jingle(variant: str = "hello") -> F32:
    """Заставка «Benny and Friends» — одна и та же мелодия в начале и в конце каждой серии (ритуал):
    hello (~7 с, бодро: укулеле, бас, хлопки, глокеншпиль + свистулька, «та-да»),
    goodbye (~8.5 с, мягче: маримба и свистулька, без бочки, тёплый финальный аккорд — «Bye-bye, friends!»)."""
    bye = variant == "goodbye"
    tonic = 60
    sc = Score(THEME_VARIANTS.get(variant, THEME_BPM), 16, tail=1.6 if bye else 1.4, seed=777 + (1 if bye else 0))
    for b in range(4):
        deg = THEME_PROG[b]
        v = voicing(tonic, deg, 59, 71)
        root = scale_note(tonic, deg) - 24
        p0 = b * 4
        if b < 3:
            for off, up, ln in [(0, False, 1.0), (1, False, 0.5), (1.5, True, 0.5), (2.5, True, 0.5), (3, False, 0.5), (3.5, True, 0.5)]:
                if bye and up:
                    continue
                _strum(sc, v, p0 + off, ln, 0.11 if bye else 0.13, 0.5 if bye else 0.65, up=up, seed=int(off * 2))
            sc.at(bass(midi_hz(root), 0.9 * sc.beat), p0, 0.34, send=0.03)
            sc.at(bass(midi_hz(root + 7), 0.4 * sc.beat), p0 + 1.5, 0.22, send=0.03)
            sc.at(bass(midi_hz(root + 12), 0.9 * sc.beat), p0 + 2, 0.26, send=0.03)
            sc.at(bass(midi_hz(root + 7), 0.4 * sc.beat), p0 + 3.5, 0.22, send=0.03)
            for q in range(4):
                if not bye:
                    sc.at(kick(), p0 + q, 0.3 if q % 2 == 0 else 0.18, send=0.0)
                if q % 2:
                    sc.at(clap(q), p0 + q, 0.09 if bye else 0.17, send=0.25)
            for e in range(8):
                sc.at(shaker(e % 3), p0 + e * 0.5, 0.06 if e % 2 else 0.035, send=0.05)
                if e % 2 and not bye:
                    sc.at(tambourine(e % 3), p0 + e * 0.5, 0.04, send=0.1)
        else:  # «Ben-ny and Friends!» / «Bye-bye, friends!» — стоп-тайм, хлопки на слоги, затем аккорд
            for k in range(3):
                sc.at(clap(k), p0 + k * 0.5, 0.12 if bye else 0.2, send=0.25)
            tv = voicing(tonic, 0, 59, 71)
            _strum(sc, [*tv, tv[0] + 12], p0 + 1.5, 2.5, 0.2 if bye else 0.22, 0.6 if bye else 0.75, seed=5)
            for nt in tv:
                sc.at(epiano(midi_hz(nt + 12), 2.2 * sc.beat, 0.6 if bye else 0.8), p0 + 1.5, 0.08 if bye else 0.07, send=0.35)
            sc.at(bass(midi_hz(36), 2.2 * sc.beat), p0 + 1.5, 0.36, send=0.04)
            if not bye:
                sc.at(kick(), p0 + 1.5, 0.36, send=0.0)
            sc.at(shimmer(), p0 + 1.5, 0.1 if bye else 0.14, send=0.3)
            for k, d in enumerate([0, 2, 4, 7, 9, 11, 14, 16]):
                sc.at(bar("glock", midi_hz(scale_note(84, d)), 0.4), p0 + 1.6 + k * (0.16 if bye else 0.12), 0.05 + 0.006 * k, send=0.45)
    prev: float | None = None
    for off, nt, ln in THEME_MELODY:
        f = midi_hz(nt)
        sc.at(whistle(f, ln * sc.beat * 0.92, glide_from=prev if prev and abs(prev - f) / f > 0.2 else None), off, 0.12, send=0.25, jitter=0)
        sc.at(bar("glock", f * 2, ln * sc.beat), off, 0.05 if bye else 0.07, send=0.35, jitter=0)
        sc.at(bar("marimba" if bye else "xylo", f, ln * sc.beat), off, 0.14 if bye else 0.12, send=0.2, jitter=0)
        prev = f
    return _finish(sc.mix(1.3), peak=0.89)


STINGS = ("transition", "question", "yay", "story")


@lru_cache(maxsize=16)
def sting(kind: str = "transition", variant: int = 0) -> F32:
    """Короткие музыкальные вставки: transition (~1 с, переход сцены), question (любопытное «хм?»),
    yay (праздничное «ура»), story (заставка истории — хук из темы «Ben-ny and Friends»)."""
    if kind == "question":
        sc = Score(120, 2.5, tail=0.8, seed=41 + variant)
        sc.at(bar("marimba", midi_hz(67), 0.25), 0, 0.3, send=0.2, jitter=0)
        sc.at(bar("marimba", midi_hz(74), 0.25), 0.5, 0.3, send=0.2, jitter=0)
        sc.at(whistle(midi_hz(76), 0.7, glide_from=midi_hz(69), vib=0.012), 1.0, 0.16, send=0.3, jitter=0)
        sc.at(bar("glock", midi_hz(88), 0.4), 1.3, 0.06, send=0.4, jitter=0)
        sc.at(woodblock(True), 0, 0.08, send=0.1, jitter=0)
        return _finish(sc.mix(1.0), peak=0.85, glue=False)
    if kind == "yay":
        sc = Score(150, 4, tail=1.4, seed=51 + variant)
        tonic = 60 + (0, 5, 7)[variant % 3]
        for k, d in enumerate([0, 2, 4, 7, 9, 11, 14]):
            sc.at(bar("glock", midi_hz(scale_note(tonic + 12, d)), 0.3), k * 0.25, 0.08 + 0.01 * k, send=0.35, jitter=0)
            sc.at(bar("xylo", midi_hz(scale_note(tonic, d)), 0.2), k * 0.25, 0.1, send=0.2, jitter=0)
        tv = voicing(tonic, 0, 59, 71)
        _strum(sc, [*tv, tv[0] + 12], 2.0, 2.0, 0.24, 0.8, seed=3)
        for nt in tv:
            sc.at(epiano(midi_hz(nt + 12), 0.8, 0.9), 2.0, 0.08, send=0.3, jitter=0)
        sc.at(bass(midi_hz(tonic - 24), 0.8), 2.0, 0.3, send=0.03, jitter=0)
        sc.at(kick(), 2.0, 0.32, send=0.0, jitter=0)
        sc.at(clap(0), 1.0, 0.2, send=0.25, jitter=0)
        sc.at(clap(1), 1.5, 0.2, send=0.25, jitter=0)
        sc.at(clap(2), 2.0, 0.24, send=0.25, jitter=0)
        sc.at(shimmer(), 2.0, 0.14, send=0.3, jitter=0)
        return _finish(sc.mix(1.2), peak=0.89)
    if kind == "story":
        sc = Score(THEME_BPM, 6, tail=1.2, seed=61 + variant)
        for k, (off, nt, ln) in enumerate([(0, 79, 0.5), (0.5, 81, 0.5), (1, 83, 0.5), (1.5, 84, 2.0)]):
            f = midi_hz(nt)
            sc.at(whistle(f, ln * sc.beat * 0.92), off, 0.13, send=0.25, jitter=0)
            sc.at(bar("xylo", f, ln * sc.beat), off, 0.13, send=0.2, jitter=0)
            sc.at(bar("glock", f * 2, ln * sc.beat), off, 0.06, send=0.35, jitter=0)
            if k < 3:
                sc.at(clap(k), off, 0.16, send=0.25, jitter=0)
        tv = voicing(60, 0, 59, 71)
        _strum(sc, [*tv, tv[0] + 12], 1.5, 2.5, 0.2, 0.75, seed=5)
        sc.at(bass(midi_hz(36), 1.5), 1.5, 0.32, send=0.04, jitter=0)
        sc.at(kick(), 1.5, 0.3, send=0.0, jitter=0)
        sc.at(shimmer(), 1.5, 0.1, send=0.3, jitter=0)
        return _finish(sc.mix(1.2), peak=0.89)
    # transition: быстрое восходящее арпеджио (3 варианта по тональности/рисунку) + блёстка
    sc = Score(150, 3, tail=0.9, seed=31 + variant)
    tonic = 60 + (0, 7, 5)[variant % 3]
    pattern = ([0, 2, 4, 7], [4, 2, 4, 7], [0, 4, 7, 9])[variant % 3]
    for k, d in enumerate(pattern):
        nt = scale_note(tonic + 12, d)
        sc.at(bar("marimba", midi_hz(nt), 0.25), k * 0.25, 0.22, send=0.25, jitter=0)
    sc.at(bar("glock", midi_hz(scale_note(tonic + 24, pattern[-1])), 0.5), 1.0, 0.1, send=0.45, jitter=0)
    sc.at(shaker(0), 0.0, 0.08, send=0.1, jitter=0)
    sc.at(shaker(1), 0.5, 0.06, send=0.1, jitter=0)
    return _finish(sc.mix(1.1), peak=0.85, glue=False)


# ------------------------------------------------------------------ лупы для уроков (совместимость: Track/TRACKS/render/ensure_music)
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


def render(tr: Track) -> F32:
    """Бесшовный луп из целого числа тактов: укулеле-арпеджио + электропиано + бас + тихий ритм."""
    seed = zlib.crc32(tr.slug.encode())
    rng = np.random.default_rng(seed)
    tonic = _tonic(tr.key)
    sc = Score(tr.bpm, tr.bars * 4, loop=True, seed=seed)
    pattern = [0, 1, 2, 1, 3, 1, 2, 1]
    for b in range(tr.bars):
        deg = tr.progression[b % len(tr.progression)]
        v = voicing(tonic, deg)
        root = scale_note(tonic, deg) - 24
        while root < 36:
            root += 12
        p0 = b * 4
        for nt in v:
            sc.at(epiano(midi_hz(nt), 3.6 * sc.beat, 0.4), p0, 0.06, send=0.3)
        sc.at(bass(midi_hz(root), 1.8 * sc.beat), p0, 0.26, send=0.03)
        sc.at(bass(midi_hz(root + 7), 1.6 * sc.beat), p0 + 2, 0.2, send=0.03)
        for i, idx in enumerate(pattern):
            if rng.random() < 0.12 and i % 2 == 1:
                continue
            off = i * 0.5 + (tr.swing * 0.5 if i % 2 else 0)
            nt = [*v, v[0] + 12][idx] + (12 if i in (3, 7) and rng.random() < 0.4 else 0)
            sc.at(pluck(midi_hz(nt), 1.2 * sc.beat, tr.pluck_bright, i), p0 + off, 0.15, send=0.15)
        if tr.drums:
            for q in range(4):
                if q in (0, 2):
                    sc.at(kick(), p0 + q, 0.22, send=0.0)
                for e in range(2):
                    sc.at(shaker(e), p0 + q + e * 0.5 + (tr.swing * 0.5 if e else 0), 0.06 if e else 0.035, send=0.05)
    x = fft_filter(sc.mix(1.3), hi=7000, order=1, circular=True)
    return _finish(x, peak=0.6, wrap=True)


def ensure_music(data_dir: Path) -> list[tuple[Track, str]]:
    """Генерирует недостающие треки в /data/music. Возвращает (трек, относительный путь)."""
    from .audio import write_wav  # лениво: модуль музыки не тянет soundfile при импорте (тесты, демо)

    out = []
    for tr in TRACKS:
        rel = f"/music/{tr.slug}.wav"
        p = data_dir / rel.lstrip("/")
        if not p.exists():
            write_wav(p, render(tr))
        out.append((tr, rel))
    return out
