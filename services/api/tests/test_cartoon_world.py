"""Мир сцены: совместимость с локацией по каталогу и авто-костюмы."""
from __future__ import annotations

import json
from pathlib import Path

from app.pipeline import cartoon_world as cw

CAT = json.loads((Path(cw.__file__).with_name("cartoon_catalog.json")).read_text(encoding="utf-8"))


def test_snow_never_on_beach_and_only_in_winter() -> None:
    w = cw.resolve_world(CAT, "beach", {"weather": "snow", "time": "day"}, "summer")
    assert w["weather"] != "snow" and w["season"] in ("spring", "summer")
    w = cw.resolve_world(CAT, "garden", {"weather": "snow"}, "summer")
    assert w == {"time": "day", "weather": "snow", "season": "winter"}


def test_rain_in_winter_becomes_snow_and_legacy_leaves_mean_autumn_wind() -> None:
    assert cw.resolve_world(CAT, "forest", {"weather": "rain"}, "winter")["weather"] == "snow"
    w = cw.resolve_world(CAT, "playground", {"weather": "leaves"})
    assert w["weather"] == "windy" and w["season"] == "autumn"


def test_defaults_bedroom_night_and_playground_no_night() -> None:
    assert cw.resolve_world(CAT, "bedroom", {})["time"] == "night"
    assert cw.resolve_world(CAT, "playground", {"time": "night"})["time"] != "night"


def test_every_resolved_world_is_allowed() -> None:
    locs = {loc["id"]: loc for loc in CAT["locations"]}
    for lid, loc in locs.items():
        for t in cw.TIMES:
            for wx in cw.WEATHERS:
                for se in cw.SEASONS:
                    w = cw.resolve_world(CAT, lid, {"time": t, "weather": wx}, se)
                    assert cw.allowed(loc, w), (lid, t, wx, se, w)


def test_auto_wear() -> None:
    assert "raincoat" in cw.auto_wear(CAT, "garden", {"time": "day", "weather": "rain", "season": "summer"})
    assert "raincoat" not in cw.auto_wear(CAT, "kitchen", {"time": "day", "weather": "rain", "season": "summer"})
    winter = cw.auto_wear(CAT, "forest", {"time": "day", "weather": "snow", "season": "winter"})
    assert "winter_hat" in winter and "scarf" in winter
    assert cw.auto_wear(CAT, "bedroom", {"time": "night", "weather": "clear", "season": "summer"}) == ["pajamas"]
    assert "party_hat" in cw.auto_wear(CAT, "living_room", {"time": "day", "weather": "clear", "season": "summer"}, "birthday")


def test_explicit_wear_wins_slot() -> None:
    assert cw.merge_wear(["winter_hat", "scarf"], ["party_hat"], CAT) == ["scarf", "party_hat"]
    assert cw.merge_wear(["raincoat"], ["pajamas"], CAT) == ["pajamas"]
