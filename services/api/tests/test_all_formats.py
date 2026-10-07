"""Все форматы: каждый урок банка проходит схему и правила, таймлайн детерминирован, события в пределах ролика."""
from __future__ import annotations

import numpy as np
import pytest
import yaml

from app.config import get_settings
from app.formats import FORMATS, get_format
from app.formats.base import TimingConfig
from app.pipeline.audio import SR, assemble
from app.seeds import lesson_to_script


def _lessons() -> list[tuple[str, dict]]:
    root = get_settings().content_dir
    series = {s["slug"]: s for s in yaml.safe_load((root / "series.yaml").read_text(encoding="utf-8"))}
    out = []
    for f in sorted((root / "bank").glob("*.yaml")):
        sd = series[f.stem]
        for raw in yaml.safe_load(f.read_text(encoding="utf-8")):
            out.append((f"{f.stem}/{raw['slug']}", lesson_to_script(raw, sd["format"], sd.get("level", "A1"))))
    return out


LESSONS = _lessons()


def test_every_format_has_a_series_with_bank() -> None:
    assert {s["format"] for _, s in LESSONS} == set(FORMATS)


@pytest.mark.parametrize("name,script", LESSONS, ids=[n for n, _ in LESSONS])
def test_lesson_valid_and_timeline_sane(name: str, script: dict) -> None:
    spec = get_format(script["format"])
    spec.body_model.model_validate(script["body"])
    errors = [i for i in spec.rules(script) if i.severity == "error"]
    assert not errors, errors
    script = {**script, "hook_text": "Indovina!", "comment_hook": {"type": "hidden_answer", "text": "Scrivi 👇", "spoken": "Scrivilo!"}}
    timing = TimingConfig()
    segs = spec.segments(script, "Scrivilo!", timing)
    assert len({s.key for s in segs}) == len(segs), "ключи сегментов уникальны"
    clips = {s.key: np.full(int(SR * min(0.2 + 0.06 * len(s.text), 3.0)), 0.1, np.float32) for s in segs if s.text}
    t1 = assemble(segs, clips, timing.lead_in)
    tl = spec.timeline(script, t1.placements, t1.total)
    assert tl == spec.timeline(script, assemble(segs, clips, timing.lead_in).placements, t1.total)
    assert 3 <= t1.total <= 60
    for e in tl:
        assert 0 <= e["t_start"] <= e["t_end"] <= round(t1.total, 3) + 1e-6, e
    for x in spec.sfx(tl):
        assert 0 <= x["t"] <= t1.total
    assert isinstance(spec.answer(script), str)
    assert spec.content_words(script)
