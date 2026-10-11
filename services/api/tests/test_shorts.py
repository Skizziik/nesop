"""Шортсы из мультика: выбор моментов (припев, смешное, вопрос) — чистые функции, без БД."""
from __future__ import annotations

from typing import Any

from app.pipeline.shorts import clip_doc, cut_points, fit_window, pick_moments, short_meta

BAR = 60 / 112 * 4


def story(start: float, beats: list[tuple[str, str, dict[str, Any]]], loc: str = "garden") -> dict[str, Any]:
    """Сцена истории как у Director.scene: реплики с паузами 0.5 с, вопрос — пауза 5 с с оверлеем «?»."""
    keys: dict[str, list[dict[str, Any]]] = {c: [{"t": 0, "x": x, "action": "idle", "emotion": "happy"}] for c, x in
                                             (("benny", 760), ("mia", 1160), ("ollie", 1460))}
    lines, overlays, items, t = [], [], [], 1.0
    for spk, text, ex in beats:
        dur = round(0.35 + 0.075 * len(text), 2)
        lines.append({"char": spk, "start": round(t, 3), "dur": dur, "text": text})
        keys[spk] += [{"t": round(t, 3), "action": "talk", "emotion": ex.get("emotion", "happy")}, {"t": round(t + dur, 3), "action": "idle"}]
        if ex.get("fx"):
            keys[spk].append({"t": round(t + 0.2, 3), "fx": ex["fx"]})
        if ex.get("throw"):
            items.append({"uid": f"b{len(items)}", "prop": "ball", "keys": [{"t": 0, "at": {"kind": "hand", "char": spk}},
                                                                            {"t": round(t + 0.5, 3), "at": {"kind": "hand", "char": ex["throw"]}, "anim": "throw"}]})
            keys[ex["throw"]].append({"t": round(t + 0.6, 3), "action": "catch", "emotion": "laugh"})
        t += dur + 0.5
        if ex.get("ask"):
            overlays.append({"t": round(t - 0.2, 3), "dur": 5.0, "kind": "question", "text": "?"})
            t += 5.3
    return {"location": loc, "kind": "story", "start": round(start, 3), "duration": round(t + 0.9, 3),
            "camera": [{"t": 0, "x": 1100, "zoom": 1.0}], "actors": [{"id": c, "keys": k} for c, k in keys.items()],
            "lines": lines, "overlays": overlays, **({"items": items} if items else {})}


def song(start: float) -> dict[str, Any]:
    chorus = ["Share, share, share with me", "Sharing makes us happy"]
    verse = ["I have a ball and you have none", "Let's play together, that is fun"]
    rows = chorus + verse + chorus + ["Round and round", "We all go round"] + chorus + chorus
    lines, ovs, at = [], [{"t": 0.3, "dur": BAR * 2 - 0.4, "kind": "title", "text": "The Sharing Song", "sub": "Sing along!"}], BAR * 2
    for i, row in enumerate(rows):
        lines.append({"char": ["benny", "mia"][i % 2], "start": round(at, 3), "dur": round(0.4 + 0.07 * len(row), 2), "text": row})
        ovs.append({"t": round(at, 3), "dur": round(BAR * 2 - 0.1, 3), "kind": "lyric", "text": row})
        at += BAR * 2
    return {"location": "playground", "kind": "song", "start": round(start, 3), "duration": round(at + BAR * 2, 3),
            "camera": [{"t": 0, "x": 960, "zoom": 1.0}], "actors": [{"id": "benny", "keys": [{"t": 0, "x": 700, "action": "dance", "emotion": "laugh"}]}],
            "lines": lines, "overlays": ovs}


def card(kind: str, start: float, dur: float) -> dict[str, Any]:
    return {"location": "garden", "kind": kind, "start": start, "duration": dur, "camera": [], "actors": [], "lines": []}


CHATTER = [("benny", "We are going to the park today!", {}), ("mia", "I love the park, it is so green.", {}),
           ("ollie", "Let's take a ball and a kite.", {}), ("benny", "Good idea, Ollie!", {}), ("mia", "Look at the big tree!", {})]


def episode(with_song: bool = True) -> dict[str, Any]:
    scenes = [card("intro", 0, 7.0), card("bumper", 7.0, 2.5)]
    t = 9.5
    s1 = story(t, CHATTER + [("mia", "Catch, Ollie!", {"throw": "ollie"}), ("ollie", "Ha ha! I caught it!", {"emotion": "laugh"}),
                             ("benny", "You are so good at this!", {"fx": "hearts"})] + CHATTER)
    scenes.append(s1)
    t += s1["duration"]
    s2 = story(t, CHATTER + [("mia", "Let's count the balls.", {}), ("benny", "How many balls can you see?", {"ask": True}),
                             ("mia", "Three! Three balls!", {"emotion": "laugh"}), ("ollie", "Sharing is fun!", {})] + CHATTER, loc="playground")
    scenes.append(s2)
    t += s2["duration"]
    if with_song:
        scenes.append(card("bumper", t, 2.5))
        t += 2.5
        sg = song(t)
        scenes.append(sg)
        t += sg["duration"]
    scenes.append(card("outro", t, 8.0))
    return {"title": "Sharing Is Fun", "fps": 30, "duration": t + 8.0, "scenes": scenes}


def _busy(doc: dict[str, Any]) -> list[tuple[float, float]]:
    out = []
    for sc in doc["scenes"]:
        out += [(sc["start"] + ln["start"], sc["start"] + ln["start"] + ln["dur"]) for ln in sc.get("lines") or []]
        out += [(sc["start"] + o["t"], sc["start"] + o["t"] + o["dur"]) for o in sc.get("overlays") or [] if o["kind"] in ("lyric", "question")]
    return out


def test_three_moments_in_order_with_safe_cuts() -> None:
    doc = episode()
    ms = pick_moments(doc)
    assert [m["kind"] for m in ms] == ["song", "funny", "question"]
    busy = _busy(doc)
    cards = [(s["start"], s["start"] + s["duration"]) for s in doc["scenes"] if s["kind"] in ("intro", "outro", "bumper")]
    for m in ms:
        assert 20.0 <= m["to"] - m["from"] <= 45.0, m
        for edge in (m["from"], m["to"]):  # ни слово, ни строка караоке, ни пауза-вопрос не режутся
            assert not any(b0 + 0.02 < edge < b1 - 0.02 for b0, b1 in busy), (m, edge)
        assert not any(m["from"] < c1 - 0.01 and c0 + 0.01 < m["to"] for c0, c1 in cards), m  # без заставок сериала
        assert m["title"]
    spans = sorted((m["from"], m["to"]) for m in ms)
    assert all(a[1] <= b[0] + 0.25 for a, b in zip(spans, spans[1:], strict=False))


def test_song_short_starts_with_the_song_and_holds_the_whole_chorus() -> None:
    doc = episode()
    sg = next(s for s in doc["scenes"] if s["kind"] == "song")
    m = pick_moments(doc)[0]
    assert m["kind"] == "song" and m["from"] == sg["start"]
    chorus_end = sg["start"] + sg["overlays"][2]["t"] + sg["overlays"][2]["dur"]  # 2 строки припева после титра
    assert m["to"] >= chorus_end - 0.01
    assert m["title"] == "Sing along: The Sharing Song"


def test_question_short_has_question_pause_and_answer() -> None:
    doc = episode()
    q = next(m for m in pick_moments(doc) if m["kind"] == "question")
    sc = next(s for s in doc["scenes"] if any(o["kind"] == "question" for o in s.get("overlays") or []))
    ov = next(o for o in sc["overlays"] if o["kind"] == "question")
    ans = next(ln for ln in sc["lines"] if ln["text"].startswith("Three"))
    assert q["from"] <= sc["start"] + ov["t"] and q["to"] >= sc["start"] + ans["start"] + ans["dur"]
    assert q["title"] == "How many balls can you see?"


def test_funny_short_contains_the_throw_and_the_laugh() -> None:
    doc = episode()
    f = next(m for m in pick_moments(doc) if m["kind"] == "funny")
    sc = doc["scenes"][2]
    laugh = next(ln for ln in sc["lines"] if ln["text"].startswith("Ha ha"))
    assert f["from"] <= sc["start"] + laugh["start"] and f["to"] >= sc["start"] + laugh["start"] + laugh["dur"]
    assert f["title"] in ("Throw and catch!", "Ha-ha! So silly!", "Aww, so sweet!")


def test_without_song_still_two_or_three_shorts() -> None:
    ms = pick_moments(episode(with_song=False))
    assert 2 <= len(ms) <= 3
    assert "song" not in [m["kind"] for m in ms]
    spans = sorted((m["from"], m["to"]) for m in ms)
    assert all(a[1] <= b[0] + 0.25 for a, b in zip(spans, spans[1:], strict=False))


def test_empty_or_cards_only_doc() -> None:
    assert pick_moments({"scenes": []}) == []
    assert pick_moments({"scenes": [card("intro", 0, 7), card("outro", 7, 8)]}) == []


def test_fit_window_extends_forward_and_respects_max() -> None:
    cuts = [float(x) for x in range(0, 100, 4)]
    assert fit_window(cuts, 10, 14, pre=1, post=1) == (8.0, 28.0)
    w = fit_window(cuts, 10, 90, pre=0, post=0)
    assert w is not None and w[1] - w[0] <= 45
    assert fit_window([0.0, 5.0], 1, 2) is None  # слишком короткий блок
    assert fit_window(cuts, 10, 14, used=[(0.0, 30.0)]) is None


def test_cut_points_avoid_lines_and_lyrics() -> None:
    sg = song(100.0)
    cuts = cut_points([sg])
    assert cuts[0] == 100.0 and cuts[-1] == round(100.0 + sg["duration"], 3)
    for o in sg["overlays"]:
        if o["kind"] == "lyric":
            a, b = 100 + o["t"], 100 + o["t"] + o["dur"]
            assert not any(a + 0.02 < c < b - 0.02 for c in cuts)


def test_short_meta_is_kid_safe() -> None:
    meta = short_meta({"title": "Sharing Is Fun"}, {"title": "Sing along!", "kind": "song"})
    assert meta["made_for_kids"] is True
    assert "#shorts" in meta["title"] and len(meta["title"]) <= 100
    assert "subscribe" not in (meta["title"] + meta["description"]).lower()


def test_clip_doc_keeps_only_scenes_near_the_window() -> None:
    doc = episode()
    m = pick_moments(doc)[0]
    small = clip_doc(doc, m["from"], m["to"])
    assert [s["kind"] for s in small["scenes"]] == ["bumper", "song"]  # соседняя перебивка — для склейки на краю
    assert len(doc["scenes"]) > len(small["scenes"])
