"""Арт-директор мультика и анти-повтор (docs/cartoon-visual-variety.md, этап 4).

1. Отпечаток эпизода: что в нём было (локации, мир, предметы, темы) — хранится в meta.fingerprint.
2. История показа: из последних эпизодов собирается «что уже надоело» — подсказка плану и арт-директору.
3. Арт-директор (LLM): по готовому сценарию истории решает визуал каждой сцены — время суток, погоду, вставки крупным планом
   (insert на предмет), наезды камеры (push_in) на эмоциональных репликах, переход между сценами.
4. Квоты (код): в эпизоде не меньше разных состояний мира, чем нужно; похожесть с прошлыми эпизодами считается и пишется в отчёт.
"""
from __future__ import annotations

import json
from collections import Counter
from typing import Any

TRANSITIONS = ["fade", "iris", "wipe", "star", "bubble"]

ART_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "scene_index": {"type": "integer"},
                    "time": {"type": "string", "enum": ["morning", "day", "evening", "night"]},
                    "weather": {"type": "string", "enum": ["clear", "cloudy", "rain", "snow", "windy"]},
                    "transition_in": {"type": "string", "enum": TRANSITIONS},
                    "special_shots": {
                        "type": "array",
                        "description": "1-3 per scene: insert = close-up on the object a beat is about; push_in = slow zoom on the speaker for an emotional or funny line",
                        "items": {"type": "object", "properties": {"beat": {"type": "integer"}, "shot": {"type": "string", "enum": ["insert", "push_in"]}}},
                    },
                },
            },
        },
        "notes": {"type": "string", "description": "one sentence: the visual idea of this story"},
    },
}


def fingerprint(doc: dict[str, Any], plan: dict[str, Any] | None = None) -> dict[str, Any]:
    """Отпечаток эпизода: множества того, что видел зритель."""
    locs: Counter[str] = Counter()
    worlds: Counter[str] = Counter()
    props: Counter[str] = Counter()
    for sc in doc.get("scenes") or []:
        if sc.get("kind") not in (None, "story", "song"):
            continue
        locs[sc.get("location") or "garden"] += 1
        w = sc.get("world") or {}
        worlds[f"{w.get('time', 'day')}/{w.get('weather', 'clear')}/{w.get('season', 'summer')}"] += 1
        for it in sc.get("items") or []:
            props[it.get("prop") or ""] += 1
        for pr in sc.get("props") or []:
            props[pr.get("id") or ""] += 1
    props.pop("", None)
    titles = [str(s.get("title", "")) for s in (plan or {}).get("stories", [])]
    words = sorted({str(w).lower() for s in (plan or {}).get("stories", []) for w in s.get("key_words", [])})
    return {"locations": dict(locs), "worlds": dict(worlds), "props": dict(props), "titles": titles, "key_words": words}


def jaccard(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a | b else 0.0


def similarity(fa: dict[str, Any], fb: dict[str, Any]) -> float:
    """Похожесть двух эпизодов 0..1: локации, состояния мира, предметы, ключевые слова (веса — что сильнее бросается в глаза)."""
    parts = [
        (0.35, jaccard(set(fa.get("locations", {})), set(fb.get("locations", {})))),
        (0.25, jaccard(set(fa.get("worlds", {})), set(fb.get("worlds", {})))),
        (0.2, jaccard(set(fa.get("props", {})), set(fb.get("props", {})))),
        (0.2, jaccard(set(fa.get("key_words", [])), set(fb.get("key_words", [])))),
    ]
    return round(sum(w * v for w, v in parts), 3)


def recent_usage(fps: list[dict[str, Any]]) -> dict[str, Any]:
    """Сводка последних эпизодов: частые локации/предметы/миры и прошлые названия историй."""
    locs: Counter[str] = Counter()
    props: Counter[str] = Counter()
    worlds: Counter[str] = Counter()
    titles: list[str] = []
    for f in fps:
        locs.update(f.get("locations", {}).keys())
        props.update(f.get("props", {}).keys())
        worlds.update(f.get("worlds", {}).keys())
        titles += f.get("titles", [])
    return {"locations": [k for k, _ in locs.most_common(4)], "props": [k for k, _ in props.most_common(8)],
            "worlds": [k for k, _ in worlds.most_common(4)], "titles": titles[-12:]}


def usage_hint(u: dict[str, Any]) -> str:
    if not any(u.values()):
        return ""
    return (
        "\nRecently shown on the channel — make this episode feel NEW: avoid repeating these story ideas "
        f"{u['titles']}; use other locations than the most frequent {u['locations']}, other key objects than {u['props']}, "
        f"and other looks than {u['worlds']} (time/weather/season).\n"
    )


def art_prompt(story: dict[str, Any], season: str, u: dict[str, Any], used_worlds: list[str]) -> str:
    """Короткое описание сцен для арт-директора: локация, кто, о чём биты (индекс: говорящий, текст, предмет)."""
    lines = []
    for i, sc in enumerate(story.get("scenes") or []):
        beats = [f"{j}:{b.get('speaker')}: {str(b.get('text', ''))[:60]}" + (f" [item {b['item'].get('kind')} {b['item'].get('prop')}]" if isinstance(b.get("item"), dict) else "")
                 for j, b in enumerate(sc.get("beats") or [])]
        lines.append(f"Scene {i} at {sc.get('location')} (writer asked time={sc.get('time')}, weather={sc.get('weather')}):\n  " + "\n  ".join(beats[:40]))
    return (
        "You are the art director of a preschool cartoon (Peppa Pig / Bluey level). For each scene of this story choose the time of day, "
        "the weather, the transition into the scene and 1-3 special shots. Make the story visually varied and readable: at least two "
        "different looks across the scenes (e.g. a sunny morning, then a rainy afternoon, then a golden evening), weather that supports the "
        "plot (rain for puddles, wind for kites, snow only in winter), night only for bedtime. Inserts on the key object when a beat is about it "
        "(gives, finds, eats, shows), push-ins on the funniest or most emotional line. "
        f"Season of the story: {season}. Looks already used earlier in this episode: {used_worlds}.\n"
        + usage_hint(u)
        + "\n".join(lines)
    )


def apply_art(story: dict[str, Any], art: dict[str, Any]) -> dict[str, Any]:
    """Решения арт-директора → поля сцен сценария (time/weather/transition_in/special_shots)."""
    scenes = story.get("scenes") or []
    for a in art.get("scenes") or []:
        i = a.get("scene_index")
        if not isinstance(i, int) or not 0 <= i < len(scenes):
            continue
        sc = scenes[i]
        for k in ("time", "weather"):
            if a.get(k):
                sc[k] = a[k]
        if a.get("transition_in") in TRANSITIONS:
            sc["transition_in"] = a["transition_in"]
        shots = [x for x in a.get("special_shots") or [] if isinstance(x, dict) and x.get("shot") in ("insert", "push_in") and isinstance(x.get("beat"), int)]
        if shots:
            sc["special_shots"] = shots[:3]
    return story


def enforce_variety(scenes: list[dict[str, Any]], min_looks: int = 2) -> list[str]:
    """Квота: в истории из 2+ сцен — не меньше min_looks разных (time, weather). Иначе меняем время у поздних сцен. Возвращает заметки."""
    notes: list[str] = []
    story_scenes = [sc for sc in scenes if sc.get("beats")]
    if len(story_scenes) < 2:
        return notes
    looks = {(sc.get("time") or "day", sc.get("weather") or "clear") for sc in story_scenes}
    if len(looks) >= min(min_looks, len(story_scenes)):
        return notes
    order = ["morning", "day", "evening"]
    for k, sc in enumerate(story_scenes[1:], start=1):
        if sc.get("location") == "bedroom":
            continue
        cur = sc.get("time") or "day"
        sc["time"] = order[(order.index(cur) + k) % 3] if cur in order else "evening"
        notes.append(f"variety quota: scene {k} time {cur} → {sc['time']}")
        break
    return notes


def dumps(x: Any) -> str:
    return json.dumps(x, ensure_ascii=False)


def qa_checks(doc: dict[str, Any], gap: float = 230.0) -> dict[str, Any]:
    """Автопроверки готового эпизода (без рендера): пересечения героев, говорящий в сцене, длина планов, темп речи, предметы.

    Возвращает {"issues": [...], "stats": {...}} — пишется в meta.qa и в отчёт.
    """
    issues: list[str] = []
    shots: list[float] = []
    words = 0
    speech = 0.0
    for si, sc in enumerate(doc.get("scenes") or []):
        if sc.get("kind") not in (None, "story", "song", "title", "outro"):
            continue
        actors = {a["id"]: a for a in sc.get("actors") or []}
        # пересечения: позиции героев в моменты их ключей
        times = sorted({float(k["t"]) for a in actors.values() for k in a.get("keys") or [] if "x" in k})
        pairs: set[tuple[str, str]] = set()
        for t in times:
            xs = []
            for aid, a in actors.items():
                ks = [k for k in a.get("keys") or [] if "x" in k]
                prev = [k for k in ks if float(k["t"]) <= t]
                if prev:
                    xs.append((float(prev[-1]["x"]), aid))
            xs.sort()
            for (x1, a1), (x2, a2) in zip(xs, xs[1:], strict=False):
                if 0 <= x1 <= 1920 and 0 <= x2 <= 1920 and x2 - x1 < gap and tuple(sorted((a1, a2))) not in pairs:
                    pairs.add(tuple(sorted((a1, a2))))  # type: ignore[arg-type]
                    issues.append(f"scene {si}: {a1} and {a2} overlap at t={t:.1f} ({x2 - x1:.0f} < {gap:.0f})")
        for ln in sc.get("lines") or []:
            if ln.get("char") not in actors and ln.get("char") != "narrator":
                issues.append(f"scene {si}: {ln.get('char')} speaks but is not in the scene")
            words += len(str(ln.get("text", "")).split())
            speech += float(ln.get("dur") or 0)
        for it in sc.get("items") or []:
            for k in it.get("keys") or []:
                at = k.get("at") or {}
                if at.get("kind") == "hand" and at.get("char") not in actors:
                    issues.append(f"scene {si}: {it.get('prop')} in the hand of absent {at.get('char')}")
        cam = sc.get("camera") or []
        moves = [float(c["t"]) for c in cam]
        bounds = [0.0, *moves, float(sc.get("duration") or 0)]
        shots += [b - a for a, b in zip(bounds, bounds[1:], strict=False) if b - a > 0.95]
    seen: set[str] = set()
    issues = [x for x in issues if not (x in seen or seen.add(x))][:30]
    avg_shot = round(sum(shots) / len(shots), 1) if shots else 0.0
    wpm = round(words / speech * 60) if speech else 0
    if shots and avg_shot < 4:
        issues.append(f"average shot {avg_shot}s < 4s — camera too busy")
    if wpm > 150:
        issues.append(f"speech rate {wpm} wpm > 150 — lines too long/fast for 2-5 year olds")
    return {"issues": issues, "stats": {"avg_shot_s": avg_shot, "wpm": wpm, "words": words, "speech_s": round(speech, 1)}}
