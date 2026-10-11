"""Сборник мультиков: несколько готовых эпизодов подряд в одном ролике (30-60+ минут).

Эпизоды склеиваются целиком (со своими заставками и финалами — звук эпизода лежит дорожками от его начала, так что сцены и звук
сдвигаются вместе и не расходятся). Главы: название каждого эпизода + его внутренние главы со сдвигом.
"""
from __future__ import annotations

from typing import Any


def _ts(sec: float) -> str:
    s = int(round(sec))
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60:02d}:{s % 60:02d}"


def _parse_ts(label: str) -> tuple[float, str] | None:
    head, _, name = label.partition(" ")
    parts = head.split(":")
    try:
        nums = [int(x) for x in parts]
    except ValueError:
        return None
    sec = nums[-1] + 60 * nums[-2] + (3600 * nums[-3] if len(nums) == 3 else 0) if len(nums) >= 2 else None
    return (float(sec), name) if sec is not None else None


def merge_cartoons(episodes: list[tuple[str, dict[str, Any], dict[str, Any]]], title: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """episodes: [(название, doc, meta)] по порядку → (doc сборника, meta с планом и главами)."""
    scenes: list[dict[str, Any]] = []
    audio: list[dict[str, Any]] = []
    chapters: list[str] = []
    stories: list[dict[str, Any]] = []
    songs: list[dict[str, Any]] = []
    t = 0.0
    for name, doc, meta in episodes:
        for sc in doc.get("scenes") or []:
            scenes.append({**sc, "start": round(float(sc.get("start", 0)) + t, 3)})
        for a in doc.get("audio") or []:
            audio.append({**a, "start": round(float(a.get("start", 0)) + t, 3)})
        inner = [x for x in (_parse_ts(c) for c in meta.get("chapters") or []) if x]
        chapters.append(f"{_ts(t)} {name}")
        chapters += [f"{_ts(t + sec)} {label}" for sec, label in inner if sec >= 10]
        plan = meta.get("plan") or {}
        stories += list(plan.get("stories") or [])
        songs += list(plan.get("songs") or [])
        t += float(doc.get("duration") or 0)
    first = episodes[0][1] if episodes else {}
    doc = {"title": title, "fps": int(first.get("fps") or 30), "duration": round(t, 3), "scenes": scenes, "audio": audio,
           "show_captions": bool(first.get("show_captions", True))}
    meta = {"kind": "cartoon", "compilation": [n for n, _, _ in episodes], "chapters": chapters,
            "plan": {"title": title, "stories": stories, "songs": songs}, "report": [f"compilation of {len(episodes)} episodes, {_ts(t)}"]}
    return doc, meta
