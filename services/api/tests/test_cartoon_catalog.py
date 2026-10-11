"""Каталог мультиков: cartoon.py берёт все списки из cartoon_catalog.json (экспорт из TS), статистика ассетов по эпизоду."""
from __future__ import annotations

import json
from pathlib import Path

from app.pipeline import cartoon
from app.routers.catalog import usage_of

CAT = json.loads((Path(cartoon.__file__).with_name("cartoon_catalog.json")).read_text(encoding="utf-8"))


def test_enums_come_from_catalog() -> None:
    assert list(cartoon.CAST) == [c["id"] for c in CAT["characters"]]
    assert list(cartoon.LOCATIONS) == [loc["id"] for loc in CAT["locations"]]
    assert cartoon.PROPS == [p["id"] for p in CAT["props"]]
    assert cartoon.WEAR == [o["id"] for o in CAT["outfits"]]
    assert cartoon.FX == [f["id"] for f in CAT["fx"]]
    assert cartoon.ACTIONS == [a["id"] for a in CAT["actions"]]
    assert cartoon.EMOTIONS == [e["id"] for e in CAT["emotions"]]
    assert set(cartoon.VOICES) == {*cartoon.CAST, "narrator"}
    # схемы LLM и библия сериала строятся из тех же списков
    beat = cartoon.STORY_SCHEMA["properties"]["scenes"]["items"]["properties"]["beats"]["items"]["properties"]
    assert beat["action"]["enum"] == cartoon.ACTIONS
    assert "umbrella = an umbrella" in cartoon.BIBLE


def test_director_seed_is_stable_and_per_scene() -> None:
    a, b = cartoon.Director("proj1"), cartoon.Director("proj1")
    assert a._seed() == b._seed() > 0
    a.scenes.append({})
    assert a._seed() != b._seed()


def test_usage_of_counts_assets() -> None:
    doc = {
        "scenes": [
            {
                "location": "beach",
                "props": [{"id": "bucket", "x": 900}],
                "actors": [
                    {"id": "benny", "wear": ["sun_hat"], "keys": [{"t": 0, "action": "wave"}, {"t": 1, "hold": {"id": "ball"}, "fx": "hearts"}]},
                    {"id": "mia", "keys": [{"t": 0, "action": "wave"}]},
                ],
            },
            {"location": "beach", "actors": []},
        ]
    }
    u = usage_of(doc)
    assert u["locations"]["beach"] == 2
    assert u["props"] == {"bucket": 1, "ball": 1}
    assert u["actions"]["wave"] == 2
    assert u["outfits"]["sun_hat"] == 1
    assert u["fx"]["hearts"] == 1
    assert u["characters"] == {"benny": 1, "mia": 1}
