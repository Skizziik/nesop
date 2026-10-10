"""YouTube-пакет проекта: 3 обложки (A/B-тест YouTube «Test & Compare»), варианты названия, описание с главами, теги, хештеги.

Тексты пишет LLM, таймкоды глав берутся из таймлайна (всегда точные), обложки рендерит Remotion (композиция Thumbnail).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from ..config import get_settings
from ..db import SessionLocal
from ..llm.generate import get_provider
from ..llm.providers import LLMError
from ..models import Project
from . import clients

log = logging.getLogger("farm.youtube")

SYSTEM_YT = (
    f"You are a YouTube growth strategist for «{get_settings().channel_name}» ({get_settings().channel_handle}), a channel that teaches Italian to ENGLISH-speaking learners. "
    "You write click-worthy but honest packaging: no fake promises, no clickbait the video doesn't deliver. "
    "Everything is in English, with the Italian key words of the lesson kept in Italian. Never use Russian."
)

YT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "titles": {"type": "array", "items": {"type": "string"}, "description": "3 title variants, ≤ 70 chars, curiosity + clear benefit, include the Italian key phrase"},
        "hook": {"type": "string", "description": "First 2 lines of the description (shown above 'more'): why watch, ≤ 220 chars"},
        "learn": {"type": "array", "items": {"type": "string"}, "description": "3-6 short bullet points: what you'll learn"},
        "cta": {"type": "string", "description": "Call to action: comment a sentence in Italian, subscribe — 1-2 lines"},
        "tags": {"type": "array", "items": {"type": "string"}, "description": "15-20 search tags, mix of broad (learn italian) and specific (passato prossimo essere avere)"},
        "hashtags": {"type": "array", "items": {"type": "string"}, "description": "3-5 hashtags with #"},
        "thumbs": {
            "type": "array",
            "description": "3 DIFFERENT thumbnail ideas for A/B testing",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string",
                             "description": "2-4 BIG words, max 22 chars, readable at phone size; Italian key phrase or a punchy English hook. No numbers, durations or commas"},
                    "highlight": {"type": "string", "description": "ONE word from text to highlight in color"},
                    "emotion": {"type": "string", "enum": ["surprised", "happy", "thinking"]},
                },
            },
        },
    },
}


def _mmss(t: float) -> str:
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60:02d}:{t % 60:02d}"


def chapters_of(doc: dict[str, Any]) -> list[str]:
    """Главы YouTube из таймлайна: титульные слайды «Capitolo N». Первая строка обязана быть 00:00."""
    marks = ["00:00 Intro"]
    slides = sorted((c for t in doc.get("tracks", []) if t.get("kind") == "scene" for c in t["clips"] if c.get("type") == "slide"), key=lambda c: c["start"])
    for c in slides:
        p = c.get("props") or {}
        if p.get("kind") == "title" and str(p.get("chapter", "")).startswith("Capitolo") and c["start"] >= 10:
            en, it = p.get("title_en") or "", p.get("title") or ""
            marks.append(f"{_mmss(c['start'])} {en or it}" + (f" ({it})" if en and it else ""))
    return marks if len(marks) >= 3 else []  # YouTube требует ≥ 3 глав, иначе таймкоды не нужны


def _fallback(title: str, level: str) -> dict[str, Any]:
    return {
        "titles": [f"{title[:58]} 🇮🇹 Learn Italian ({level})"],
        "hook": f"Learn {title} in Italian, step by step, with clear examples and practice.",
        "learn": [],
        "cta": "Write an example sentence in Italian in the comments! 👇",
        "tags": ["learn italian", "italian lesson", "italian grammar", "italiano", "italian for beginners"],
        "hashtags": ["#learnitalian", "#italianlesson", "#italiano"],
        "thumbs": [{"text": title[:22], "highlight": title.split()[0] if title.split() else "", "emotion": "surprised"}],
    }


async def build_youtube(project_id: str) -> dict[str, Any]:
    """Собирает и сохраняет meta.youtube проекта. Ошибки LLM/рендера не роняют лекцию — берётся запасной вариант."""
    async with SessionLocal() as s:
        p = await s.get(Project, project_id)
        if p is None or not p.doc:
            return {}
        if "scenes" in p.doc:
            return await build_youtube_cartoon(project_id)
        doc, params, meta = dict(p.doc), dict(p.params or {}), dict(p.meta or {})
        level = str(params.get("level", "A2"))
        topic = str(params.get("topic") or doc.get("title", ""))
        title = str(doc.get("title") or topic)
        chapters = chapters_of(doc)
        outline = meta.get("outline") or {}
        mascot = next((c["props"].get("character") for t in doc.get("tracks", []) if t.get("kind") == "mascot" for c in t["clips"]), None) or params.get("mascot") or "espresso"
        try:
            prov = await get_provider(s)
            user = (
                f"Lesson video ({len(chapters) - 1 if chapters else 0} chapters, {round(float(doc.get('duration_s', 0)) / 60)} min, level {level}).\n"
                f"Title on screen: {title}\nTopic: {topic}\nSubtitle: {outline.get('subtitle', '')}\n"
                f"Chapters: {[c.split(' ', 1)[1] for c in chapters[1:]] if chapters else [c.get('title') for c in outline.get('chapters', [])]}\n\n"
                "Write the YouTube packaging. Thumbnails: 3 clearly different angles (e.g. the core question, a common mistake, a promise of ease). "
                "Hashtags: first one #learnitalian."
            )
            r = await prov.complete_json(SYSTEM_YT, user, YT_SCHEMA, purpose="youtube_meta", max_tokens=3000, effort="medium")
            pack = dict(r.data)
        except LLMError as e:
            log.warning("youtube meta via LLM failed: %s", e)
            pack = _fallback(title, level)

    thumbs = (pack.get("thumbs") or [])[:3] or _fallback(title, level)["thumbs"]
    urls: list[str] = []
    stamp = int(time.time())
    for i, th in enumerate(thumbs):
        rel = f"projects/{project_id}/thumb-{stamp}-{i}.png"
        props = {"text": str(th.get("text") or title)[:28], "highlight": str(th.get("highlight") or ""), "sub": f"Learn Italian · {level}", "badge": level,
                 "mascot": mascot, "emotion": th.get("emotion") or "surprised", "variant": i}
        try:
            await clients.still(props, rel, composition="Thumbnail")
            urls.append(f"/media/{rel}")
        except clients.ServiceError as e:
            log.warning("thumbnail %s failed: %s", i, e)

    hashtags = [h if h.startswith("#") else f"#{h}" for h in (pack.get("hashtags") or [])][:5]
    learn = [f"• {x}" for x in (pack.get("learn") or [])][:6]
    parts = [str(pack.get("hook", "")).strip()]
    if learn:
        parts.append("📚 In this lesson you'll learn:\n" + "\n".join(learn))
    if chapters:
        parts.append("⏱ Chapters:\n" + "\n".join(chapters))
    parts.append(str(pack.get("cta", "")).strip())
    st = get_settings()
    parts.append(f"☕ {st.channel_name} — {st.channel_tagline}. Subscribe: https://www.youtube.com/{st.channel_handle}?sub_confirmation=1")
    parts.append(" ".join(hashtags))
    titles = [t[:100] for t in (pack.get("titles") or [])][:3] or _fallback(title, level)["titles"]
    yt = {
        "title": titles[0],
        "titles": titles,
        "description": "\n\n".join(x for x in parts if x),
        "tags": [t for t in (pack.get("tags") or [])][:20],
        "hashtags": hashtags,
        "chapters": chapters,
        "thumbnails": urls,
        "thumbnail_texts": thumbs,
        "generated_at": stamp,
    }
    async with SessionLocal() as s:
        p = await s.get(Project, project_id)
        if p is not None:
            p.meta = {**(p.meta or {}), "youtube": yt}
            await s.commit()
    return yt


# ------------------------------------------------------------------ мультики
KIDS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "titles": {"type": "array", "items": {"type": "string"},
                   "description": "3 title variants ≤ 70 chars for parents searching kids cartoons: characters + what happens + learning hook"},
        "hook": {"type": "string", "description": "2 lines for parents: what the kids will enjoy and learn, ≤ 220 chars"},
        "learn": {"type": "array", "items": {"type": "string"}, "description": "3-5 bullets: skills/words the child practises"},
        "tags": {"type": "array", "items": {"type": "string"}, "description": "15-20 tags (kids cartoon, toddler learning, nursery songs, the topic words)"},
        "hashtags": {"type": "array", "items": {"type": "string"}, "description": "3-5 hashtags with #"},
        "thumbs": {
            "type": "array",
            "description": "3 different bright thumbnails",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "1-3 BIG simple words, ≤ 18 chars, no numbers"},
                    "chars": {"type": "array", "items": {"type": "string", "enum": ["benny", "mia", "ollie", "dot", "mama"]}, "description": "1-3 characters"},
                    "emotions": {"type": "array", "items": {"type": "string", "enum": ["laugh", "happy", "surprised", "sad", "scared", "thinking", "sleepy"]}},
                    "location": {"type": "string", "enum": ["garden", "garden_evening", "living_room", "kitchen", "bedroom", "playground", "beach", "forest"]},
                    "emoji": {"type": "string", "description": "ONE emoji for the story's key object (🍎, 🎈, 🧸, 🌙…)"},
                },
            },
        },
    },
}


async def build_youtube_cartoon(project_id: str) -> dict[str, Any]:
    """YouTube-пакет мультика: названия для родителей, описание с историями-главами, 3 обложки с героями (CartoonThumb)."""
    async with SessionLocal() as s:
        p = await s.get(Project, project_id)
        if p is None or not p.doc:
            return {}
        doc, meta = dict(p.doc), dict(p.meta or {})
        plan = meta.get("plan") or {}
        chapters = list(meta.get("chapters") or [])
        title = str(doc.get("title") or p.title)
        stories = [{"title": x.get("title"), "lesson": x.get("lesson"), "key_words": x.get("key_words"), "locations": x.get("locations")} for x in plan.get("stories", [])]
        try:
            prov = await get_provider(s)
            user = (
                f"Preschool cartoon episode ({round(float(doc.get('duration', 0)) / 60)} min, ages 2-5, English): «{title}».\n"
                f"Stories: {json.dumps(stories, ensure_ascii=False)}\nSongs: {[x.get('title') for x in plan.get('songs', [])]}\n\n"
                "Write the YouTube packaging for parents. Warm, trustworthy, no clickbait lies, no ALL CAPS titles. "
                "Thumbnails: 3 different moments, big emotions, one key object emoji."
            )
            r = await prov.complete_json(
                "You are a YouTube strategist for a gentle preschool cartoon channel (characters: Benny the bunny, Mia the kitten, Ollie the bear cub, "
                "Dot the puppy, Mama Bunny). Parents choose the videos; thumbnails must be bright and readable at a glance.",
                user, KIDS_SCHEMA, purpose="youtube_meta", max_tokens=3000, effort="medium")
            pack = dict(r.data)
        except LLMError as e:
            log.warning("cartoon youtube meta failed: %s", e)
            pack = {"titles": [f"{title} | Cartoons for Kids"], "hook": "", "learn": [], "tags": ["kids cartoon", "toddler learning"], "hashtags": ["#kidscartoon"],
                    "thumbs": [{"text": title[:18], "chars": ["benny", "mia"], "location": "garden", "emoji": "⭐"}]}

    urls: list[str] = []
    stamp = int(time.time())
    for i, th in enumerate((pack.get("thumbs") or [])[:3]):
        rel = f"projects/{project_id}/thumb-{stamp}-{i}.png"
        props = {"text": str(th.get("text") or title)[:20], "chars": th.get("chars") or ["benny"], "emotions": th.get("emotions") or [],
                 "location": th.get("location") or "garden", "emoji": th.get("emoji") or "", "variant": i}
        try:
            await clients.still(props, rel, composition="CartoonThumb")
            urls.append(f"/media/{rel}")
        except clients.ServiceError as e:
            log.warning("cartoon thumbnail %s failed: %s", i, e)
    hashtags = [h if h.startswith("#") else f"#{h}" for h in (pack.get("hashtags") or [])][:5]
    parts = [str(pack.get("hook", "")).strip()]
    if pack.get("learn"):
        parts.append("🌈 In this episode your child will:\n" + "\n".join(f"• {x}" for x in pack["learn"][:5]))
    if len(chapters) >= 3:
        parts.append("⏱ Stories & songs:\n" + "\n".join(chapters))
    parts.append("For children aged 2-5. Watch together, sing along and answer the friends' questions out loud!")
    parts.append(" ".join(hashtags))
    titles = [t[:100] for t in (pack.get("titles") or [])][:3] or [title]
    yt = {"title": titles[0], "titles": titles, "description": "\n\n".join(x for x in parts if x), "tags": (pack.get("tags") or [])[:20],
          "hashtags": hashtags, "chapters": chapters, "thumbnails": urls, "thumbnail_texts": pack.get("thumbs") or [], "made_for_kids": True, "generated_at": stamp}
    async with SessionLocal() as s:
        p = await s.get(Project, project_id)
        if p is not None:
            p.meta = {**(p.meta or {}), "youtube": yt}
            await s.commit()
    return yt
