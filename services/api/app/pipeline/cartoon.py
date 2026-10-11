"""Мультики для детей 2-5 лет (английский): эпизод 20-25 мин = интро + 3-4 истории + песенки + прощание.

LLM: план эпизода → сценарий каждой истории (сцены и биты) → проверка «редактором детского ТВ» → тексты песен.
Режиссёр: озвучка реплик голосом героя (Qwen3, проверка Whisper) → тайминги → позиции героев, камера,
паузы для ответа ребёнка, карточки слов, заставки → CartoonDoc (композиция Remotion «Cartoon»).
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import zlib
from pathlib import Path
from typing import Any

import numpy as np

from ..config import get_settings
from ..db import SessionLocal
from ..events import publish
from ..llm.generate import get_provider
from ..llm.providers import LLMError
from ..models import Project
from . import clients
from .audio import SR, envelope, load_mono, trim_silence, write_wav
from .music import Track
from .music import render as render_music

log = logging.getLogger("farm.cartoon")

# ------------------------------------------------------------------ каталог (единая точка правды — TS, см. docs/cartoon-visual-variety.md)
# packages/templates/src/cartoon/catalog → `pnpm --filter @ipt/templates catalog:export` → cartoon_catalog.json
CATALOG: dict[str, Any] = json.loads((Path(__file__).with_name("cartoon_catalog.json")).read_text(encoding="utf-8"))

CAST = {c["id"]: {"name": c["name"], "who": c["llm"], "catch": c["catchphrase"]} for c in CATALOG["characters"]}
VOICES: dict[str, tuple[str, float]] = {c["id"]: (c["voice"]["description"], float(c["voice"]["speed"])) for c in CATALOG["characters"]}
VOICES["narrator"] = (CATALOG["narrator"]["voice"]["description"], float(CATALOG["narrator"]["voice"]["speed"]))
LOCATIONS = {loc["id"]: loc["llm"] for loc in CATALOG["locations"]}
ACTIONS = [a["id"] for a in CATALOG["actions"]]
EMOTIONS = [e["id"] for e in CATALOG["emotions"]]
SPEAKERS = [*CAST, "narrator"]
PROPS = [pr["id"] for pr in CATALOG["props"]]
WEAR = [o["id"] for o in CATALOG["outfits"]]
FX = [f["id"] for f in CATALOG["fx"]]
COLORS: dict[str, str] = dict(CATALOG["colors"])
PROPS_LLM = "; ".join(f"{pr['id']} = {pr['llm']}" for pr in CATALOG["props"])

RULES = (
    "Audience: children aged 2-5 who are learning to speak; parents watch too. Language: simple, warm, natural English.\n"
    "- Sentences of 3-10 words. Present tense. Concrete words. Lots of gentle repetition of the key words.\n"
    "- Every story: a small everyday problem → the friends try (rule of three, funny failures) → they solve it together → "
    "a gentle lesson said simply. Happy, safe ending. Kindness, sharing, feelings, curiosity.\n"
    "- Humour for toddlers: silly sounds, funny surprises, playful mistakes, giggles — never mean or scary.\n"
    "- Interactive like Blue's Clues: 2-3 times per story a character looks at the viewer and asks a simple question "
    "('What colour is the ball?', 'Can you count with me?'), then waits — set ask_viewer=true and give the answer in the NEXT beat.\n"
    "- Safety: no dangerous acts a child could copy (no climbing high, no playing with fire, knives, medicine, water without an adult), "
    "no violence, no frightening villains, no brands, no religion/politics, no unhealthy messages.\n"
    "- Each beat is one short line by one speaker. The narrator only frames the story briefly.\n"
    "- Make it VISUAL and varied: the story's key object (props), weather and time of day, outfits that fit (raincoat in the rain, pajamas at bedtime, "
    "party hats at a birthday), and little effects (hearts when happy, zzz when sleepy, sparkles for magic moments, ! when surprised).\n"
)
BIBLE = (
    "Series: friends Benny (bunny), Mia (kitten), Ollie (bear cub) and Dot (puppy), with Mama Bunny.\n"
    + "\n".join(f"- {k}: {v['name']} — {v['who']}. Catchphrase: «{v['catch']}»" for k, v in CAST.items())
    + "\nLocations (use ONLY these ids): " + "; ".join(f"{k} = {v}" for k, v in LOCATIONS.items())
    + "\nProps (use ONLY these ids): " + PROPS_LLM
)
SYSTEM_KIDS = (
    "You are the head writer of a top preschool animated series (like Bluey, Peppa Pig, Blue's Clues). "
    "You write warm, funny, educational stories for toddlers in simple English. You follow the series bible and the rules exactly.\n\n"
    + BIBLE + "\n\n" + RULES
)

PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Episode title for YouTube, ≤ 60 chars"},
        "intro": {"type": "string", "description": "Narrator's 1-2 short welcoming sentences"},
        "stories": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "premise": {"type": "string", "description": "2-3 sentences: problem, funny attempts, solution"},
                    "lesson": {"type": "string"},
                    "key_words": {"type": "array", "items": {"type": "string"}, "description": "3-5 simple words to teach and repeat"},
                    "cast": {"type": "array", "items": {"type": "string", "enum": list(CAST)}},
                    "locations": {"type": "array", "items": {"type": "string", "enum": list(LOCATIONS)}},
                },
            },
        },
        "songs": {
            "type": "array",
            "description": "Short sing-along songs placed between stories",
            "items": {"type": "object", "properties": {"title": {"type": "string"}, "topic": {"type": "string"}, "after_story": {"type": "integer"}}},
        },
        "outro": {"type": "string", "description": "Narrator's goodbye, 1-2 sentences"},
    },
}

BEAT = {
    "type": "object",
    "properties": {
        "speaker": {"type": "string", "enum": SPEAKERS},
        "text": {"type": "string", "description": "One short line, 3-12 words"},
        "action": {"type": "string", "enum": ACTIONS},
        "emotion": {"type": "string", "enum": EMOTIONS},
        "shot": {"type": "string", "enum": ["wide", "medium", "close"], "description": "close for feelings and questions, wide for action"},
        "move": {"type": "object", "description": "optional: a character walks/runs somewhere BEFORE this line",
                 "properties": {"char": {"type": "string", "enum": list(CAST)}, "to": {"type": "string", "enum": ["left", "center_left", "center", "center_right", "right", "off_left", "off_right"]},
                                "run": {"type": "boolean"}}},
        "reactions": {"type": "array", "items": {"type": "object", "properties": {"char": {"type": "string", "enum": list(CAST)},
                                                                                     "action": {"type": "string", "enum": ACTIONS}, "emotion": {"type": "string", "enum": EMOTIONS}}}},
        "ask_viewer": {"type": "boolean", "description": "the speaker asks the child watching; the answer comes in the next beat"},
        "hold": {"type": "object", "description": "optional: a character picks up (or drops with prop='none') an object at this beat",
                 "properties": {"char": {"type": "string", "enum": list(CAST)}, "prop": {"type": "string", "enum": [*PROPS, "none"]},
                                "color": {"type": "string", "enum": list(COLORS)}}},
        "fx": {"type": "object", "description": "optional: a little effect over a character's head",
               "properties": {"char": {"type": "string", "enum": list(CAST)}, "kind": {"type": "string", "enum": FX}}},
        "word": {"type": "string", "description": "optional key word to show BIG on screen when it is first taught"},
    },
}
STORY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "enum": list(LOCATIONS)},
                    "cast": {"type": "array", "items": {"type": "string", "enum": list(CAST)}, "description": "characters present at the start"},
                    "weather": {"type": "string", "enum": ["clear", "rain", "snow", "leaves"]},
                    "time": {"type": "string", "enum": ["day", "evening", "night"]},
                    "decor": {"type": "string", "enum": ["none", "birthday"]},
                    "props": {"type": "array", "description": "objects standing on the ground in this scene",
                              "items": {"type": "object", "properties": {"prop": {"type": "string", "enum": PROPS},
                                                                         "where": {"type": "string", "enum": ["left", "center_left", "center", "center_right", "right"]},
                                                                         "color": {"type": "string", "enum": list(COLORS)}}}},
                    "wear": {"type": "array", "description": "what the characters wear in this scene",
                             "items": {"type": "object", "properties": {"char": {"type": "string", "enum": list(CAST)}, "items": {"type": "array", "items": {"type": "string", "enum": WEAR}}}}},
                    "beats": {"type": "array", "items": BEAT},
                },
            },
        }
    },
}
VERIFY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "issues": {"type": "array", "items": {"type": "string"}},
        "fixed_story_json": {"type": "string", "description": "the corrected story (same JSON structure) or empty if ok"},
    },
}
SONG_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verse": {"type": "array", "items": {"type": "string"}, "description": "4 short rhyming lines, 4-7 words each, easy to sing"},
        "chorus": {"type": "array", "items": {"type": "string"}, "description": "2-4 very catchy, repetitive lines"},
        "verse2": {"type": "array", "items": {"type": "string"}, "description": "4 more lines (optional actions: clap, jump, spin)"},
    },
}

SLOTS = {"off_left": -260.0, "left": 520.0, "center_left": 760.0, "center": 960.0, "center_right": 1160.0, "right": 1400.0, "off_right": 2180.0}
WPS = 2.3  # слов в секунду у детских голосов (с паузами) — для расчёта длины историй


# ------------------------------------------------------------------ LLM
async def llm_plan(s: Any, theme: str, minutes: int, n_stories: int) -> dict[str, Any]:
    prov = await get_provider(s)
    user = (
        f"Plan one YouTube episode (~{minutes} minutes) on the theme: «{theme}».\n"
        f"Exactly {n_stories} different stories (each 5-6 minutes, different locations and a different main character), "
        f"and {max(1, n_stories - 1)} short songs between them that repeat the stories' key words. "
        "Stories must feel fresh and varied — different problems, places and jokes."
    )
    r = await prov.complete_json(SYSTEM_KIDS, user, PLAN_SCHEMA, purpose="cartoon_plan", max_tokens=4000, effort="medium")
    return dict(r.data)


async def llm_story(s: Any, plan: dict[str, Any], i: int, seconds: int) -> dict[str, Any]:
    prov = await get_provider(s)
    st = plan["stories"][i]
    words = int(seconds * WPS)
    user = (
        f"Write story {i + 1} of the episode «{plan.get('title')}» as scenes and beats.\n"
        f"Title: {st.get('title')}\nPremise: {st.get('premise')}\nLesson: {st.get('lesson')}\nKey words: {st.get('key_words')}\n"
        f"Cast: {st.get('cast')}\nLocations: {st.get('locations')}\n\n"
        f"Length: about {seconds} seconds of dialogue — roughly {words} words in total, about {max(40, words // 7)} beats, 2-4 scenes. "
        "Start with a short narrator line, end with the lesson and a happy moment (cheer, hug or dance). "
        "Use moves, reactions, shots and the key-word cards to make it lively. Ask the viewer 2-3 questions."
    )
    r = await prov.complete_json(SYSTEM_KIDS, user, STORY_SCHEMA, purpose="cartoon_story", max_tokens=16000, effort="medium")
    return dict(r.data)


async def llm_verify(s: Any, story: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    prov = await get_provider(s)
    user = (
        "You are a strict children's TV standards editor (ages 2-5). Check this story JSON: age-appropriate vocabulary and sentence length, "
        "safety (nothing dangerous to imitate), kindness, no scary parts, correct English, the questions to the viewer are answerable "
        "and answered in the next beat, the ending is happy and the lesson is clear. Fix problems without changing the structure.\n"
        + json.dumps(story, ensure_ascii=False)
    )
    r = await prov.complete_json(SYSTEM_KIDS, user, VERIFY_SCHEMA, purpose="cartoon_verify", max_tokens=16000, effort="high")
    fixed = story
    raw = r.data.get("fixed_story_json") or ""
    if raw.strip():
        try:
            cand = json.loads(raw)
            if isinstance(cand, dict) and cand.get("scenes"):
                fixed = cand
        except json.JSONDecodeError:
            pass
    return fixed, [str(x) for x in r.data.get("issues", [])]


async def llm_song(s: Any, song: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    prov = await get_provider(s)
    words = sorted({w for st in plan.get("stories", []) for w in st.get("key_words", [])})
    user = (
        f"Write a short sing-along nursery song «{song.get('title')}» about: {song.get('topic')}. "
        f"Use some of these words: {words}. Simple rhymes, very catchy, action words (clap, jump, spin) are welcome."
    )
    r = await prov.complete_json(SYSTEM_KIDS, user, SONG_SCHEMA, purpose="cartoon_song", max_tokens=2000, effort="low")
    return dict(r.data)


# ------------------------------------------------------------------ озвучка
async def voice_line(text: str, speaker: str) -> tuple[np.ndarray, dict[str, Any]]:
    """Реплика голосом героя; до 3 дублей, если Whisper слышит не то."""
    st = get_settings()
    design, speed = VOICES.get(speaker, VOICES["narrator"])
    best: tuple[float, np.ndarray] | None = None
    for variant in range(3):
        r = await clients.tts_synthesize(text, "qwen3", None, speed, variant, None, None, design, language="en")
        clip = trim_silence(load_mono(st.data_dir / r["path"].lstrip("/")))
        heard = await clients.tts_transcribe(r["path"], "en")
        score = clients.speech_match(text, heard, "en") if heard is not None else 1.0
        if best is None or score > best[0]:
            best = (score, clip)
        if score >= 0.8 or heard is None:
            break
    assert best is not None
    return best[1], {"score": round(best[0], 2)}


# ------------------------------------------------------------------ режиссёр
class Director:
    """Собирает сцены CartoonDoc: время, позиции, действия, камера, надписи, огибающие рта."""

    def __init__(self, project_id: str = "") -> None:
        self.project_id = project_id
        self.scenes: list[dict[str, Any]] = []
        self.clips: list[tuple[float, np.ndarray]] = []  # (глобальное время, звук) — дорожка голосов
        self.t = 0.0  # глобальное время
        self.chapters: list[tuple[float, str]] = []

    def _seed(self) -> int:
        """Сид сцены: хэш проекта + номер сцены — мелочи локации (цвета игрушек, цветы, облака) разные, но рендер детерминирован."""
        return zlib.crc32(f"{self.project_id}:{len(self.scenes)}".encode()) % 1_000_000 + 1

    def _place(self, cast: list[str]) -> dict[str, float]:
        layouts = {1: ["center"], 2: ["center_left", "center_right"], 3: ["left", "center", "right"], 4: ["left", "center_left", "center_right", "right"]}
        names = layouts.get(len(cast), ["left", "center_left", "center", "center_right", "right"])
        out = {c: SLOTS[names[min(i, len(names) - 1)]] for i, c in enumerate(cast[:5])}
        if len(cast) >= 5:
            out = {c: 440 + i * 260 for i, c in enumerate(cast)}
        return out

    async def scene(self, location: str, cast: list[str], beats: list[dict[str, Any]], kind: str = "story", title: str | None = None,
                    sub: str | None = None, look: dict[str, Any] | None = None) -> None:
        cast = [c for c in cast if c in CAST] or ["benny"]
        pos = self._place(cast)
        keys: dict[str, list[dict[str, Any]]] = {c: [{"t": 0, "x": pos[c], "action": "idle", "emotion": "happy"}] for c in cast}
        cam: list[dict[str, Any]] = [{"t": 0, "x": float(np.mean(list(pos.values()))), "zoom": 1.0}]
        lines: list[dict[str, Any]] = []
        overlays: list[dict[str, Any]] = []
        lt = 0.6
        if title:
            for c in cast:
                keys[c].append({"t": 0.3, "action": "cheer" if c != "mama" else "wave", "emotion": "laugh"})
            overlays.append({"t": 0.4, "dur": 3.2, "kind": "title", "text": title, **({"sub": sub} if sub else {})})
            lt = 0.6
        for b in beats:
            spk = b.get("speaker") or "narrator"
            text = str(b.get("text") or "").strip()
            mv = b.get("move") or {}
            if mv.get("char") in CAST:
                ch = mv["char"]
                if ch not in keys:
                    keys[ch] = [{"t": 0, "x": SLOTS["off_right"], "action": "idle", "emotion": "happy"}]
                    pos[ch] = SLOTS["off_right"]
                dest = SLOTS.get(mv.get("to") or "center", 960.0)
                d = max(0.9, min(2.6, abs(dest - pos[ch]) / (520 if mv.get("run") else 330)))
                keys[ch].append({"t": lt, "x": pos[ch], "action": "run" if mv.get("run") else "walk"})
                keys[ch].append({"t": lt + d, "x": dest, "action": "idle"})
                pos[ch] = dest
                cam.append({"t": lt, "x": cam[-1]["x"], "zoom": cam[-1]["zoom"]})
                cam.append({"t": lt + d * 0.6, "x": float(np.mean([v for v in pos.values() if -100 < v < 2000] or [960])), "zoom": 1.0})
                lt += d * 0.85
            if not text:
                continue
            clip, _ = await voice_line(text, spk)
            dur = max(0.6, len(clip) / SR)
            self.clips.append((self.t + lt, clip))
            env = envelope(clip)
            line: dict[str, Any] = {"char": spk, "start": round(lt, 3), "dur": round(dur, 3), "text": text, "envelope": env}
            lines.append(line)
            if spk in keys:
                keys[spk].append({"t": round(lt, 3), "action": b.get("action") or "talk", "emotion": b.get("emotion") or "happy"})
                keys[spk].append({"t": round(lt + dur, 3), "action": "idle"})
            hd = b.get("hold") or {}
            if hd.get("char") in keys:
                pr = hd.get("prop")
                keys[hd["char"]].append({"t": round(lt, 3), "hold": None if pr in (None, "none") else {"id": pr, **({"color": COLORS[hd["color"]]} if hd.get("color") in COLORS else {})}})
            fx = b.get("fx") or {}
            if fx.get("char") in keys and fx.get("kind") in FX:
                keys[fx["char"]].append({"t": round(lt + 0.2, 3), "fx": fx["kind"]})
            for rc in b.get("reactions") or []:
                if rc.get("char") in keys:
                    keys[rc["char"]].append({"t": round(lt + 0.25, 3), "action": rc.get("action") or "idle", "emotion": rc.get("emotion") or "happy"})
                    keys[rc["char"]].append({"t": round(lt + dur + 0.4, 3), "action": "idle"})
            shot = b.get("shot") or "medium"
            sx = pos.get(spk, float(np.mean(list(pos.values()))))
            group = float(np.mean([v for v in pos.values() if -100 < v < 2000] or [960]))
            target = {"wide": (group, 1.0, 670.0), "medium": ((sx + group) / 2, 1.3, 640.0), "close": (sx, 1.85, 560.0)}[shot]
            cam.append({"t": round(lt, 3), "x": cam[-1]["x"], "y": cam[-1].get("y", 670.0), "zoom": cam[-1]["zoom"]})
            cam.append({"t": round(lt + 0.55, 3), "x": target[0], "y": target[2], "zoom": target[1]})
            if b.get("word"):
                overlays.append({"t": round(lt, 3), "dur": round(max(dur, 2.2), 3), "kind": "word", "text": str(b["word"])[:24]})
            lt += dur + 0.32
            if b.get("ask_viewer"):
                # пауза: ребёнок отвечает вслух; остальные герои «думают»
                overlays.append({"t": round(lt - 0.2, 3), "dur": 2.8, "kind": "question", "text": "?"})
                for c in keys:
                    if c != spk:
                        keys[c].append({"t": round(lt, 3), "action": "think", "emotion": "thinking"})
                        keys[c].append({"t": round(lt + 2.6, 3), "action": "idle", "emotion": "happy"})
                lt += 2.8
        dur_total = round(lt + 0.9, 3)
        lk = look or {}
        wear = {w.get("char"): [x for x in (w.get("items") or []) if x in WEAR] for w in (lk.get("wear") or []) if w.get("char") in CAST}
        props = [{"id": pp["prop"], "x": SLOTS.get(pp.get("where") or "center", 960.0) + 60, **({"color": COLORS[pp["color"]]} if pp.get("color") in COLORS else {})}
                 for pp in (lk.get("props") or []) if pp.get("prop") in PROPS][:4]
        self.scenes.append({
            "location": location, "kind": kind, "seed": self._seed(), "start": round(self.t, 3), "duration": dur_total,
            "camera": cam, "actors": [{"id": c, "keys": k, **({"wear": wear[c]} if wear.get(c) else {})} for c, k in keys.items()],
            "lines": lines, "overlays": overlays,
            **({"weather": lk["weather"]} if lk.get("weather") in ("rain", "snow", "leaves") else {}),
            **({"time": lk["time"]} if lk.get("time") in ("evening", "night") else {}),
            **({"decor": "birthday"} if lk.get("decor") == "birthday" else {}),
            **({"props": props} if props else {}),
        })
        self.t += dur_total

    async def song(self, title: str, lyrics: dict[str, Any], location: str, cast: list[str], bpm: int = 108) -> dict[str, Any]:
        """Песенка: строки на сетке тактов (по 2 такта на строку), герои танцуют, караоке, своя музыка."""
        rows = [*lyrics.get("verse", []), *lyrics.get("chorus", []), *lyrics.get("verse2", []), *lyrics.get("chorus", [])]
        rows = [str(x).strip() for x in rows if str(x).strip()][:20]
        beat = 60.0 / bpm
        bar = beat * 4
        lead = bar * 2  # вступление
        cast = [c for c in cast if c in CAST] or ["benny", "mia"]
        pos = self._place(cast)
        keys = {c: [{"t": 0, "x": pos[c], "action": "dance", "emotion": "laugh"}] for c in cast}
        lines, overlays = [], [{"t": 0.3, "dur": lead - 0.4, "kind": "title", "text": title, "sub": "Sing along!"}]
        for i, row in enumerate(rows):
            at = lead + i * bar * 2
            clip, _ = await voice_line(row, "narrator")
            self.clips.append((self.t + at, clip))
            dur = len(clip) / SR
            lines.append({"char": cast[i % len(cast)], "start": round(at, 3), "dur": round(dur, 3), "text": row, "envelope": envelope(clip)})
            overlays.append({"t": round(at, 3), "dur": round(bar * 2 - 0.1, 3), "kind": "lyric", "text": row})
        total = lead + len(rows) * bar * 2 + bar
        bars = int(np.ceil(total / bar))
        music = Track(f"song-{int(time.time() * 1000) % 10**9}", title, "C", bpm, (0, 4, 5, 3), bars, 0.8, 0.0, True)
        self.scenes.append({
            "location": location, "kind": "song", "seed": self._seed(), "start": round(self.t, 3), "duration": round(total, 3),
            "camera": [{"t": 0, "x": float(np.mean(list(pos.values()))), "zoom": 1.0}, {"t": total, "x": float(np.mean(list(pos.values()))), "zoom": 1.12}],
            "actors": [{"id": c, "keys": k} for c, k in keys.items()], "lines": lines, "overlays": overlays,
        })
        info = {"track": music, "start": self.t, "dur": total}
        self.t += total
        return info


# ------------------------------------------------------------------ сборка эпизода
async def build_cartoon(project_id: str) -> None:
    st = get_settings()

    async def progress(stage: str, p: float, **extra: Any) -> None:
        async with SessionLocal() as s2:
            pr = await s2.get(Project, project_id)
            if pr:
                pr.stage, pr.progress = stage, round(p, 3)
                for k, v in extra.items():
                    setattr(pr, k, v)
                await s2.commit()
        await publish({"type": "project", "project_id": project_id, "stage": stage, "progress": p})

    try:
        async with SessionLocal() as s:
            pr = await s.get(Project, project_id)
            if pr is None:
                return
            params = dict(pr.params or {})
            theme = str(params.get("theme") or params.get("topic") or "Sharing with friends")
            minutes = int(params.get("minutes", 22))
            n_stories = int(params.get("stories", 3))
            await progress("план эпизода", 0.02)
            plan = await llm_plan(s, theme, minutes, n_stories)
        stories = plan.get("stories", [])[:n_stories]
        songs = plan.get("songs", [])
        per_story = max(150, int((minutes * 60 - len(songs) * 50 - 40) / max(1, len(stories))))
        scripts, report = [], []
        for i in range(len(stories)):
            await progress(f"сценарий истории {i + 1}/{len(stories)}", 0.05 + 0.25 * i / len(stories))
            async with SessionLocal() as s:
                sc = await llm_story(s, plan, i, per_story)
                sc, issues = await llm_verify(s, sc)
            scripts.append(sc)
            report += [f"story {i + 1}: {x}" for x in issues]
        lyrics = []
        for sg in songs:
            async with SessionLocal() as s:
                lyrics.append(await llm_song(s, sg, plan))

        await progress("озвучка и режиссура", 0.32)
        d = Director(project_id)
        everyone = list(CAST)[:4]
        await d.scene("garden", everyone, [{"speaker": "narrator", "text": plan.get("intro") or "Hello, friends! Welcome!", "shot": "wide"}],
                      kind="title", title=plan.get("title") or theme)
        song_starts: list[dict[str, Any]] = []
        for i, (story, script) in enumerate(zip(stories, scripts, strict=False)):
            d.chapters.append((d.t, str(story.get("title", f"Story {i + 1}"))))
            scenes = script.get("scenes") or []
            first = scenes[0] if scenes else {"location": "garden", "cast": story.get("cast", ["benny"])}
            await d.scene(first.get("location") or "garden", first.get("cast") or story.get("cast") or ["benny"], [], kind="title",
                          title=str(story.get("title", "")), sub=f"Story {i + 1}")
            for j, sc in enumerate(scenes):
                await progress(f"история {i + 1}: сцена {j + 1}/{len(scenes)}", 0.32 + 0.55 * (i + j / max(1, len(scenes))) / max(1, len(stories)))
                await d.scene(sc.get("location") or "garden", sc.get("cast") or story.get("cast") or ["benny"], sc.get("beats") or [], look=sc)
            for k, sg in enumerate(songs):
                if int(sg.get("after_story", -1)) == i + 1 and k < len(lyrics):
                    d.chapters.append((d.t, f"Song: {sg.get('title', '')}"))
                    song_starts.append(await d.song(str(sg.get("title", "Let's sing!")), lyrics[k], "playground" if k % 2 == 0 else "garden", everyone))
        await d.scene("garden_evening", everyone, [{"speaker": "narrator", "text": plan.get("outro") or "Bye bye, friends! See you next time!", "shot": "wide", "action": "wave"}],
                      kind="title", title="Bye bye!", sub="See you next time")
        for c in everyone:
            d.scenes[-1]["actors"][everyone.index(c)]["keys"].append({"t": 1.0, "action": "wave", "emotion": "laugh"})

        # звук: дорожка голосов + музыка песен + тихая музыка под истории
        await progress("сведение звука", 0.9)
        total = d.t
        buf = np.zeros(int(np.ceil(total * SR)) + SR, np.float32)
        for at, clip in d.clips:
            a = int(at * SR)
            buf[a : a + len(clip)] += clip[: max(0, len(buf) - a)]
        peak = float(np.abs(buf).max()) or 1.0
        buf = (buf / peak * 0.9).astype(np.float32)
        out_dir = st.data_dir / "cartoons" / project_id
        write_wav(out_dir / "voices.wav", buf)
        audio = [{"src": f"/media/cartoons/{project_id}/voices.wav", "start": 0, "volume": 1}]
        for i, sg in enumerate(song_starts):
            rel = f"cartoons/{project_id}/song-{i}.wav"
            write_wav(st.data_dir / rel, render_music(sg["track"]))
            audio.append({"src": f"/media/{rel}", "start": round(sg["start"], 3), "dur": round(sg["dur"], 3), "volume": 0.45})
        bg = Track("kids-bg", "Kids background", "F", 96, (0, 3, 4, 0), 16, 0.55, 0.06, False)
        write_wav(out_dir / "bg.wav", render_music(bg))
        song_spans = [(sg["start"], sg["start"] + sg["dur"]) for sg in song_starts]
        cur = 0.0
        for a, b in [*song_spans, (total, total)]:
            if a - cur > 2:
                audio.append({"src": f"/media/cartoons/{project_id}/bg.wav", "start": round(cur, 3), "dur": round(a - cur, 3), "volume": 0.07, "loop": True})
            cur = b
        doc = {"title": plan.get("title") or theme, "fps": 30, "duration": round(total, 3), "scenes": d.scenes, "audio": audio, "show_captions": True}
        chapters = [f"{int(t) // 60:02d}:{int(t) % 60:02d} {name}" for t, name in [(0.0, "Intro"), *d.chapters]]
        meta = {"plan": plan, "scripts": scripts, "report": report, "chapters": chapters, "kind": "cartoon"}
        await progress("обложки и описание для YouTube", 0.96, doc=doc, meta=meta, title=str(doc["title"])[:200])
        from .youtube import build_youtube_cartoon

        try:
            await build_youtube_cartoon(project_id)
        except Exception as e:  # noqa: BLE001 — пакет YouTube не должен ронять готовый мультик
            log.warning("cartoon youtube pack failed: %s", e)
        await progress("готово к просмотру", 1.0, status="draft", error=None, revision=1)
        if params.get("auto_render"):
            from ..worker import enqueue

            await progress("в очереди на рендер", 0.0, status="rendering")
            await enqueue("run_project_render", project_id)
    except (LLMError, clients.ServiceError, KeyError, ValueError) as e:
        await progress("ошибка", 0.0, status="failed", error=str(e)[:2000])
    except Exception as e:  # noqa: BLE001 — любой сбой виден в проекте
        log.exception("cartoon failed")
        await progress("ошибка", 0.0, status="failed", error=f"{type(e).__name__}: {e}"[:2000])


_ = asyncio  # параллельная озвучка — следующий шаг (движок TTS всё равно один)
