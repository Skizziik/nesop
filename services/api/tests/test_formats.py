from __future__ import annotations

import numpy as np

from app.formats import get_format
from app.formats.base import TimingConfig, content_hash, join_pair, speech_text
from app.pipeline.audio import SR, assemble

SCRIPT = {
    "format": "list_mystery",
    "title": "Essere: presente",
    "hook_text": "Il 90% sbaglia l'ultima",
    "body": {"left_style": "dark", "speak": "both", "hide": "right", "items": [
        {"left": "io", "right": "sono"}, {"left": "tu", "right": "sei"}, {"left": "lui/lei", "right": "è"},
        {"left": "noi", "right": "siamo"}, {"left": "voi", "right": "siete"}, {"left": "loro", "right": "sono"},
    ]},
}


def test_speech_helpers() -> None:
    assert speech_text("sono andato/a") == "sono andato"
    assert speech_text("lui/lei è") == "lui è"
    assert join_pair("l'", "acqua") == "l'acqua"
    assert join_pair("un'", "amica") == "un'amica"
    assert join_pair("io", "sono") == "io sono"


def test_segments_hide_last_and_speak_visible_half() -> None:
    spec = get_format("list_mystery")
    segs = spec.segments(SCRIPT, "E l'ultima? Scrivila nei commenti!", TimingConfig())
    keys = [s.key for s in segs]
    assert keys == ["hook", *[f"item:{i}" for i in range(6)], "cta"]
    by = {s.key: s.text for s in segs}
    assert by["item:2"] == "lui è"
    assert by["item:5"] == "loro"  # ответ «sono» не произносится
    assert spec.answer(SCRIPT) == "sono"


def test_timeline_deterministic_with_fixed_audio() -> None:
    spec = get_format("list_mystery")
    timing = TimingConfig()
    segs = spec.segments(SCRIPT, "Scrivila!", timing)
    clips = {s.key: np.full(int(SR * 0.5), 0.1, np.float32) for s in segs if s.text}
    t1 = assemble(segs, clips, timing.lead_in)
    t2 = assemble(segs, clips, timing.lead_in)
    tl = spec.timeline(SCRIPT, t1.placements, t1.total)
    assert tl == spec.timeline(SCRIPT, t2.placements, t2.total)
    hi = [e for e in tl if e["action"] == "highlight"]
    assert [e["target"] for e in hi] == list(range(6))
    # подсветки идут встык и ритм 0.9-1.4 сек
    for a, b in zip(hi, hi[1:], strict=False):
        assert a["t_end"] == b["t_start"]
        assert 0.85 <= a["t_end"] - a["t_start"] <= 1.4
    assert tl[0]["action"] == "hook" and tl[0]["t_start"] == 0.0
    assert hi[-1]["t_end"] == round(t1.total, 3)


def test_rules_catch_apostrophe_accent_and_dupes() -> None:
    spec = get_format("list_mystery")
    bad = {**SCRIPT, "body": {**SCRIPT["body"], "items": [
        {"left": "io", "right": "sono"}, {"left": "lui", "right": "e'"}, {"left": "x", "right": "l 'acqua"},
        {"left": "io", "right": "sono"},
    ]}}
    msgs = [i.message for i in spec.rules(bad)]
    assert any("акцент" in m for m in msgs)
    assert any("апостроф" in m for m in msgs)
    assert any("Дубль" in m for m in msgs)
    assert spec.rules(SCRIPT) == [] or all(i.severity == "warning" for i in spec.rules(SCRIPT))


def test_content_hash_order_independent() -> None:
    assert content_hash(["a=b", "c=d"]) == content_hash(["c=d", "A=B"])
