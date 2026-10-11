"""Обложки и тексты YouTube мультика: нормализация идей LLM по каталогу и сценам эпизода (без БД)."""
from __future__ import annotations

from app.pipeline import kids_thumbs as kt


def _doc() -> dict:
    def story_scene(loc: str, world: dict, props: list[str] | None = None, hold: str | None = None, cast=("benny", "mia")) -> dict:
        actors = [{"id": c, "keys": [{"t": 0, "action": "idle"}]} for c in cast]
        if hold:
            actors[0]["keys"].append({"t": 1, "hold": {"id": hold}})
        return {"kind": "story", "location": loc, "seed": 7, "world": world, "actors": actors, "props": [{"id": p, "x": 900} for p in props or []]}

    return {
        "title": "Snow Day Fun",
        "scenes": [
            {"kind": "title", "location": "garden", "overlays": [{"kind": "title", "text": "Snow Day Fun"}], "actors": []},
            {"kind": "title", "location": "garden", "overlays": [{"kind": "title", "text": "The Big Snowman", "sub": "Story 1"}], "actors": []},
            story_scene("garden", {"time": "day", "weather": "snow", "season": "winter"}, ["snowman"], "carrot"),
            story_scene("kitchen", {"time": "evening", "weather": "snow", "season": "winter"}, ["cup"]),
            {"kind": "song", "location": "playground", "seed": 3, "world": {"time": "day", "weather": "clear", "season": "winter"},
             "overlays": [{"kind": "title", "text": "Clap Clap Song", "sub": "Sing along!"}],
             "lines": [{"text": "Clap your hands"}, {"text": "Stomp your feet"}], "actors": [{"id": "ollie"}, {"id": "dot"}]},
            {"kind": "title", "location": "beach", "overlays": [{"kind": "title", "text": "Sandy Castle", "sub": "Story 2"}], "actors": []},
            story_scene("beach", {"time": "day", "weather": "clear", "season": "summer"}, ["sandcastle", "shell"], cast=("ollie", "dot")),
        ],
    }


def test_episode_context_splits_stories_and_songs() -> None:
    ctx = kt.episode_context(_doc())
    assert [s["title"] for s in ctx["stories"]] == ["The Big Snowman", "Sandy Castle"]
    assert ctx["stories"][0]["props"] == ["snowman", "carrot", "cup"]
    assert ctx["songs"][0]["lyrics"] == ["Clap your hands", "Stomp your feet"]
    assert "Story 2" in kt.context_for_llm(ctx)


def test_build_thumbs_survives_empty_llm_and_gives_three_distinct_layouts() -> None:
    ctx = kt.episode_context(_doc())
    th = kt.build_thumbs(None, ctx, "Snow Day Fun")
    assert len(th) == 3
    assert len({t["layout"] for t in th}) == 3
    for t in th:
        assert t["chars"] and all(c in kt.CHARS for c in t["chars"])
        assert t["location"] in kt.LOCS and set(t["world"]) == {"time", "weather", "season"}
        assert 1 <= len(t["text"].split()) <= 3 and len(t["text"]) <= 16
        assert t["badge"] == kt.SERIES


def test_thumb_props_follow_the_story_and_catalog() -> None:
    ctx = kt.episode_context(_doc())
    ideas = [
        {"layout": "world", "story": 1, "text": "SNOW DAY, 2024!!", "chars": ["benny", "zebra"], "emotions": ["scared"], "prop": "snowman", "location": "beach"},
        {"layout": "world", "story": 2, "text": "Beach fun", "chars": ["ollie"], "prop": "snowman"},  # дубль макета, снеговик на пляже
        {"layout": "learn", "story": 1, "text": "Learn colors", "chars": ["mia"], "colors": ["red", "blue", "purple-ish"]},
    ]
    a, b, c = kt.build_thumbs(ideas, ctx, "Snow Day Fun")
    assert a["layout"] == "world" and a["location"] == "garden" and a["world"]["weather"] == "snow"
    assert a["prop"] == "snowman" and a["emotions"] == ["happy"] and a["chars"][0] == "benny" and "zebra" not in a["chars"]
    assert "2024" not in a["text"] and "," not in a["text"]
    assert "winter_hat" in a["wear"][0]
    assert b["layout"] != "world" and b["location"] == "beach" and b["prop"] != "snowman"
    assert c["layout"] == "learn" and c["colors"] == ["red", "blue"]


def test_song_layout_uses_song_scene() -> None:
    ctx = kt.episode_context(_doc())
    t = kt.thumb_props({"layout": "song", "text": "Sing along"}, 0, ctx, "x", set())
    assert t["location"] == "playground" and t["chars"][:2] == ["ollie", "dot"] and len(t["chars"]) == 3


def test_titles_chapters_description() -> None:
    assert kt.kids_title("Snow Day Fun", True) == "Snow Day Fun | Benny & Friends | Nursery Rhymes & Kids Songs"
    assert len(kt.kids_title("A very long cartoon episode title about snowmen and friends", True)) <= 70
    assert kt.kids_title("SNOW DAY | old", False).startswith("Snow Day | Benny & Friends")
    assert kt.clean_chapters(["00:03 Intro", "00:08 Too soon", "01:10 Story", "02:30 Song"]) == ["00:00 Intro", "01:10 Story", "02:30 Song"]
    assert kt.clean_chapters(["00:00 Intro", "01:00 Story"]) == []
    ctx = kt.episode_context(_doc())
    d = kt.kids_description({"hook": "Hi parents", "learn": ["count"]}, ["00:00 Intro", "00:30 A", "01:30 B"], ctx, ["#kids"])
    assert "Clap your hands" in d and "00:00 Intro" in d and "subscribe" not in d.lower() and "comment" not in d.lower()
