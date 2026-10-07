"""Автопроверки скрипта: правила формата, LanguageTool (self-hosted), Hunspell it_IT, LLM-верификатор, дедуп."""
from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .formats import get_format
from .formats.base import content_hash
from .models import ChannelTitle, Lesson, Video, VideoStatus

log = logging.getLogger("farm.checks")
DIC = Path("/usr/share/hunspell/it_IT")
# Правила LanguageTool, которые на коротких строках без контекста дают ложные срабатывания
LT_IGNORE = {"UPPERCASE_SENTENCE_START", "PUNCTUATION_PARAGRAPH_END", "WHITESPACE_RULE", "ITALIAN_WORD_REPEAT_RULE", "COMMA_PARENTHESIS_WHITESPACE"}
_WORD = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ']+")


def issue(field: str, message: str, source: str, severity: str = "error") -> dict[str, str]:
    return {"field": field, "message": message, "severity": severity, "source": source}


# ------------------------------------------------------------------ Hunspell
@lru_cache(maxsize=1)
def _dictionary() -> Any:
    if not DIC.with_suffix(".dic").exists():
        return None
    from spylls.hunspell import Dictionary

    return Dictionary.from_files(str(DIC))


def hunspell_check(pairs: list[tuple[str, str]]) -> list[dict[str, str]]:
    d = _dictionary()
    if d is None:
        return [issue("body", "Словарь hunspell-it не установлен — орфография по словарю пропущена", "hunspell", "warning")]
    out = []
    for path, text in pairs:
        for w in _WORD.findall(text):
            w = w.strip("'")
            if len(w) < 2 or w.isupper() and len(w) <= 3:
                continue
            # элизии «l'acqua», «dell'anno»: проверяем часть после апострофа
            parts = [p for p in w.split("'") if p]
            for p in parts:
                if not (d.lookup(p) or d.lookup(p.lower())):
                    sugg = list(d.suggest(p))[:3]
                    out.append(issue(path, f"Нет в словаре: «{p}»" + (f" (может быть: {', '.join(sugg)})" if sugg else ""), "hunspell"))
    return out


# ------------------------------------------------------------------ LanguageTool
async def languagetool_check(pairs: list[tuple[str, str]]) -> list[dict[str, str]]:
    st = get_settings()
    out: list[dict[str, str]] = []
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            for path, text in pairs:
                if not text.strip() or text.replace(" ", "").isdigit():
                    continue
                r = await c.post(f"{st.languagetool_url}/v2/check", data={"language": "it", "text": text, "disabledRules": ",".join(LT_IGNORE)})
                r.raise_for_status()
                for m in r.json().get("matches", []):
                    rule = m.get("rule", {})
                    cat = rule.get("category", {}).get("id", "")
                    if rule.get("id") in LT_IGNORE or cat in {"TYPOGRAPHY", "CASING"}:
                        continue
                    repl = ", ".join(x["value"] for x in m.get("replacements", [])[:3])
                    sev = "error" if cat in {"TYPOS", "GRAMMAR", "CONFUSED_WORDS"} else "warning"
                    out.append(issue(path, f"LanguageTool: {m.get('message', '')}" + (f" → {repl}" if repl else ""), "languagetool", sev))
    except httpx.HTTPError as e:
        log.warning("languagetool unavailable: %s", e)
        return [issue("body", "LanguageTool недоступен — проверка пропущена", "languagetool", "warning")]
    return out


# ------------------------------------------------------------------ дедуп
async def dedup_check(s: AsyncSession, script: dict[str, Any], series_id: str | None, exclude_video: str | None = None, threshold: int = 92) -> list[dict[str, str]]:
    spec = get_format(script["format"])
    h = content_hash(spec.content_words(script))
    out = []
    q = select(Video.id, Video.title).where(Video.content_hash == h, Video.status.in_([VideoStatus.ready, VideoStatus.published, VideoStatus.scheduled]))
    if exclude_video:
        q = q.where(Video.id != exclude_video)
    dup = (await s.execute(q.limit(1))).first()
    if dup:
        out.append(issue("body", f"Точно такой же набор слов уже был в ролике «{dup.title}»", "dedup"))
    title = script.get("title", "")
    titles = list((await s.scalars(select(ChannelTitle.title))).all())
    if series_id:
        titles += list((await s.scalars(select(Video.title).where(Video.series_id == series_id, Video.status.in_([VideoStatus.ready, VideoStatus.published])))).all())
    for t in titles:
        if t and fuzz.token_sort_ratio(title.lower(), t.lower()) >= threshold:
            out.append(issue("title", f"Заголовок почти совпадает с уже сделанным: «{t}»", "dedup", "warning"))
            break
    return out


async def lesson_exists(s: AsyncSession, series_id: str, script: dict[str, Any]) -> bool:
    spec = get_format(script["format"])
    h = content_hash(spec.content_words(script))
    return (await s.execute(select(Lesson.id).where(Lesson.series_id == series_id, Lesson.content_hash == h).limit(1))).first() is not None


# ------------------------------------------------------------------ всё вместе
async def full_check(s: AsyncSession, script: dict[str, Any], series_id: str | None, *, video_id: str | None = None, use_llm: bool = True,
                     use_spelling: bool = True) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """Возвращает (issues, script). Если LLM-верификатор предложил исправление — script уже исправлен, а исправления видны в issues как warning."""
    from .pipeline.produce import validate_script

    issues = validate_script(script)
    if any(i["source"] == "schema" for i in issues):
        return issues, script
    if use_llm:
        from .llm.generate import verify_script
        from .llm.providers import LLMError

        try:
            v = await verify_script(s, script, video_id)
            if v["fixed_script"] != script and v["issues"]:
                script = v["fixed_script"]
                issues += [{**i, "severity": "warning", "message": f"Исправлено LLM: {i['message']}"} for i in v["issues"]]
                issues = [i for i in validate_script(script)] + [i for i in issues if i["source"] == "llm"]
            else:
                issues += v["issues"]
        except LLMError as e:
            issues.append(issue("body", f"LLM-верификатор недоступен: {e}", "llm", "warning"))
    if use_spelling:
        pairs = get_format(script["format"]).italian_words(script)
        issues += hunspell_check(pairs)
        issues += await languagetool_check(pairs)
    issues += await dedup_check(s, script, series_id, video_id)
    return issues, script
