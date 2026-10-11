"""Сборник мультиков: сцены и звук сдвигаются вместе, главы с правильными временами."""
from __future__ import annotations

from app.pipeline.compilation import merge_cartoons


def ep(dur: float, chapters: list[str]) -> dict:
    return {"duration": dur, "fps": 30, "scenes": [{"start": 0, "duration": dur, "location": "garden"}],
            "audio": [{"src": "/media/v.wav", "start": 0}, {"src": "/media/s.wav", "start": 5.0, "dur": 3}]}


def test_merge_offsets_scenes_audio_and_chapters() -> None:
    a = ("Rainy Day", ep(300, []), {"chapters": ["00:00 Intro", "00:40 Puddles"], "plan": {"stories": [{"title": "Puddles"}]}})
    b = ("Snow Fun", ep(3500, []), {"chapters": ["00:00 Intro", "01:05 Snowman"], "plan": {"stories": [{"title": "Snowman"}], "songs": [{"title": "Snow"}]}})
    doc, meta = merge_cartoons([a, b], "Big compilation")
    assert doc["duration"] == 3800
    assert [s["start"] for s in doc["scenes"]] == [0, 300]
    assert [x["start"] for x in doc["audio"]] == [0, 5.0, 300, 305.0]
    assert meta["chapters"] == ["00:00 Rainy Day", "00:40 Puddles", "05:00 Snow Fun", "06:05 Snowman"]
    assert [s["title"] for s in meta["plan"]["stories"]] == ["Puddles", "Snowman"] and meta["plan"]["songs"] == [{"title": "Snow"}]
