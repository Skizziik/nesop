"""Арт-директор и анти-повтор: отпечаток, похожесть, применение плана, квота разнообразия."""
from __future__ import annotations

from app.pipeline import cartoon_art as art

DOC = {
    "scenes": [
        {"kind": "intro", "location": "garden"},
        {"kind": "story", "location": "park_pond", "world": {"time": "morning", "weather": "rain", "season": "spring"}, "items": [{"prop": "umbrella"}]},
        {"kind": "story", "location": "garden", "world": {"time": "evening", "weather": "clear", "season": "spring"}, "props": [{"id": "ball"}]},
    ]
}
PLAN = {"stories": [{"title": "Puddle Jump", "key_words": ["Splash", "rain"]}]}


def test_fingerprint_counts_only_story_scenes() -> None:
    fp = art.fingerprint(DOC, PLAN)
    assert fp["locations"] == {"park_pond": 1, "garden": 1}
    assert set(fp["props"]) == {"umbrella", "ball"}
    assert "morning/rain/spring" in fp["worlds"]
    assert fp["key_words"] == ["rain", "splash"] and fp["titles"] == ["Puddle Jump"]


def test_similarity_identical_is_one_and_disjoint_is_zero() -> None:
    fp = art.fingerprint(DOC, PLAN)
    assert art.similarity(fp, fp) == 1.0
    other = {"locations": {"beach": 1}, "worlds": {"day/clear/summer": 1}, "props": {"bucket": 1}, "key_words": ["shell"]}
    assert art.similarity(fp, other) == 0.0


def test_recent_usage_and_hint() -> None:
    u = art.recent_usage([art.fingerprint(DOC, PLAN)] * 3)
    assert "garden" in u["locations"] and "Puddle Jump" in u["titles"]
    assert "Puddle Jump" in art.usage_hint(u)
    assert art.usage_hint(art.recent_usage([])) == ""


def test_apply_art_sets_world_shots_and_transition() -> None:
    story = {"scenes": [{"location": "garden", "beats": [{}, {}]}, {"location": "forest", "beats": [{}]}]}
    shots = [{"beat": 0, "shot": "push_in"}, {"beat": "x", "shot": "insert"}]
    plan = {"scenes": [{"scene_index": 1, "time": "evening", "weather": "windy", "transition_in": "iris", "special_shots": shots},
                       {"scene_index": 7, "time": "night"}]}
    out = art.apply_art(story, plan)
    sc = out["scenes"][1]
    assert sc["time"] == "evening" and sc["weather"] == "windy" and sc["transition_in"] == "iris"
    assert sc["special_shots"] == [{"beat": 0, "shot": "push_in"}]
    assert "time" not in out["scenes"][0]


def test_enforce_variety_changes_a_scene_when_all_look_the_same() -> None:
    scenes = [{"location": "garden", "time": "day", "weather": "clear", "beats": [{}]}, {"location": "forest", "time": "day", "weather": "clear", "beats": [{}]}]
    notes = art.enforce_variety(scenes)
    assert notes and scenes[1]["time"] != "day"
    varied = [{"location": "garden", "time": "day", "beats": [{}]}, {"location": "forest", "time": "evening", "beats": [{}]}]
    assert art.enforce_variety(varied) == []


def test_qa_checks_find_overlaps_absent_speakers_and_busy_camera() -> None:
    doc = {"scenes": [{"kind": "story", "duration": 10, "camera": [{"t": 0}, {"t": 1}, {"t": 2}, {"t": 3}],
                       "actors": [{"id": "benny", "keys": [{"t": 0, "x": 900}]}, {"id": "mia", "keys": [{"t": 0, "x": 1000}]}],
                       "lines": [{"char": "dot", "text": "Woof woof", "dur": 1.0}],
                       "items": [{"prop": "ball", "keys": [{"t": 1, "at": {"kind": "hand", "char": "ollie"}}]}]}]}
    qa = art.qa_checks(doc)
    text = " | ".join(qa["issues"])
    assert "benny and mia overlap" in text and "dot speaks but is not in the scene" in text and "absent ollie" in text
    ok = {"scenes": [{"kind": "story", "duration": 12, "camera": [{"t": 0}],
                      "actors": [{"id": "benny", "keys": [{"t": 0, "x": 700}]}, {"id": "mia", "keys": [{"t": 0, "x": 1100}]}],
                      "lines": [{"char": "mia", "text": "Hello Benny, look at this", "dur": 2.5}]}]}
    assert art.qa_checks(ok)["issues"] == []
