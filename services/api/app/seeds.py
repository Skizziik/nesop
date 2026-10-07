"""Идемпотентная загрузка сидов из /content: серии, банк уроков, хуки/CTA, палитры, SFX."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .formats import FORMATS, get_format
from .formats.base import content_hash
from .models import Asset, HookPattern, Lesson, Series
from .pipeline.sfx import GENERATORS, ensure_sfx

log = logging.getLogger("farm.seeds")


def lesson_to_script(raw: dict[str, Any], fmt: str, level: str) -> dict[str, Any]:
    """Компактная запись банка (items: [[a, b], ...]) → Script по схеме."""
    if fmt == "list_mystery":
        body = {
            "left_style": raw.get("left_style", "dark"),
            "speak": raw.get("speak", "right"),
            "hide": raw.get("hide", "right"),
            "reveal": bool(raw.get("reveal", False)),
            "items": [{"left": str(a), "right": str(b)} for a, b in raw["items"]],
        }
    else:
        body = raw["body"]
    return {"format": fmt, "title": raw["title"], "level": raw.get("level", level), "topic": raw.get("topic", ""), "body": body}


def load_yaml(p: Path) -> Any:
    return yaml.safe_load(p.read_text(encoding="utf-8"))


async def seed_all(s: AsyncSession) -> dict[str, int]:
    st = get_settings()
    root = st.content_dir
    stats = {"series": 0, "lessons": 0, "hooks": 0, "palettes": 0, "sfx": 0}

    # палитры
    existing_pal = {a.name for a in (await s.scalars(select(Asset).where(Asset.kind == "palette"))).all()}
    for pal in load_yaml(root / "palettes.yaml"):
        if pal["name"] not in existing_pal:
            s.add(Asset(kind="palette", name=pal["name"], data={"bg2": None, **pal}, license="own", source="content/palettes.yaml"))
            stats["palettes"] += 1

    # SFX — генерируются процедурно
    ensure_sfx(st.data_dir)
    existing_sfx = {a.name for a in (await s.scalars(select(Asset).where(Asset.kind == "sfx"))).all()}
    for name in GENERATORS:
        if name not in existing_sfx:
            s.add(Asset(kind="sfx", name=name, path=f"/sfx/{name}.wav", license="CC0 (процедурная генерация)", source="app/pipeline/sfx.py"))
            stats["sfx"] += 1

    # хуки и CTA
    hk = load_yaml(root / "hooks.yaml")
    existing_h = {(h.kind, h.text) for h in (await s.scalars(select(HookPattern))).all()}
    for kind, items in (("hook", hk["hooks"]), ("cta", hk["cta"])):
        for h in items:
            if (kind, h["text"]) in existing_h:
                continue
            s.add(HookPattern(kind=kind, text=h["text"], spoken=h.get("spoken", ""), type=h.get("type", "hidden_answer"), format=h.get("format"),
                              answer_mode=h.get("answer_mode"), source="seed"))
            stats["hooks"] += 1

    # серии и банк
    for sd in load_yaml(root / "series.yaml"):
        series = (await s.scalars(select(Series).where(Series.slug == sd["slug"]))).first()
        if series is None:
            series = Series(
                slug=sd["slug"], name=sd["name"], format=sd["format"], level=sd.get("level", "A1"), topic=sd.get("topic", ""),
                description=sd.get("description", ""), palettes=sd.get("palettes", []), fonts=sd.get("fonts", ["Montserrat", "Fredoka", "Nunito"]),
                voice=sd.get("voice", {}), auto_approve=sd.get("auto_approve", False), second_lang=sd.get("second_lang"),
            )
            s.add(series)
            await s.flush()
            stats["series"] += 1
        bank = root / "bank" / f"{sd['slug']}.yaml"
        if not bank.exists() or sd["format"] not in FORMATS:
            continue
        have = {x.slug for x in (await s.scalars(select(Lesson).where(Lesson.series_id == series.id))).all()}
        spec = get_format(sd["format"])
        for raw in load_yaml(bank):
            if raw["slug"] in have:
                continue
            script = lesson_to_script(raw, sd["format"], sd.get("level", "A1"))
            spec.body_model.model_validate(script["body"])  # сиды обязаны проходить схему
            s.add(Lesson(series_id=series.id, slug=raw["slug"], title=raw["title"], script=script, source=raw.get("source", "seed"),
                         content_hash=content_hash(spec.content_words(script))))
            stats["lessons"] += 1
    await s.commit()
    log.info("seeded %s", stats)
    return stats
