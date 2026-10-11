"""Упаковка мультика для YouTube: обложки CartoonThumb, названия и описание — чистые функции без БД (тестируются локально).

Обложка как у топовых детских каналов: 1-2 крупных СЧАСТЛИВЫХ героя (утрированный «шок» YouTube считает сенсационностью и
режет рекомендации), один большой предмет истории, 1-3 огромных слова, насыщенный фон, маленький логотип серии.
LLM выбирает макет, слова, героев, эмоции, предмет и историю; локация и мир (время/погода/сезон) берутся из сцен эпизода,
чтобы обложка не обещала того, чего в мультике нет. Любой пропуск LLM закрывается значением по умолчанию.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .cartoon_world import auto_wear, resolve_world

CATALOG: dict[str, Any] = json.loads((Path(__file__).with_name("cartoon_catalog.json")).read_text(encoding="utf-8"))

SERIES = "Benny & Friends"
CHARS = [c["id"] for c in CATALOG["characters"]]
ADULTS = {c["id"] for c in CATALOG["characters"] if c.get("adult")}
LOCS = [loc["id"] for loc in CATALOG["locations"]]
PROPS = [p["id"] for p in CATALOG["props"]]
PROP_COMPAT = {p["id"]: p.get("compat") or {} for p in CATALOG["props"]}
OUTDOOR = {loc["id"]: bool(loc.get("outdoor", True)) for loc in CATALOG["locations"]}
COLORS = list(CATALOG["colors"])
LAYOUTS = ["face", "duo", "world", "song", "learn", "action"]
THUMB_EMOTIONS = ["happy", "laugh", "surprised"]
DEFAULT_LAYOUTS = ["face", "duo", "world"]
EMOJI_PROP = {"🍎": "apple", "🎈": "balloon", "🧸": "teddy", "⭐": "star", "🌟": "star", "🎂": "cake", "⚽": "ball", "☂️": "umbrella", "☔": "umbrella",
              "⛄": "snowman", "☃️": "snowman", "🍪": "cookie", "🍦": "ice_cream", "🎁": "gift", "🥕": "carrot", "🍌": "banana", "📚": "book", "📖": "book",
              "🌸": "flower", "🌼": "flower", "🍂": "leaf", "🍁": "leaf", "🐚": "shell", "🥁": "drum", "🚗": "toy_car", "🪁": "kite", "🫧": "bubbles"}

THUMB_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "layout": {"type": "string", "enum": LAYOUTS,
                   "description": "face = giant happy close-up of ONE hero + the key object; duo = two friends delighted by a big object in the centre; "
                                  "world = the story's weather/season scene (snowman, rain + umbrella, beach); song = rainbow + music notes, friends dancing; "
                                  "learn = big letters/numbers/colour blobs + hero pointing; action = hero jumping for joy + flying object"},
        "text": {"type": "string", "description": "1-3 BIG simple words a parent gets instantly (e.g. 'Snow day!', 'Yummy!', 'Sing along'), ≤ 16 chars, no numbers, no commas"},
        "story": {"type": "integer", "description": "which story this thumbnail shows (1-based); 0 for a song or the whole episode"},
        "chars": {"type": "array", "items": {"type": "string", "enum": CHARS}, "description": "1-2 heroes of that story (song: up to 3); the first is the main face"},
        "emotions": {"type": "array", "items": {"type": "string", "enum": THUMB_EMOTIONS}, "description": "per hero; happy/laugh preferred, surprised = happy wow"},
        "prop": {"type": "string", "enum": [*PROPS, "none"], "description": "ONE key object of the story, drawn huge"},
        "prop_color": {"type": "string", "enum": COLORS, "description": "optional colour of the object (colour lessons)"},
        "location": {"type": "string", "enum": LOCS, "description": "a location where this story really happens"},
        "big": {"type": "string", "description": "learn only: 1-4 big letters or digits shown on toy blocks, e.g. 'ABC', '123'"},
        "colors": {"type": "array", "items": {"type": "string", "enum": COLORS}, "description": "learn only: 2-5 colours of a colour lesson"},
    },
}


# ------------------------------------------------------------------ контекст эпизода
def _scene_props(sc: dict[str, Any]) -> list[str]:
    out = [p.get("id") for p in sc.get("props") or []]
    for a in sc.get("actors") or []:
        for k in a.get("keys") or []:
            h = k.get("hold")
            if isinstance(h, dict):
                out.append(h.get("id"))
    return [p for p in out if p in PROPS]


def episode_context(doc: dict[str, Any]) -> dict[str, Any]:
    """Истории и песни эпизода по сценам: локации с миром, предметы, герои. Границы историй — титульные сцены «Story N»."""
    stories: list[dict[str, Any]] = []
    songs: list[dict[str, Any]] = []
    cur: dict[str, Any] | None = None
    for sc in doc.get("scenes") or []:
        kind = sc.get("kind")
        ov = (sc.get("overlays") or [{}])[0] if sc.get("overlays") else {}
        if kind == "title" and str(ov.get("sub") or "").startswith("Story"):
            cur = {"title": str(ov.get("text") or ""), "scenes": [], "props": [], "cast": []}
            stories.append(cur)
            continue
        if kind == "song":
            songs.append({"title": str(ov.get("text") or ""), "location": sc.get("location") or "playground", "world": dict(sc.get("world") or {}),
                          "seed": int(sc.get("seed") or 0), "lyrics": [str(x.get("text") or "") for x in sc.get("lines") or [] if x.get("text")],
                          "cast": [a.get("id") for a in sc.get("actors") or [] if a.get("id") in CHARS]})
            cur = None
            continue
        if kind == "story" and cur is not None:
            cur["scenes"].append({"location": sc.get("location") or "garden", "world": dict(sc.get("world") or {}), "seed": int(sc.get("seed") or 0)})
            cur["props"] += [p for p in _scene_props(sc) if p not in cur["props"]]
            cur["cast"] += [a.get("id") for a in sc.get("actors") or [] if a.get("id") in CHARS and a.get("id") not in cur["cast"]]
    return {"stories": stories, "songs": songs}


def context_for_llm(ctx: dict[str, Any]) -> str:
    """Короткая сводка для промпта: где и когда происходят истории, какие предметы в кадре."""
    rows = []
    for i, st in enumerate(ctx["stories"], 1):
        places = []
        for sc in st["scenes"]:
            w = sc["world"]
            tag = f"{sc['location']} ({w.get('season', '')}, {w.get('weather', '')}, {w.get('time', '')})"
            if tag not in places:
                places.append(tag)
        rows.append(f"Story {i} «{st['title']}»: cast {st['cast']}; places {places[:4]}; objects {st['props'][:8]}")
    for sg in ctx["songs"]:
        rows.append(f"Song «{sg['title']}» at {sg['location']}")
    return "\n".join(rows)


# ------------------------------------------------------------------ нормализация ответа LLM
def clean_text(text: Any, fallback: str) -> str:
    """1-3 слова ≤ 16 символов: без цифр, запятых и эмодзи; «!»/«?» оставляем."""
    t = re.sub(r"[^A-Za-z' !?&-]", " ", str(text or "")).strip()
    t = re.sub(r"\s+([!?]+)", r"\1", t)  # «Snow day !!» → «Snow day!!»
    words = [w for w in t.split() if w.strip("!?'-&")][:3]
    while words and len(" ".join(words)) > 16:
        words = words[:-1]
    if not words:
        words = [w for w in re.sub(r"[^A-Za-z' !?]", " ", fallback).split() if w][:2] or ["Yay!"]
        while len(words) > 1 and len(" ".join(words)) > 16:
            words = words[:-1]
    return " ".join(words)[:16]


def prop_fits(prop: str, location: str, world: dict[str, str]) -> bool:
    c = PROP_COMPAT.get(prop) or {}
    if c.get("outdoor") and not OUTDOOR.get(location, True):
        return False
    if c.get("indoor") and OUTDOOR.get(location, True):
        return False
    for key, wk in (("weather", "weather"), ("seasons", "season"), ("times", "time")):
        if c.get(key) and world.get(wk) not in c[key]:
            return False
    return True


def _world_score(sc: dict[str, Any]) -> int:
    """Насколько сцена «погодная» — для макета world берём самую выразительную (на улице погоду видно целиком)."""
    w = sc["world"]
    weather = {"snow": 3, "rain": 3, "windy": 2}.get(str(w.get("weather")), 0)
    return (3 if OUTDOOR.get(sc["location"], True) else 0) + weather + (1 if w.get("season") in ("winter", "autumn") else 0) + (1 if w.get("time") == "evening" else 0)


def thumb_props(th: dict[str, Any], i: int, ctx: dict[str, Any], title: str, used: set[str]) -> dict[str, Any]:
    """Пропсы CartoonThumb из идеи LLM: всё проверено по каталогу и согласовано со сценами эпизода."""
    layout = th.get("layout") if th.get("layout") in LAYOUTS else DEFAULT_LAYOUTS[i % len(DEFAULT_LAYOUTS)]
    if layout == "song" and not ctx["songs"]:
        layout = "action"
    if layout in used:  # три обложки A/B-теста должны отличаться макетом
        layout = next((x for x in [*DEFAULT_LAYOUTS, "action", "song" if ctx["songs"] else "learn", "learn"] if x not in used), layout)
    used.add(layout)

    stories = ctx["stories"]
    try:
        si = int(th.get("story") or 0)
    except (TypeError, ValueError):
        si = 0
    story = stories[si - 1] if 1 <= si <= len(stories) else (stories[i % len(stories)] if stories and layout != "song" else None)
    song = ctx["songs"][0] if ctx["songs"] and (layout == "song" or story is None) else None

    # место и мир — из реальной сцены
    seed = 0
    if song is not None:
        location, world, seed = song["location"], dict(song["world"]), song["seed"]
    elif story and story["scenes"]:
        scenes = story["scenes"]
        want = th.get("location")
        pick = next((s for s in scenes if s["location"] == want), None)
        if pick is None:
            pick = max(scenes, key=_world_score) if layout == "world" else scenes[0]
        location, world, seed = pick["location"], dict(pick["world"]), pick["seed"]
    else:
        location = th.get("location") if th.get("location") in LOCS else "garden"
        world = {}
    world = resolve_world(CATALOG, location, world or None, world.get("season") if world else None)

    # герои
    pool = (song or {}).get("cast") or (story or {}).get("cast") or []
    chars = list(dict.fromkeys(c for c in (th.get("chars") or []) if c in CHARS))
    need = 3 if layout == "song" else 2 if layout in ("duo", "world", "action") else 1
    for c in [*pool, "benny", "mia", "ollie", "dot"]:
        if len(chars) >= need:
            break
        if c not in chars and c in CHARS:
            chars.append(c)
    chars = chars[: 3 if layout == "song" else 2]
    emotions = [e if e in THUMB_EMOTIONS else "happy" for e in (th.get("emotions") or [])][: len(chars)]

    # предмет истории
    prop = th.get("prop") if th.get("prop") in PROPS else EMOJI_PROP.get(str(th.get("emoji") or "").strip(), "")
    if prop and not prop_fits(prop, location, world):
        prop = ""
    if not prop and layout not in ("song", "learn"):
        cands = [p for p in (story or {}).get("props", []) if prop_fits(p, location, world)]
        seasonal = {"snow": "snowman", "rain": "umbrella"}.get(world["weather"]) if layout == "world" else None
        prop = seasonal if seasonal and prop_fits(seasonal, location, world) else (cands[0] if cands else "star")

    props: dict[str, Any] = {
        "layout": layout,
        "text": clean_text(th.get("text"), "Sing along" if layout == "song" else title),
        "chars": chars,
        "emotions": emotions,
        "prop": prop or "",
        "location": location,
        "world": world,
        # в песнях эпизода герои без костюмов — на обложке так же
        "wear": [[] if layout == "song" else [x for x in auto_wear(CATALOG, location, world) if not (x == "pajamas" and c in ADULTS)] for c in chars],
        "seed": seed,
        "variant": i,
        "badge": SERIES,
    }
    if th.get("prop_color") in COLORS:
        props["propColor"] = th["prop_color"]
    if layout == "learn":
        big = re.sub(r"[^A-Za-z0-9]", "", str(th.get("big") or "")).upper()[:4]
        cols = [c for c in (th.get("colors") or []) if c in COLORS][:5]
        if big:
            props["big"] = big
        elif cols:
            props["colors"] = cols
        elif not props["prop"]:
            props["prop"] = ((story or {}).get("props") or ["star"])[0]
    return props


def build_thumbs(thumbs: list[dict[str, Any]] | None, ctx: dict[str, Any], title: str, n: int = 3) -> list[dict[str, Any]]:
    """Ровно n разных обложек: недостающие идеи LLM дополняются макетами по умолчанию."""
    ideas = [t for t in (thumbs or []) if isinstance(t, dict)][:n]
    while len(ideas) < n:
        ideas.append({})
    used: set[str] = set()
    return [thumb_props(th, i, ctx, title, used) for i, th in enumerate(ideas)]


# ------------------------------------------------------------------ названия и описание
def kids_title(t: str, has_songs: bool) -> str:
    """«Тема | Benny & Friends | Nursery Rhymes & Kids Songs» ≤ 70 символов, без капслока и набивки ключевиков."""
    base = re.split(r"\s*\|\s*", str(t or "").strip())[0].strip(" -–—") or SERIES
    if base.isupper() and len(base) > 4:
        base = base.title()
    tails = ["Nursery Rhymes & Kids Songs", "Kids Songs"] if has_songs else ["Cartoons for Kids", "Kids Cartoon"]
    for tail in tails:
        s = f"{base} | {SERIES} | {tail}"
        if len(s) <= 70:
            return s
    s = f"{base} | {SERIES}"
    return s if len(s) <= 70 else base[:70]


def clean_chapters(chapters: list[str]) -> list[str]:
    """Главы YouTube: первая 00:00, каждая ≥ 10 с, минимум 3 — иначе без глав."""
    out: list[tuple[int, str]] = []
    for row in chapters:
        m = re.match(r"^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$", str(row))
        if not m:
            continue
        sec = int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
        if out and sec - out[-1][0] < 10:
            continue
        out.append((sec, m.group(4).strip()))
    if not out:
        return []
    out[0] = (0, out[0][1])
    if len(out) < 3:
        return []

    def fmt(s: int) -> str:
        return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60:02d}:{s % 60:02d}"

    return [f"{fmt(s)} {name}" for s, name in out]


def lyrics_block(ctx: dict[str, Any]) -> str:
    """Полные тексты песен для описания (родители поют вместе с ребёнком)."""
    parts = []
    for sg in ctx["songs"]:
        rows = [r.strip() for r in sg["lyrics"] if r.strip()]
        if not rows:
            continue
        stanzas = ["\n".join(rows[k : k + 4]) for k in range(0, len(rows), 4)]
        parts.append(f"🎵 {sg['title'] or 'Song'}\n" + "\n\n".join(stanzas))
    return "\n\n".join(parts)


def kids_description(pack: dict[str, Any], chapters: list[str], ctx: dict[str, Any], hashtags: list[str]) -> str:
    """Описание для детского видео (made for kids): записка родителям, чему учится ребёнок, главы, тексты песен. Без призывов комментировать и подписываться."""
    parts = [str(pack.get("hook", "")).strip()]
    learn = [str(x).strip() for x in (pack.get("learn") or []) if str(x).strip()][:5]
    if learn:
        parts.append("🌈 In this episode your child will:\n" + "\n".join(f"• {x}" for x in learn))
    ch = clean_chapters(chapters)
    if ch:
        parts.append("⏱ Stories & songs:\n" + "\n".join(ch))
    lyr = lyrics_block(ctx)
    if lyr:
        parts.append("📝 Lyrics\n\n" + lyr)
    parts.append(f"{SERIES}: gentle cartoons and songs for children aged 2-5. Watch together, sing along and answer the friends' questions out loud!")
    parts.append(" ".join(hashtags))
    return "\n\n".join(x for x in parts if x)
