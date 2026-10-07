"""Пропсы-образцы для каждого формата из первого урока банка (синтетический звук). Для golden-тестов и визуальной проверки.
`python -m scripts.sample_props OUT_DIR`"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import yaml

from app.config import get_settings
from app.formats import FORMATS, get_format
from app.formats.base import TimingConfig
from app.pipeline import variation
from app.pipeline.audio import SR, assemble
from app.pipeline.produce import make_render_props
from app.seeds import lesson_to_script

HOOK = {"list_mystery": "Il 90% sbaglia l'ultima", "quiz_abc": "Hai solo 3 secondi", "fill_blank": "Di, a o da?", "spot_the_error": "C'è un errore. Lo vedi?",
        "false_friends": "Non è quello che pensi!", "emoji_vocab": "Come si dice?", "level_ladder": "Che livello sei?", "conjugation_challenge": "Quali forme mancano?",
        "tongue_twister": "Riesci a dirlo veloce?", "idiom": "Non tradurlo alla lettera!", "daily_word": "Parola del giorno!"}


def main(out: Path) -> None:
    root = get_settings().content_dir
    series = yaml.safe_load((root / "series.yaml").read_text(encoding="utf-8"))
    palettes = {p["name"]: {"bg2": None, **p} for p in yaml.safe_load((root / "palettes.yaml").read_text(encoding="utf-8"))}
    out.mkdir(parents=True, exist_ok=True)
    done: set[str] = set()
    for sd in series:
        fmt = sd["format"]
        if fmt in done or fmt not in FORMATS:
            continue
        raw = yaml.safe_load((root / "bank" / f"{sd['slug']}.yaml").read_text(encoding="utf-8"))[0]
        script = lesson_to_script(raw, fmt, sd.get("level", "A1"))
        script |= {"hook_text": HOOK[fmt], "comment_hook": {"type": "hidden_answer", "text": "Scrivi nei commenti 👇", "spoken": "Scrivilo nei commenti!"}}
        spec = get_format(fmt)
        timing = TimingConfig()
        segs = spec.segments(script, "Scrivilo nei commenti!", timing)
        clips = {s.key: np.full(int(SR * min(0.25 + 0.055 * len(s.text), 3.0)), 0.1, np.float32) for s in segs if s.text}
        track = assemble(segs, clips, timing.lead_in)
        theme = variation.build_theme(11, SimpleNamespace(palettes=sd.get("palettes", []), fonts=["Montserrat"], second_lang=sd.get("second_lang")), palettes, set())
        props = make_render_props(script, theme, track, voice_url=None, episode_no=7, seed=11)
        (out / f"{fmt}.json").write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")
        done.add(fmt)
    print(f"{len(done)} форматов → {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
