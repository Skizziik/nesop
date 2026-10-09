"""Вклейка нового дубля фразы: клип укладывается в паузу до следующей фразы."""
import numpy as np

from app.pipeline.revoice import _fit, _media_to_rel


def test_fit_shrinks_only_when_longer() -> None:
    a = np.ones(1000, np.float32)
    assert len(_fit(a, 900)) == 900
    assert len(_fit(a, 1200)) == 1000  # короче паузы — не трогаем


def test_media_path() -> None:
    assert _media_to_rel("/media/projects/p1/voice.wav") == "projects/p1/voice.wav"
