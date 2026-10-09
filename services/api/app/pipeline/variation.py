"""Вариативность ролика из сида: палитра, раскладка, форма плашек, наклейки, закладка.
Сид сохраняется в ролике, поэтому рендер воспроизводим."""
from __future__ import annotations

import random
from typing import Any

from ..config import get_settings

STICKERS = ["heart", "star", "flower", "pizza", "italy"]
# Места для наклеек вне списка и вне кнопок YouTube (см. SAFE в packages/templates/src/lib/safe.ts)
STICKER_SPOTS = [(944, 420), (950, 600), (10, 1590), (860, 1600), (40, 1640)]


def pick_palette(rng: random.Random, allowed: list[str], all_palettes: dict[str, dict[str, Any]], avoid: set[str]) -> dict[str, Any]:
    pool = [p for p in allowed if p in all_palettes] or list(all_palettes)
    fresh = [p for p in pool if p not in avoid] or pool
    return dict(all_palettes[rng.choice(fresh)])


def build_theme(seed: int, series: Any, palettes: dict[str, dict[str, Any]], avoid_palettes: set[str]) -> dict[str, Any]:
    rng = random.Random(seed)
    palette = pick_palette(rng, list(series.palettes or []), palettes, avoid_palettes)
    fonts = [f for f in (series.fonts or ["Montserrat"]) if f in ("Montserrat", "Fredoka", "Nunito")] or ["Montserrat"]
    n_stickers = rng.choice([0, 1, 1, 2])
    avatar_on = (getattr(series, "avatar", None) or {}).get("mode", "none") != "none"
    free = [s for s in STICKER_SPOTS if not (avatar_on and s[1] > 1500)]  # нижняя полоса занята ведущей
    spots = rng.sample(free, min(n_stickers, len(free)))
    stickers = [{"name": rng.choice(STICKERS), "x": x, "y": y, "size": rng.choice([96, 110, 124]), "rotate": rng.randint(-18, 18)} for x, y in spots]
    return {
        "palette": palette,
        "font": rng.choice(fonts),
        "badge_shape": rng.choice(["rounded", "rounded", "square", "pill"]),
        "layout": rng.choice(["center", "center", "left"]),
        "stickers": stickers,
        "bookmark": {"enabled": rng.random() > 0.1, "position": rng.choice(["top_right", "top_right", "top_left", "mid_right"])},
        "watermark": get_settings().channel_handle,
        "show_progress_bar": True,
        "second_lang": series.second_lang,
    }


def similarity_index(themes: list[dict[str, Any]], hooks: list[str]) -> float:
    """0 = все разные, 1 = клоны. Доля совпадающих пар по палитре/раскладке/хуку среди соседних роликов пачки."""
    if len(themes) < 2:
        return 0.0
    score = 0.0
    for a, b, ha, hb in zip(themes, themes[1:], hooks, hooks[1:], strict=False):
        score += (a["palette"].get("name") == b["palette"].get("name")) * 0.4
        score += (a["layout"] == b["layout"] and a["badge_shape"] == b["badge_shape"]) * 0.2
        score += (ha == hb) * 0.4
    return round(score / (len(themes) - 1), 3)
