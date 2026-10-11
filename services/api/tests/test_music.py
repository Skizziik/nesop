"""Процедурная музыка: детерминизм, без перегруза, бесшовные лупы, точные длительности (чистый numpy, без БД)."""
from __future__ import annotations

import numpy as np
import pytest

from app.pipeline import music as mu

SR = mu.SR


def _seam_ok(x: np.ndarray) -> bool:
    """Стык лупа (последний → первый сэмпл) не больше обычных скачков внутри — щелчка нет."""
    d = np.abs(np.diff(x.astype(np.float64)))
    return abs(float(x[0]) - float(x[-1])) <= float(np.percentile(d, 99.9)) + 1e-6


def test_theme_and_stings_deterministic_and_safe() -> None:
    a = mu.theme_jingle()
    mu.theme_jingle.cache_clear()
    b = mu.theme_jingle()
    assert np.array_equal(a, b)
    for x in (a, mu.theme_jingle("goodbye"), *(mu.sting(k) for k in mu.STINGS)):
        assert x.dtype == np.float32 and np.isfinite(x).all()
        assert float(np.abs(x).max()) <= 0.9
        assert abs(float(x[-1])) < 1e-3 and abs(float(x[0])) < 1e-3  # мягкие края, без щелчков
        assert abs(float(np.mean(x))) < 2e-3  # без постоянной составляющей


def test_theme_lengths() -> None:
    assert 6.0 <= mu.theme_length() <= 8.0
    assert mu.theme_length("goodbye") > mu.theme_length()
    assert len(mu.theme_jingle()) / SR == pytest.approx(mu.theme_length() + 1.4, abs=0.01)
    for k in mu.STINGS:
        assert 1.0 <= len(mu.sting(k)) / SR <= 4.0


@pytest.mark.parametrize("variant", ["sunny", "lullaby"])
def test_bg_loop_seamless(variant: str) -> None:
    x = mu.bg_loop(variant)
    bpm = {"sunny": 96, "lullaby": 70}[variant]
    assert len(x) == int(round(SR * 16 * 4 * 60 / bpm))  # ровно 16 тактов
    assert float(np.abs(x).max()) <= 0.71
    assert abs(float(np.mean(x))) < 1e-3
    assert _seam_ok(x)
    mu.bg_loop.cache_clear()
    assert np.array_equal(x, mu.bg_loop(variant))


def test_song_backing_grid() -> None:
    secs = [mu.Section("intro", 2), mu.Section("chorus", 2, 4.5), mu.Section("verse", 2, 5.0), mu.Section("break", 4), mu.Section("outro", 2)]
    plan = mu.song_plan(777, 112, secs)
    assert plan.key in ("C", "D", "F", "G")
    assert plan.duration == pytest.approx(12 * 4 * 60 / 112)
    x = mu.render_song(plan)
    assert len(x) / SR == pytest.approx(plan.duration + mu.SONG_TAIL, abs=0.01)
    assert float(np.abs(x).max()) <= 0.9 and np.isfinite(x).all()
    assert abs(float(x[-1])) < 1e-3
    assert np.array_equal(x, mu.render_song(plan))


@pytest.mark.parametrize("f", [110.0, 261.63, 440.0, 880.0])
def test_pluck_in_tune(f: float) -> None:
    x = mu.pluck(f, 1.0, 0.5)
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    peak = np.fft.rfftfreq(len(x), 1 / SR)[int(np.argmax(spec))]
    assert peak == pytest.approx(f, rel=0.01)


def test_legacy_tracks_still_loop() -> None:
    tr = mu.TRACKS[3]
    x = mu.render(tr)
    assert len(x) == int(round(SR * tr.bars * 4 * 60 / tr.bpm))
    assert float(np.abs(x).max()) <= 0.61
    assert _seam_ok(x)


def test_limiter_never_exceeds_ceiling() -> None:
    rng = np.random.default_rng(0)
    x = rng.standard_normal(SR) * np.linspace(0.1, 3.0, SR)
    y = mu.limit(x, ceiling=0.8)
    assert float(np.abs(y).max()) <= 0.8 + 1e-9
