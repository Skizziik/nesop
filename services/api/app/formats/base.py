"""Контракт формата ролика на стороне Python. TS-часть — packages/templates/src/formats/*."""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, ClassVar, Protocol

from pydantic import BaseModel


@dataclass
class Segment:
    """Кусок озвучки. key связывает аудио с событием таймлайна (hook, item:3, cta, reveal)."""

    key: str
    text: str  # пусто = тишина длиной min_dur
    min_dur: float = 0.0
    gap_after: float = 0.3
    speed: float = 1.0  # множитель к скорости голоса серии (скороговорка: медленно/быстро)


@dataclass
class Placement:
    key: str
    start: float
    end: float  # конец звучания (без паузы)
    slot_end: float  # конец слота с паузой


@dataclass
class Issue:
    field: str
    message: str
    severity: str = "error"  # error | warning
    source: str = "rules"

    def as_dict(self) -> dict[str, str]:
        return {"field": self.field, "message": self.message, "severity": self.severity, "source": self.source}


@dataclass
class TimingConfig:
    lead_in: float = 0.12
    gap_after_hook: float = 0.3
    gap_between_items: float = 0.28
    min_item: float = 0.9
    end_hold: float = 0.9
    extra: dict[str, float] = field(default_factory=dict)


class FormatSpec(Protocol):
    id: ClassVar[str]

    @property
    def body_model(self) -> type[BaseModel]: ...

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]: ...

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]: ...

    def sfx(self, timeline: list[dict[str, Any]]) -> list[dict[str, Any]]: ...

    def rules(self, script: dict[str, Any]) -> list[Issue]: ...

    def answer(self, script: dict[str, Any]) -> str: ...

    def content_words(self, script: dict[str, Any]) -> list[str]: ...

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        """(путь поля, итальянский текст) — для орфографии (этап 3)."""
        ...


# ---------- общие утилиты ----------
_ALT = re.compile(r"(\w+)/(\w+)")


def speech_text(s: str) -> str:
    """Экранный текст → произносимый: «andato/a» → «andato», «lui/lei» → «lui»."""
    return _ALT.sub(lambda m: m.group(1), s).strip()


def join_pair(left: str, right: str) -> str:
    """«l'» + «acqua» → «l'acqua», «io» + «sono» → «io sono»."""
    return f"{left}{right}" if left.endswith(("'", "’")) else f"{left} {right}"


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower().replace("’", "'")
    return re.sub(r"\s+", " ", s).strip()


def content_hash(words: list[str]) -> str:
    return hashlib.sha1("|".join(sorted(normalize(w) for w in words)).encode()).hexdigest()


ACCENT_FIXES = {
    # частые ошибки набора: апостроф вместо акцента
    "e'": "è", "perche'": "perché", "piu'": "più", "puo'": "può", "citta'": "città", "caffe'": "caffè", "gia'": "già", "cosi'": "così",
}
