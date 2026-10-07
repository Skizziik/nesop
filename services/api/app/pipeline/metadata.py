"""Метаданные ролика. Этап 1 — по правилам; на этапе 3 LLM генерирует варианты, а этот модуль остаётся валидатором."""
from __future__ import annotations

from typing import Any

TITLE_MAX = 70
BASE_TAGS = ["italiano", "imparare italiano", "learn italian", "italian lesson", "lingua italiana", "shorts"]
LEVEL_EMOJI = {"A1": "🟢", "A2": "🟢", "B1": "🟡", "B2": "🟡", "C1": "🔴", "C2": "🔴"}


def _clip(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def build(script: dict[str, Any], answer: str, series_name: str, episode_no: int | None, hook_text: str, answer_mode: str) -> dict[str, Any]:
    title = script["title"]
    level = script.get("level", "A1")
    a = _clip(f"{hook_text} 🇮🇹 {title}", TITLE_MAX) if hook_text else _clip(f"{title} 🇮🇹 #shorts", TITLE_MAX)
    b = _clip(f"{title} {LEVEL_EMOJI.get(level, '')} Sai l'ultima?".replace("  ", " "), TITLE_MAX)
    topic_tag = "#" + "".join(ch for ch in series_name.lower() if ch.isalnum())
    hashtags = ["#italiano", "#imparareitaliano", "#learnitalian", topic_tag, "#shorts"][:5]
    if answer_mode == "reveal":
        pinned = f"✅ Risposta: {answer.upper()}. Quante ne sapevi? 👇"
        ask = "Quante ne sapevi? Scrivilo nei commenti 👇"
    elif answer_mode == "answer_tomorrow":
        pinned = f"✅ Risposta: {answer.upper()}! Chi l'aveva indovinata? 🙌"
        ask = "Qual è l'ultima? Scrivila nei commenti: la soluzione arriva domani ⏰"
    else:
        pinned = f"✅ Risposta: {answer.upper()}. L'avevi indovinata? 🙌"
        ask = "Qual è l'ultima? Scrivila nei commenti 👇"
    ep = f" · Episodio {episode_no}" if episode_no else ""
    description = f"{title} — livello {level}{ep}.\n{ask}\n\nSerie: {series_name}\n\n" + " ".join(hashtags)
    tags = list(dict.fromkeys([*BASE_TAGS, title.lower(), series_name.lower(), f"italiano {level}"]))
    return {
        "title": a,
        "title_variants": {"A": a, "B": b},
        "description": description,
        "tags": tags,
        "hashtags": hashtags,
        "pinned_comment": pinned,
        "answer": answer,
        "playlist": series_name,
        "episode_no": episode_no,
    }


def check(meta: dict[str, Any]) -> list[str]:
    errs = []
    for k, v in meta.get("title_variants", {}).items():
        if len(v) > TITLE_MAX:
            errs.append(f"title {k} длиннее {TITLE_MAX}")
    if not 3 <= len(meta.get("hashtags", [])) <= 5:
        errs.append("hashtags: нужно 3-5")
    return errs
