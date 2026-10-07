from __future__ import annotations

import json
import random
from pathlib import Path
from types import SimpleNamespace

import jsonschema
import numpy as np
import yaml

from app.config import get_settings
from app.formats import get_format
from app.formats.base import TimingConfig
from app.pipeline import metadata, variation
from app.pipeline.audio import SR, assemble, envelope, trim_silence
from app.pipeline.produce import make_render_props

SCHEMAS = get_settings().schemas_dir if get_settings().schemas_dir.exists() else Path(__file__).resolve().parents[3] / "schemas"


def _palettes() -> dict[str, dict]:
    return {p["name"]: {"bg2": None, **p} for p in yaml.safe_load((get_settings().content_dir / "palettes.yaml").read_text(encoding="utf-8"))}


def test_trim_silence_and_envelope() -> None:
    a = np.zeros(SR, np.float32)
    a[SR // 2 : SR // 2 + 4410] = 0.5
    t = trim_silence(a)
    assert 0.1 < len(t) / SR < 0.2
    env = envelope(np.concatenate([np.zeros(SR, np.float32), np.ones(SR, np.float32) * 0.3]))
    assert len(env) == 60 and env[0] == 0 and env[-1] == 1.0


def test_render_props_match_json_schema() -> None:
    spec = get_format("list_mystery")
    script = {"format": "list_mystery", "title": "Numeri a una cifra", "hook_text": "Indovina l'ultima!",
              "comment_hook": {"type": "hidden_answer", "text": "Scrivila! 👇"},
              "body": {"left_style": "badge", "speak": "right", "hide": "right", "items": [{"left": str(i), "right": w}
                                                                                for i, w in enumerate(["zero", "uno", "due", "tre", "quattro"])]}}
    timing = TimingConfig()
    segs = spec.segments(script, "Scrivila!", timing)
    track = assemble(segs, {s.key: np.full(int(SR * 0.4), 0.2, np.float32) for s in segs if s.text}, timing.lead_in)
    series = SimpleNamespace(palettes=["lavanda", "blu"], fonts=["Montserrat"], second_lang=None)
    theme = variation.build_theme(7, series, _palettes(), set())
    props = make_render_props(script, theme, track, voice_url="/media/x/voice.wav", seed=7)
    schema = json.loads((SCHEMAS / "render_props.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(props, schema)
    body_schema = json.loads((SCHEMAS / "formats" / "list_mystery.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(props["body"], body_schema)
    assert props["audio"]["sfx"][0]["name"] == "pop"


def test_variation_reproducible_and_no_consecutive_palette() -> None:
    series = SimpleNamespace(palettes=["lavanda", "blu", "limone"], fonts=["Montserrat", "Fredoka"], second_lang=None)
    pals = _palettes()
    assert variation.build_theme(123, series, pals, set()) == variation.build_theme(123, series, pals, set())
    prev = None
    rng = random.Random(1)
    for _ in range(30):
        th = variation.build_theme(rng.randrange(10**9), series, pals, {prev} if prev else set())
        assert th["palette"]["name"] != prev
        prev = th["palette"]["name"]


def test_metadata_limits() -> None:
    m = metadata.build({"title": "Plurale: parole in -io con un titolo davvero molto lungo", "level": "A2"}, "baci", "Plurali", 12,
                       "Scommetto che sbagli l'ultima", "hide")
    assert metadata.check(m) == []
    assert len(m["title"]) <= 70 and "BACI" in m["pinned_comment"]
