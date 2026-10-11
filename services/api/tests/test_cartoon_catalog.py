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


def test_layout_keeps_heroes_apart() -> None:
    d = cartoon.Director("p")
    for n in (2, 3, 4, 5):
        xs = sorted(d._place(list(cartoon.CAST)[:n]).values())
        assert all(b - a >= cartoon.GAP for a, b in zip(xs, xs[1:], strict=False)), (n, xs)
        assert cartoon.STAGE[0] - 40 <= xs[0] and xs[-1] <= cartoon.STAGE[1] + 40


def test_free_spot_never_stands_inside_another_hero() -> None:
    pos = {"benny": 760.0, "mia": 1160.0, "ollie": 960.0}
    x = cartoon.Director.free_spot("dot", 960.0, pos)
    assert all(abs(x - o) >= cartoon.GAP for o in pos.values())
    assert cartoon.Director.free_spot("dot", cartoon.SLOTS["off_right"], pos) == cartoon.SLOTS["off_right"]


def test_item_ops_give_throw_eat() -> None:
    d = cartoon.Director
    keys = {c: [{"t": 0, "x": x, "action": "idle"}] for c, x in (("benny", 640.0), ("mia", 960.0), ("dot", 1300.0))}
    pos = {"benny": 640.0, "mia": 960.0, "dot": 1300.0}
    items = d._items_init({"props": [{"prop": "ball", "where": "center_right"}]})
    holding: dict[str, str] = {}
    d._item_op(items, holding, keys, pos, {"kind": "give", "char": "benny", "target": "mia", "prop": "apple"}, 1.0, 1.5)
    assert holding.get("mia", "").startswith("apple")
    d._item_op(items, holding, keys, pos, {"kind": "eat", "char": "mia", "prop": "apple"}, 3.0, 2.5)
    apple = items[holding["mia"]]
    assert [k.get("state") for k in apple["keys"] if k.get("state")] == ["bitten", "eaten"]
    d._item_op(items, holding, keys, pos, {"kind": "pick_up", "char": "mia", "prop": "ball"}, 6.0, 1.0)
    d._item_op(items, holding, keys, pos, {"kind": "throw", "char": "mia", "target": "dot", "prop": "ball"}, 7.0, 1.0)
    ball = items["ball0"]
    assert ball["keys"][-1]["at"] == {"kind": "hand", "char": "dot"} and ball["keys"][-1]["anim"] == "throw"
    assert any(k.get("action") == "catch" for k in keys["dot"])


def test_song_staging_moves_and_camera(monkeypatch) -> None:  # noqa: ANN001
    import asyncio

    import numpy as np

    async def fake_voice(text: str, speaker: str):  # noqa: ANN202
        return np.zeros(int(cartoon.SR * 1.2), np.float32), {"score": 1.0}

    monkeypatch.setattr(cartoon, "voice_line", fake_voice)
    d = cartoon.Director("p")
    lyrics = {"chorus": ["Clap clap hooray", "Jump with me"], "verse": ["The sun is up", "We play outside", "Spin around now", "Hello friends"],
              "verse2": ["One more time", "Wave hello", "We are happy", "Sing along"]}
    asyncio.run(d.song("Clap Song", lyrics, "playground", ["benny", "mia", "ollie", "dot"]))
    sc = d.scenes[-1]
    zooms = {round(c["zoom"], 2) for c in sc["camera"]}
    assert len(sc["camera"]) > 8 and {1.0, 1.35, 1.75} <= zooms  # общий, средний, крупный
    acts = {k.get("action") for k in sc["actors"][0]["keys"]}
    assert {"clap", "jump", "spin"} <= acts  # движения из слов песни


def test_cam_move_keeps_keys_ordered_and_starts_from_real_position() -> None:
    cam = [{"t": 0, "x": 960.0, "y": 670.0, "zoom": 1.0}]
    cartoon.cam_move(cam, 1.0, 3.0, 600.0, 730.0, 2.2)  # вставка
    cartoon.cam_move(cam, 2.0, 2.9, 960.0, 670.0, 1.0)  # следующий бит начался раньше конца вставки
    ts = [k["t"] for k in cam]
    assert ts == sorted(ts)
    mid = cam[-2]  # стартовая точка второго движения = где камера была в t=2.0, а не «прыжок»
    assert 600 < mid["x"] < 960 and 1.0 < mid["zoom"] < 2.2


def test_scene_sanitises_editor_beats(monkeypatch) -> None:  # noqa: ANN001
    import asyncio

    import numpy as np

    async def fake_voice(text: str, speaker: str):  # noqa: ANN202
        return np.zeros(int(cartoon.SR * 1.0), np.float32), {"score": 1.0}

    monkeypatch.setattr(cartoon, "voice_line", fake_voice)
    d = cartoon.Director("p")
    beats = [{"speaker": "Benny", "text": "I am so proud!", "emotion": "proud", "action": "boogie", "shot": "close-up", "move": "left",
              "reactions": ["mia laughs", {"char": "mia", "emotion": "excited"}], "hold": None, "fx": "hearts"}, "garbage"]
    asyncio.run(d.scene("garden", ["benny", "mia"], beats))
    sc = d.scenes[-1]
    assert sc["lines"][0]["char"] == "benny"
    emos = {k.get("emotion") for a in sc["actors"] for k in a["keys"] if k.get("emotion")}
    acts = {k.get("action") for a in sc["actors"] for k in a["keys"] if k.get("action")}
    assert emos <= set(cartoon.EMOTIONS) and acts <= set(cartoon.ACTIONS)


def test_sentences_split_for_natural_pauses() -> None:
    assert cartoon.sentences("Oh no! The tent is falling!") == ["Oh no!", "The tent is falling!"]
    assert cartoon.sentences("Hello, Mia!") == ["Hello, Mia!"]
    assert cartoon.sentences("Wow. Look!") == ["Wow. Look!"]  # однословные обрывки не озвучиваются отдельно
