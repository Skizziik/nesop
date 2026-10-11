"""Мультики для детей 2-5 лет (английский): эпизод 20-25 мин = интро + 3-4 истории + песенки + прощание.

LLM: план эпизода → сценарий каждой истории (сцены и биты) → проверка «редактором детского ТВ» → тексты песен.
Режиссёр: озвучка реплик голосом героя (Qwen3, проверка Whisper) → тайминги → позиции героев, камера,
паузы для ответа ребёнка, карточки слов, заставки → CartoonDoc (композиция Remotion «Cartoon»).
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
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
from . import cartoon_art as art
from . import clients
from .audio import SR, envelope, load_mono, trim_silence
from .cartoon_world import SEASONS, TIMES, WEATHERS, auto_wear, merge_wear, resolve_world
from .gone import ProjectGone
from .music import Section, song_plan
from .sfx import mix_cartoon

log = logging.getLogger("farm.cartoon")

# ------------------------------------------------------------------ каталог (единая точка правды — TS, см. docs/cartoon-visual-variety.md)
# packages/templates/src/cartoon/catalog → `pnpm --filter @ipt/templates catalog:export` → cartoon_catalog.json
CATALOG: dict[str, Any] = json.loads((Path(__file__).with_name("cartoon_catalog.json")).read_text(encoding="utf-8"))

CAST = {c["id"]: {"name": c["name"], "who": c["llm"], "catch": c["catchphrase"], "adult": bool(c.get("adult"))} for c in CATALOG["characters"]}
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
    "- Sentences of 3-8 words (never more than 10). Present tense. Concrete words. One idea per line.\n"
    "- ONE target word per story, central to the problem (e.g. 'share', 'round', 'red'). Say it at least 5 times, by at least 2 different "
    "characters, and show it once or twice with the beat field word=<the word>. Other new words: at most 2 per story.\n"
    "- Every story: a small everyday problem → the friends try (rule of three, funny failures) → they solve it together → "
    "a gentle lesson said simply. Happy, safe ending. Kindness, sharing, feelings, curiosity.\n"
    "- Humour for toddlers: silly sounds, funny surprises, playful mistakes, giggles — never mean or scary.\n"
    "- Interactive like Blue's Clues: 2-3 times per story a character looks at the viewer and asks a simple question "
    "('What colour is the ball?', 'Can you count with me?'), then waits — set ask_viewer=true and give the answer in the NEXT beat.\n"
    "- Safety: no dangerous acts a child could copy (no climbing high, no playing with fire, knives, medicine, water without an adult), "
    "no violence, no frightening villains, no brands, no religion/politics, no unhealthy messages.\n"
    "- Each beat is one short line by one speaker. The narrator only frames the story briefly.\n"
    "- Keep the world believable: characters walk or run in and out (no popping out of nowhere, no teleporting); "
    "at most ONE magical/impossible moment per story. Sparkles and hearts are only decoration.\n"
    "- Make it VISUAL and varied: every story has its own season, and scenes change the time of day (a sunny morning, a rainy afternoon, "
    "a sunset, a starry bedtime) and the weather (rain: puddles and raincoats; snow: snowmen and hats; wind: kites and flying leaves). "
    "Use the story's key object (props), outfits that fit, and little effects (hearts when happy, zzz when sleepy, sparkles for magic, ! when surprised).\n"
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
                    "season": {"type": "string", "enum": SEASONS, "description": "season of this story — vary seasons across the episode"},
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
        "item": {"type": "object", "description": "optional: something happens with an object at this beat: give (char hands prop to target), "
                 "throw (char throws prop to target, target catches it), eat (char takes bites; food), pick_up (from the ground), put_down",
                 "properties": {"kind": {"type": "string", "enum": ["give", "throw", "eat", "pick_up", "put_down"]},
                                "char": {"type": "string", "enum": list(CAST)}, "target": {"type": "string", "enum": list(CAST)},
                                "prop": {"type": "string", "enum": PROPS}, "color": {"type": "string", "enum": list(COLORS)}}},
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
                    "weather": {"type": "string", "enum": WEATHERS, "description": "snow only in winter, no rain in winter; beach: clear/cloudy/windy"},
                    "time": {"type": "string", "enum": TIMES, "description": "morning (waking up, breakfast), day, evening (sunset, dinner), night (bedtime, stars)"},
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
LINE_GAP = 0.5  # пауза между репликами (исследование: 0.45-0.7 с для 2-5 лет)
LONG_GAP = 0.8  # после вопроса, нового слова и смены говорящего на сцене с движением
ASK_PAUSE = 5.0  # тишина на ответ ребёнка (Disney Research: дети отвечают позже 2 с, ждать до 8 с)
MIN_SHOT = 3.0  # камера не перекадрируется чаще (цель 5-8 с на план)
GAP = 250.0  # минимум между героями по миру: голова малыша ~215 в ширину при масштабе сцены — иначе стоят друг в друге
STAGE = (330.0, 1590.0)  # где можно стоять, не уходя за край общего плана
WPS = 1.9  # слов в секунду с учётом пауз (0.5 с между репликами, 5 с на ответ зрителя) — для расчёта длины историй


# ------------------------------------------------------------------ LLM
async def llm_plan(s: Any, theme: str, minutes: int, n_stories: int, hint: str = "") -> dict[str, Any]:
    prov = await get_provider(s)
    user = (
        f"Plan one YouTube episode (~{minutes} minutes) on the theme: «{theme}».\n"
        f"Exactly {n_stories} different stories (each 5-6 minutes, different locations and a different main character), "
        f"and {max(1, n_stories - 1)} short songs between them that repeat the stories' key words. "
        "Stories must feel fresh and varied — different problems, places and jokes."
        + hint
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
    try:
        r = await prov.complete_json(SYSTEM_KIDS, user, STORY_SCHEMA, purpose="cartoon_story", max_tokens=24000, effort="medium")
    except LLMError:  # обрезано/сбой — одна попытка ещё раз, с меньшим «размышлением»
        r = await prov.complete_json(SYSTEM_KIDS, user, STORY_SCHEMA, purpose="cartoon_story", max_tokens=32000, effort="low")
    return dict(r.data)


async def llm_art(s: Any, story: dict[str, Any], season: str, usage: dict[str, Any], used_worlds: list[str]) -> dict[str, Any]:
    """Арт-директор: визуальный план сцен истории (время, погода, вставки, наезды, переходы)."""
    prov = await get_provider(s)
    r = await prov.complete_json(SYSTEM_KIDS, art.art_prompt(story, season, usage, used_worlds), art.ART_SCHEMA, purpose="cartoon_art", max_tokens=3000, effort="low")
    return dict(r.data)


async def recent_fingerprints(s: Any, exclude: str, n: int = 6) -> list[dict[str, Any]]:
    """Отпечатки последних эпизодов (для анти-повтора)."""
    from sqlalchemy import select

    rows = (await s.execute(select(Project).where(Project.kind == "cartoon", Project.id != exclude).order_by(Project.created_at.desc()).limit(n * 2))).scalars().all()
    out = []
    for p in rows:
        fp = (p.meta or {}).get("fingerprint") or (art.fingerprint(p.doc or {}, (p.meta or {}).get("plan")) if (p.doc or {}).get("scenes") else None)
        if fp:
            out.append(fp)
    return out[:n]


async def llm_verify(s: Any, story: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    prov = await get_provider(s)
    user = (
        "You are a strict children's TV standards editor (ages 2-5). Check this story JSON: age-appropriate vocabulary, lines of 3-8 words, "
        "safety (nothing dangerous to imitate), kindness, no scary parts, correct English, the questions to the viewer are answerable "
        "and answered in the next beat, a clear beginning-middle-end, the ending is happy and the lesson is shown, not only told. "
        "The story's ONE target word is said at least 5 times by at least 2 characters. Colours, numbers and objects named in lines must match "
        "the scene props/hold data (if Mia says 'the red ball', the ball is red). No brands, no keyword stuffing, nobody appears from nowhere. "
        "Fix problems without changing the structure.\n"
        + json.dumps(story, ensure_ascii=False)
    )
    try:
        r = await prov.complete_json(SYSTEM_KIDS, user, VERIFY_SCHEMA, purpose="cartoon_verify", max_tokens=32000, effort="high")
    except LLMError as e:  # редактор — улучшение: при сбое остаётся сценарий как есть
        return story, [f"standards editor skipped: {e}"]
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
async def tts_retry(text: str, speed: float, variant: int, design: str, tries: int = 3) -> dict[str, Any]:
    """TTS с повтором: холодная загрузка модели с HDD или занятый диск дают таймаут — ждём и пробуем снова, а не роняем эпизод."""
    import httpx

    for k in range(tries):
        try:
            return await clients.tts_synthesize(text, "qwen3", None, speed, variant, None, None, design, language="en")
        except (httpx.HTTPError, clients.ServiceError) as e:
            if k == tries - 1:
                raise clients.ServiceError(f"TTS не ответил после {tries} попыток: {type(e).__name__}") from e
            log.warning("tts retry %s/%s after %s", k + 1, tries, type(e).__name__)
            await asyncio.sleep(20 * (k + 1))
    raise clients.ServiceError("TTS: нет ответа")


async def voice_line(text: str, speaker: str) -> tuple[np.ndarray, dict[str, Any]]:
    """Реплика голосом героя; до 3 дублей, если Whisper слышит не то."""
    st = get_settings()
    design, speed = VOICES.get(speaker, VOICES["narrator"])
    best: tuple[float, np.ndarray] | None = None
    for variant in range(3):
        r = await tts_retry(text, speed, variant, design)
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
def _ease_io(k: float) -> float:
    return 2 * k * k if k < 0.5 else 1 - (-2 * k + 2) ** 2 / 2


def cam_at(cam: list[dict[str, Any]], t: float) -> dict[str, float]:
    """Камера в момент t — та же интерполяция, что camAt в Episode.tsx (easeIO между соседними ключами)."""
    if not cam:
        return {"x": 960.0, "y": 670.0, "zoom": 1.0}
    ks = sorted(cam, key=lambda k: k["t"])
    a, b = ks[0], ks[-1]
    for i in range(len(ks) - 1):
        if ks[i]["t"] <= t <= ks[i + 1]["t"]:
            a, b = ks[i], ks[i + 1]
            break
    if t <= ks[0]["t"]:
        b = a
    if t >= ks[-1]["t"]:
        a = b = ks[-1]
    k = _ease_io(min(1.0, max(0.0, (t - a["t"]) / (b["t"] - a["t"])))) if b["t"] > a["t"] else 0.0
    ay, by = a.get("y", 670.0), b.get("y", 670.0)
    return {"x": a["x"] + (b["x"] - a["x"]) * k, "y": ay + (by - ay) * k, "zoom": a["zoom"] + (b["zoom"] - a["zoom"]) * k}


def cam_move(cam: list[dict[str, Any]], t0: float, t1: float, x: float, y: float, zoom: float) -> None:
    """Движение камеры с t0 до t1 из того места, где она на самом деле в t0; более поздние ключи отменяются — ключи не перепутаются."""
    st = cam_at(cam, t0)
    cam[:] = [k for k in cam if k["t"] < t0]
    cam.append({"t": round(t0, 3), "x": round(st["x"], 2), "y": round(st["y"], 2), "zoom": round(st["zoom"], 4)})
    cam.append({"t": round(max(t1, t0 + 0.05), 3), "x": float(x), "y": float(y), "zoom": float(zoom)})


def _obj(x: Any) -> dict[str, Any]:
    return x if isinstance(x, dict) else {}


class Director:
    """Собирает сцены CartoonDoc: время, позиции, действия, камера, надписи, огибающие рта."""

    def __init__(self, project_id: str = "") -> None:
        self.project_id = project_id
        self.season = "summer"  # сезон текущей истории (из плана)
        self.world: dict[str, str] = {"time": "day", "weather": "clear", "season": "summer"}  # мир последней сцены — для песен
        self.scenes: list[dict[str, Any]] = []
        self.clips: list[tuple[float, np.ndarray]] = []  # (глобальное время, звук) — дорожка голосов
        self.t = 0.0  # глобальное время
        self.chapters: list[tuple[float, str]] = []

    @staticmethod
    def _items_init(look: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """Предметы на земле из сценария сцены → предметы с историей (их можно поднять, передать, бросить)."""
        items: dict[str, dict[str, Any]] = {}
        for i, pp in enumerate((look.get("props") or [])[:4]):
            if pp.get("prop") not in PROPS:
                continue
            uid = f"{pp['prop']}{i}"
            x = SLOTS.get(pp.get("where") or "center", 960.0) + 60
            items[uid] = {"uid": uid, "prop": pp["prop"], **({"color": COLORS[pp["color"]]} if pp.get("color") in COLORS else {}),
                          "keys": [{"t": 0, "at": {"kind": "ground", "x": x}}]}
        return items

    @staticmethod
    def _item_op(items: dict[str, dict[str, Any]], holding: dict[str, str], keys: dict[str, list[dict[str, Any]]], pos: dict[str, float],
                 op: dict[str, Any], lt: float, dur: float) -> None:
        """Действие с предметом в бите: give / throw / eat / pick_up / put_down (+ старое hold). Ключи предмета и позы героев."""
        kind, ch, prop = op.get("kind"), op.get("char"), op.get("prop")
        if ch not in keys:
            return
        color = {"color": COLORS[op["color"]]} if op.get("color") in COLORS else {}

        def in_hand() -> str | None:
            uid = holding.get(ch)
            if uid and (prop in (None, items[uid]["prop"])):
                return uid
            if prop not in PROPS:
                return None
            # предмета нет в руке: берём с земли, если лежит, иначе он «уже был в руках»
            ground = next((u for u, it in items.items() if it["prop"] == prop and u not in holding.values()), None)
            if ground:
                items[ground]["keys"].append({"t": round(max(0.0, lt - 0.3), 3), "at": {"kind": "hand", "char": ch}, "anim": "pass"})
                holding[ch] = ground
                return ground
            n = len(items)
            while f"{prop}{n}" in items:
                n += 1
            uid = f"{prop}{n}"
            items[uid] = {"uid": uid, "prop": prop, **color, "keys": [{"t": round(max(0.0, lt - 0.2), 3), "at": {"kind": "hand", "char": ch}}]}
            holding[ch] = uid
            return uid

        def act(c: str, action: str, at: float, until: float, face: str | None = None) -> None:
            k: dict[str, Any] = {"t": round(at, 3), "action": action}
            if face in pos and c in pos and pos[face] != pos[c]:
                k["facing"] = 1 if pos[face] > pos[c] else -1  # повернуться к тому, кому даём / бросаем
            keys[c].append(k)
            keys[c].append({"t": round(until, 3), "action": "idle"})

        if kind == "pick_up":
            ground = next((u for u, it in items.items() if it["prop"] == prop and u not in holding.values()), None)
            if ground:
                act(ch, "pick_up", lt, lt + 0.8)
                items[ground]["keys"].append({"t": round(lt + 0.35, 3), "at": {"kind": "hand", "char": ch}, "anim": "pass"})
                holding[ch] = ground
            else:
                in_hand()
        elif kind == "put_down":
            uid = holding.pop(ch, None)
            if uid:
                act(ch, "put_down", lt, lt + 0.8)
                items[uid]["keys"].append({"t": round(lt + 0.35, 3), "at": {"kind": "ground", "x": pos.get(ch, 960.0) + 80}, "anim": "drop"})
        elif kind in ("give", "throw"):
            tg = op.get("target")
            uid = in_hand()
            if not uid or tg not in keys or tg == ch:
                return
            holding.pop(ch, None)
            if kind == "give":
                act(ch, "give", lt, lt + 1.0, tg)
                items[uid]["keys"].append({"t": round(lt + 0.45, 3), "at": {"kind": "hand", "char": tg}, "anim": "pass"})
            else:
                act(ch, "throw", lt, lt + 0.9, tg)
                items[uid]["keys"].append({"t": round(lt + 0.4, 3), "at": {"kind": "hand", "char": tg}, "anim": "throw"})
                act(tg, "catch", lt + 0.75, lt + 1.6, ch)
            holding[tg] = uid
        elif kind == "eat":
            uid = in_hand()
            if not uid:
                return
            act(ch, "eat", lt + 0.05, lt + max(1.2, dur))
            items[uid]["keys"].append({"t": round(lt + 0.6, 3), "state": "bitten"})
            if dur > 2.2:
                items[uid]["keys"].append({"t": round(lt + dur, 3), "state": "eaten"})

    def static(self, kind: str, duration: float, text: str | None = None, sub: str | None = None, location: str = "garden") -> None:
        """Сцена без героев и реплик: заставка сериала (intro), плашка «Story time!» (bumper). Рисует Episode (ShowIntro / ShowBumper)."""
        overlays = [{"t": 0, "dur": duration, "kind": "title", "text": text, **({"sub": sub} if sub else {})}] if text else []
        self.scenes.append({"location": location, "kind": kind, "seed": self._seed(), "start": round(self.t, 3), "duration": duration,
                            "camera": [], "actors": [], "lines": [], "overlays": overlays})
        self.t += duration

    def _seed(self) -> int:
        """Сид сцены: хэш проекта + номер сцены — мелочи локации (цвета игрушек, цветы, облака) разные, но рендер детерминирован."""
        return zlib.crc32(f"{self.project_id}:{len(self.scenes)}".encode()) % 1_000_000 + 1

    def _place(self, cast: list[str]) -> dict[str, float]:
        layouts = {1: ["center"], 2: ["center_left", "center_right"], 3: ["left", "center", "right"], 4: ["left", "center_left", "center_right", "right"]}
        names = layouts.get(len(cast), ["left", "center_left", "center", "center_right", "right"])
        out = {c: SLOTS[names[min(i, len(names) - 1)]] for i, c in enumerate(cast[:5])}
        if len(cast) >= 3:
            # равномерно, с запасом под ширину голов: 3 → 630/960/1290, 4 → 465…1455, 5 → 360…1560
            step = min(330.0, (STAGE[1] - STAGE[0] + 60) / (len(cast) - 1))
            out = {c: 960 + (i - (len(cast) - 1) / 2) * step for i, c in enumerate(cast)}
        return out

    @staticmethod
    def free_spot(ch: str, dest: float, pos: dict[str, float]) -> float:
        """Ближайшая к цели точка, где герой не стоит ни в ком (≥ GAP до остальных на сцене); за кадр — как просили."""
        if not STAGE[0] - 200 < dest < STAGE[1] + 200:
            return dest
        others = [x for c, x in pos.items() if c != ch and STAGE[0] - 200 < x < STAGE[1] + 200]
        best, best_d = dest, float("inf")
        for k in range(0, 64):
            for x in (dest + k * 20, dest - k * 20):
                if STAGE[0] <= x <= STAGE[1] and all(abs(x - o) >= GAP for o in others) and abs(x - dest) < best_d:
                    best, best_d = x, abs(x - dest)
            if best_d < float("inf"):
                return best
        return min(max(dest, STAGE[0]), STAGE[1])

    async def scene(self, location: str, cast: list[str], beats: list[dict[str, Any]], kind: str = "story", title: str | None = None,
                    sub: str | None = None, look: dict[str, Any] | None = None) -> None:
        cast = [c for c in cast if c in CAST] or ["benny"]
        pos = self._place(cast)
        keys: dict[str, list[dict[str, Any]]] = {c: [{"t": 0, "x": pos[c], "action": "idle", "emotion": "happy"}] for c in cast}
        cam: list[dict[str, Any]] = [{"t": 0, "x": float(np.mean(list(pos.values()))), "zoom": 1.0}]
        lines: list[dict[str, Any]] = []
        overlays: list[dict[str, Any]] = []
        lt = 0.6
        shot_since = -MIN_SHOT  # когда камера последний раз сменила план
        last_spk: str | None = None
        lines_same = 0  # сколько реплик подряд у текущего говорящего / диалога без смены плана
        items = self._items_init(look or {})
        holding: dict[str, str] = {}  # герой → uid предмета в руке
        if title:
            for c in cast:
                keys[c].append({"t": 0.3, "action": "cheer" if c != "mama" else "wave", "emotion": "laugh"})
            overlays.append({"t": 0.4, "dur": 3.2, "kind": "title", "text": title, **({"sub": sub} if sub else {})})
            lt = 0.6
        shots = {int(x["beat"]): x["shot"] for x in (look or {}).get("special_shots") or [] if isinstance(x, dict) and isinstance(x.get("beat"), int)}
        for bi, b0 in enumerate(beats):
            if not isinstance(b0, dict):
                continue
            # поля от LLM-редактора не проходят схему: всё, что не из каталога, приводим к допустимому (иначе падает рендер/эпизод)
            b = dict(b0)
            b["speaker"] = str(b.get("speaker") or "narrator").strip().lower()
            if b["speaker"] not in SPEAKERS:
                b["speaker"] = "narrator"
            if b.get("action") not in ACTIONS:
                b["action"] = "talk"
            if b.get("emotion") not in EMOTIONS:
                b["emotion"] = "happy"
            if b.get("shot") not in ("wide", "medium", "close"):
                b["shot"] = "medium"
            for f in ("move", "hold", "fx", "item"):
                b[f] = _obj(b.get(f))
            b["reactions"] = [r for r in (b.get("reactions") or []) if isinstance(r, dict)] if isinstance(b.get("reactions"), list) else []
            spk = b["speaker"]
            text = str(b.get("text") or "").strip()
            mv = b.get("move") or {}
            if mv.get("char") in CAST:
                ch = mv["char"]
                if ch not in keys:
                    keys[ch] = [{"t": 0, "x": SLOTS["off_right"], "action": "idle", "emotion": "happy"}]
                    pos[ch] = SLOTS["off_right"]
                dest = self.free_spot(ch, SLOTS.get(mv.get("to") or "center", 960.0), pos)
                # скорость под длину шага скелета (шаг ~37 ед. × масштаб за 0.39 с ≈ 115 ед./с), иначе ноги «скользят»; далеко — бегом
                dist = abs(dest - pos[ch])
                run = bool(mv.get("run")) or dist / 115 > 4.0
                d = max(0.9, min(4.5, dist / (230 if run else 115)))
                keys[ch].append({"t": lt, "x": pos[ch], "action": "run" if run else "walk"})
                keys[ch].append({"t": lt + d, "x": dest, "action": "idle"})
                pos[ch] = dest
                cam_move(cam, lt, lt + max(0.9, d * 0.6), float(np.mean([v for v in pos.values() if -100 < v < 2000] or [960])), 670.0, 1.0)
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
            if hd.get("char") in keys:  # старое поле hold → взять / положить предмет сцены
                pr = hd.get("prop")
                op = {"kind": "put_down", "char": hd["char"]} if pr in (None, "none") else {"kind": "pick_up", "char": hd["char"], "prop": pr, "color": hd.get("color")}
                self._item_op(items, holding, keys, pos, op, lt, dur)
            if b.get("item"):
                self._item_op(items, holding, keys, pos, b["item"], lt, dur)
            fx = b.get("fx") or {}
            if fx.get("char") in keys and fx.get("kind") in FX:
                keys[fx["char"]].append({"t": round(lt + 0.2, 3), "fx": fx["kind"]})
            for rc in b.get("reactions") or []:
                if rc.get("char") in keys:
                    big = rc.get("action") in ("jump", "cheer", "clap", "dance", "scared", "hug", "sad", "hop", "laugh", "catch", "spin")
                    emo = rc.get("emotion") if rc.get("emotion") in EMOTIONS else "happy"
                    keys[rc["char"]].append({"t": round(lt + 0.25, 3), "action": rc.get("action") if big else "idle", "emotion": emo})
                    keys[rc["char"]].append({"t": round(lt + dur + 0.4, 3), "action": "idle"})
            shot = b.get("shot") or "medium"
            sx = pos.get(spk, float(np.mean(list(pos.values()))))
            group = float(np.mean([v for v in pos.values() if -100 < v < 2000] or [960]))
            target = {"wide": (group, 1.0, 670.0), "medium": ((sx + group) / 2, 1.3, 640.0), "close": (sx, 1.85, 560.0)}[shot]
            # дисциплина камеры: план держится ≥ MIN_SHOT; меняем, когда сменился говорящий после 2+ реплик, на вопрос зрителю
            # (крупно) или по явной просьбе крупного плана; иначе камера стоит — кадр не «плавает» на каждой реплике
            lines_same = lines_same + 1 if spk == last_spk else 1
            want_change = b.get("ask_viewer") or shot == "close" or (spk != last_spk and lines_same == 1 and lt - shot_since >= MIN_SHOT * 1.6)
            if b.get("ask_viewer"):
                target = (sx, 1.6, 590.0)
            if want_change and lt - shot_since >= MIN_SHOT and abs(target[0] - cam[-1]["x"]) + abs(target[1] - cam[-1]["zoom"]) * 400 > 60:
                cam_move(cam, lt, lt + 0.9, target[0], target[2], target[1])
                shot_since = lt
            last_spk = spk
            special = shots.get(bi)
            if special == "push_in":  # медленный наезд на говорящего — смешная или трогательная реплика
                z0 = cam_at(cam, lt)["zoom"]
                cam_move(cam, lt, lt + max(1.2, dur), sx, 600.0, round(min(2.0, max(1.35, z0) + 0.3), 3))
                shot_since = lt
            elif special == "insert":  # вставка: крупно предмет, о котором бит, потом назад
                it = b.get("item") if isinstance(b.get("item"), dict) else {}
                who = it.get("target") if it.get("kind") in ("give", "throw") else it.get("char")
                held = next((c for c, u in holding.items() if items.get(u, {}).get("prop") == it.get("prop")), None) if it else None
                on_ground = next((k["at"]["x"] for v in items.values() for k in v["keys"][:1] if k.get("at", {}).get("kind") == "ground"), None)
                ix = pos.get(who or held or "", on_ground if on_ground is not None else sx)
                back = cam_at(cam, lt)
                hold = lt + min(max(1.4, dur), dur + 0.3)  # не дольше реплики: возврат успевает до следующего бита
                cam_move(cam, lt + 0.1, lt + 0.6, float(ix), 730.0, 2.2)
                cam.append({"t": round(hold, 3), "x": float(ix), "y": 730.0, "zoom": 2.2})
                cam_move(cam, hold, hold + 0.5, back["x"], back["y"], back["zoom"])
                shot_since = hold
            if b.get("word"):
                overlays.append({"t": round(lt, 3), "dur": round(max(dur, 2.2), 3), "kind": "word", "text": str(b["word"])[:24]})
            lt += dur + (LONG_GAP if b.get("word") else LINE_GAP)
            if b.get("ask_viewer"):
                # пауза: ребёнок отвечает вслух; спросивший ждёт (смотрит в зал), остальные «думают»
                overlays.append({"t": round(lt - 0.2, 3), "dur": ASK_PAUSE, "kind": "question", "text": "?"})
                if spk in keys:
                    keys[spk].append({"t": round(lt, 3), "action": "idle", "emotion": "happy", "facing": 1})
                for c in keys:
                    if c != spk:
                        keys[c].append({"t": round(lt + 0.3, 3), "action": "think", "emotion": "thinking"})
                        keys[c].append({"t": round(lt + ASK_PAUSE - 0.3, 3), "action": "idle", "emotion": "happy"})
                lt += ASK_PAUSE + 0.3
        dur_total = round(lt + 0.9, 3)
        if title:  # заставка истории: надпись живёт 3.2 с — сцена не короче (иначе «Story 2» лишь мелькает)
            dur_total = max(dur_total, 4.0)
        lk = look or {}
        world = resolve_world(CATALOG, location, lk, self.season) if kind != "song" else resolve_world(CATALOG, location, self.world, self.world["season"])
        dressing = "birthday" if lk.get("decor") == "birthday" else None
        if kind == "story":
            self.world = world
        explicit = {w.get("char"): [x for x in (w.get("items") or []) if x in WEAR] for w in (lk.get("wear") or []) if w.get("char") in CAST}
        auto = auto_wear(CATALOG, location, world, dressing)
        wear = {c: merge_wear([x for x in auto if not (x == "pajamas" and CAST.get(c, {}).get("adult"))], explicit.get(c, []), CATALOG) for c in keys}
        for it in items.values():  # ключи по времени; предметы сцены рисует Episode (items)
            it["keys"].sort(key=lambda k: k["t"])
        cam.sort(key=lambda c: c["t"])
        for k in keys.values():  # ключи героев по времени (сортировка устойчивая: при равном t побеждает поздний — «дать» поверх «говорить»)
            k.sort(key=lambda x: x["t"])
        self.scenes.append({
            "location": location, "kind": kind, "seed": self._seed(), "start": round(self.t, 3), "duration": dur_total,
            **({"transitionIn": lk["transition_in"]} if lk.get("transition_in") in art.TRANSITIONS else {}),
            "camera": cam, "actors": [{"id": c, "keys": k, **({"wear": wear[c]} if wear.get(c) else {})} for c, k in keys.items()],
            "lines": lines, "overlays": overlays,
            "world": {**world, **({"dressing": dressing} if dressing else {})},
            **({"decor": "birthday"} if dressing else {}),
            **({"items": list(items.values())} if items else {}),
        })
        self.t += dur_total

    async def song(self, title: str, lyrics: dict[str, Any], location: str, cast: list[str], bpm: int = 112) -> dict[str, Any]:
        """Песенка ~1.5-2 мин: вступление-хук → ПРИПЕВ (хук в первые 15 с) → куплет → припев → куплет 2 → танцевальный
        проигрыш → припев с эхом (строку поёт один герой, повторяет другой). Строки на сетке тактов (2 такта, длинная — 4),
        герои поют по очереди своими голосами, повторы припева — те же дубли (узнаваемо). Подложка — music.render_song."""
        clean = {k: [str(x).strip() for x in lyrics.get(k, []) if str(x).strip()][:4] for k in ("verse", "chorus", "verse2")}
        chorus = clean["chorus"] or clean["verse"][:2]
        cast = [c for c in cast if c in CAST] or ["benny", "mia"]
        rows: list[tuple[str, str, str]] = []  # (секция, текст, кто поёт)
        rows += [("chorus", r, cast[0]) for r in chorus]
        rows += [("verse", r, cast[(i + 1) % len(cast)]) for i, r in enumerate(clean["verse"])]
        rows += [("chorus", r, cast[0]) for r in chorus]
        rows += [("verse", r, cast[(i + 2) % len(cast)]) for i, r in enumerate(clean["verse2"])]
        rows.append(("break", "", ""))
        for r in chorus:
            rows += [("chorus", r, cast[0]), ("chorus", r, cast[1 % len(cast)])]
        beat = 60.0 / bpm
        bar = beat * 4
        lead = bar * 2  # вступление
        pos = self._place(cast)
        keys = {c: [{"t": 0, "x": pos[c], "action": "dance", "emotion": "laugh"}] for c in cast}
        lines, overlays = [], [{"t": 0.3, "dur": lead - 0.4, "kind": "title", "text": title, "sub": "Sing along!"}]
        sections = [Section("intro", 2)]
        takes: dict[tuple[str, str], np.ndarray] = {}
        at = lead
        group_x = float(np.mean(list(pos.values())))
        cam: list[dict[str, Any]] = [{"t": 0, "x": group_x, "y": 670.0, "zoom": 1.0}]
        moves = ["dance", "clap", "hop", "wiggle", "spin", "cheer", "dance", "jump"]

        def move_for(text: str, i: int) -> str:
            """Движение на строку: слово из песни (clap/jump/spin/hop/wave/stomp) или своё для каждой строки — хореография, а не «стоят»."""
            low = text.lower()
            for word, act in (("clap", "clap"), ("jump", "jump"), ("spin", "spin"), ("turn", "spin"), ("hop", "hop"), ("wave", "wave"),
                              ("wiggle", "wiggle"), ("stomp", "hop"), ("nod", "nod"), ("hooray", "cheer"), ("yay", "cheer")):
                if word in low:
                    return act
            return moves[i % len(moves)]

        def shot(t0: float, x: float, zoom: float, y: float) -> None:
            cam.append({"t": round(t0, 3), "x": cam[-1]["x"], "y": cam[-1].get("y", 670.0), "zoom": cam[-1]["zoom"]})
            cam.append({"t": round(t0 + 0.6, 3), "x": x, "y": y, "zoom": zoom})

        line_i = 0
        for kind, row, who in rows:
            if kind == "break":
                sections.append(Section("break", 4))
                for k, c in enumerate(cast):  # проигрыш: все прыгают, кружатся, хлопают — вразнобой, как живые дети
                    keys[c] += [{"t": round(at + k * 0.15, 3), "action": "jump", "emotion": "laugh"}, {"t": round(at + bar * 2, 3), "action": "spin"},
                                {"t": round(at + bar * 3, 3), "action": "clap"}, {"t": round(at + bar * 4, 3), "action": "dance"}]
                shot(at, group_x, 1.0, 670.0)
                at += bar * 4
                continue
            if (row, who) not in takes:
                takes[(row, who)], _ = await voice_line(row, who)
            clip = takes[(row, who)]
            self.clips.append((self.t + at, clip))
            dur = len(clip) / SR
            nb = 2 if dur <= bar * 2 - 0.3 else 4
            lines.append({"char": who, "start": round(at, 3), "dur": round(dur, 3), "text": row, "envelope": envelope(clip)})
            overlays.append({"t": round(at, 3), "dur": round(bar * nb - 0.1, 3), "sung": round(dur, 3), "kind": "lyric", "text": row})
            sections.append(Section(kind, nb, round(dur / beat, 2)))
            # хореография: припев — все делают одно движение (поём вместе), куплет — поющий двигается, остальные хлопают в такт
            mv = move_for(row, line_i)
            for c in cast:
                act = mv if (kind == "chorus" or c == who) else ("clap" if line_i % 2 else "dance")
                keys[c].append({"t": round(at + (0 if c == who else 0.12), 3), "action": act, "emotion": "laugh" if kind == "chorus" else "happy"})
            # камера меняет план каждые 2 строки: общий → средний на поющего → крупный → общий… (исследование: 4-8 тактов на план)
            if line_i % 2 == 0:
                sx = pos.get(who, group_x)
                phase = (line_i // 2) % 3
                if phase == 0:
                    shot(at, group_x, 1.0, 670.0)
                elif phase == 1:
                    shot(at, (sx + group_x) / 2, 1.35, 640.0)
                else:
                    shot(at, sx, 1.75, 570.0)
            line_i += 1
            at += bar * nb
        sections.append(Section("outro", 2))
        total = at + bar * 2
        plan = song_plan(zlib.crc32(f"{self.project_id}:{title}".encode()), bpm, sections)
        self.scenes.append({
            "location": location, "kind": "song", "seed": self._seed(), "world": resolve_world(CATALOG, location, self.world, self.world["season"]), "start": round(self.t, 3), "duration": round(total, 3),
            "camera": [*cam, {"t": round(at, 3), "x": cam[-1]["x"], "y": cam[-1].get("y", 670.0), "zoom": cam[-1]["zoom"]},
                       {"t": round(at + 0.8, 3), "x": group_x, "y": 670.0, "zoom": 1.05}],
            "actors": [{"id": c, "keys": k} for c, k in keys.items()], "lines": lines, "overlays": overlays,
        })
        info = {"plan": plan, "start": self.t, "dur": total}
        self.t += total
        return info


# ------------------------------------------------------------------ сборка эпизода
async def build_cartoon(project_id: str) -> None:
    st = get_settings()

    async def progress(stage: str, p: float, **extra: Any) -> None:
        async with SessionLocal() as s2:
            pr = await s2.get(Project, project_id)
            if pr is None:  # проект удалили во время генерации — бросаем работу, не грузим GPU впустую
                raise ProjectGone(project_id)
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
            fps_recent = await recent_fingerprints(s, project_id)
            usage = art.recent_usage(fps_recent)
            plan = await llm_plan(s, theme, minutes, n_stories, art.usage_hint(usage))
        stories = plan.get("stories", [])[:n_stories]
        songs = plan.get("songs", [])
        # песня ~95 с (припев ×3 + проигрыш), заставка 7 с, финал ~8 с, на историю ещё плашка и титр ~8 с
        per_story = max(120, int((minutes * 60 - len(songs) * 95 - 30 - len(stories) * 8) / max(1, len(stories))))
        scripts, report = [], []
        for i in range(len(stories)):
            await progress(f"сценарий истории {i + 1}/{len(stories)}", 0.05 + 0.25 * i / len(stories))
            async with SessionLocal() as s:
                sc = await llm_story(s, plan, i, per_story)
                sc, issues = await llm_verify(s, sc)
                season = str(stories[i].get("season") or ["summer", "autumn", "winter", "spring"][i % 4])
                used = [f"{x.get('time', 'day')}/{x.get('weather', 'clear')}" for prev in scripts for x in prev.get("scenes") or []]
                try:
                    sc = art.apply_art(sc, await llm_art(s, sc, season, usage, used))
                except LLMError as e:  # арт-директор — улучшение, не обязательный шаг
                    report.append(f"story {i + 1}: art director skipped: {e}")
                report += [f"story {i + 1}: {x}" for x in art.enforce_variety(sc.get("scenes") or [])]
            scripts.append(sc)
            report += [f"story {i + 1}: {x}" for x in issues]
        lyrics = []
        for sg in songs:
            async with SessionLocal() as s:
                lyrics.append(await llm_song(s, sg, plan))

        await progress("озвучка и режиссура", 0.32)
        d = Director(project_id)
        everyone = list(CAST)[:4]
        d.static("intro", 7.0)  # ритуал: одна и та же заставка «Benny & Friends» в каждом эпизоде
        await d.scene("garden", everyone, [{"speaker": "narrator", "text": plan.get("intro") or "Hello, friends! Welcome!", "shot": "wide"}],
                      kind="title", title=plan.get("title") or theme)
        song_starts: list[dict[str, Any]] = []
        for i, (story, script) in enumerate(zip(stories, scripts, strict=False)):
            d.static("bumper", 2.5, "Story time!")
            d.chapters.append((d.t, str(story.get("title", f"Story {i + 1}"))))
            d.season = str(story.get("season") or "") if story.get("season") in SEASONS else ["summer", "autumn", "winter", "spring"][i % 4]
            scenes = script.get("scenes") or []
            first = scenes[0] if scenes else {"location": "garden", "cast": story.get("cast", ["benny"])}
            await d.scene(first.get("location") or "garden", first.get("cast") or story.get("cast") or ["benny"], [], kind="title",
                          title=str(story.get("title", "")), sub=f"Story {i + 1}", look={"time": first.get("time"), "weather": first.get("weather")})
            for j, sc in enumerate(scenes):
                await progress(f"история {i + 1}: сцена {j + 1}/{len(scenes)}", 0.32 + 0.55 * (i + j / max(1, len(scenes))) / max(1, len(stories)))
                await d.scene(sc.get("location") or "garden", sc.get("cast") or story.get("cast") or ["benny"], sc.get("beats") or [], look=sc)
            for k, sg in enumerate(songs):
                if int(sg.get("after_story", -1)) == i + 1 and k < len(lyrics):
                    d.static("bumper", 2.5, "Song time!")
                    d.chapters.append((d.t, f"Song: {sg.get('title', '')}"))
                    song_starts.append(await d.song(str(sg.get("title", "Let's sing!")), lyrics[k], "playground" if k % 2 == 0 else "garden", everyone))
        await d.scene("garden_evening", everyone, [{"speaker": "narrator", "text": plan.get("outro") or "Bye bye, friends! See you next time!", "shot": "wide", "action": "wave"}],
                      kind="outro", title="Bye bye!", sub="See you next time!")
        for c in everyone:
            d.scenes[-1]["actors"][everyone.index(c)]["keys"].append({"t": 1.0, "action": "wave", "emotion": "laugh"})

        # звук: три стема — голоса (ровная громкость), музыка (фон с дакингом под репликами, песни, заставки, стингеры),
        # SFX + атмосфера по сценам; итог −14 LUFS / −1 dBTP (см. sfx.mix_cartoon). Тяжёлый numpy — в отдельном потоке.
        await progress("сведение звука", 0.9)
        audio, total, mix_stats = await asyncio.to_thread(mix_cartoon, d.scenes, d.clips, song_starts, d.t, st.data_dir / "cartoons" / project_id,
                                                          f"/media/cartoons/{project_id}")
        log.info("cartoon %s mix: %s", project_id, mix_stats)
        doc = {"title": plan.get("title") or theme, "fps": 30, "duration": round(total, 3), "scenes": d.scenes, "audio": audio, "show_captions": True}
        chapters = [f"{int(t) // 60:02d}:{int(t) % 60:02d} {name}" for t, name in [(0.0, "Intro"), *d.chapters]]
        fp = art.fingerprint(doc, plan)
        sims = [art.similarity(fp, f) for f in fps_recent]
        if sims:
            report.append(f"similarity to recent episodes: max {max(sims):.2f} (target ≤ 0.35)")
        qa = art.qa_checks(doc, GAP - 20)
        report += [f"qa: {x}" for x in qa["issues"]]
        report.append(f"qa stats: {qa['stats']}")
        meta = {"plan": plan, "scripts": scripts, "report": report, "chapters": chapters, "kind": "cartoon", "fingerprint": fp, "qa": qa}
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
    except ProjectGone:
        log.info("%s: project %s deleted, generation stopped", __name__, project_id)
        return
    except (LLMError, clients.ServiceError, KeyError, ValueError) as e:
        with contextlib.suppress(ProjectGone):
            await progress("ошибка", 0.0, status="failed", error=str(e)[:2000])
    except Exception as e:  # noqa: BLE001 — любой сбой виден в проекте
        log.exception("cartoon failed")
        with contextlib.suppress(ProjectGone):
            await progress("ошибка", 0.0, status="failed", error=f"{type(e).__name__}: {e}"[:2000])


_ = asyncio  # параллельная озвучка — следующий шаг (движок TTS всё равно один)
