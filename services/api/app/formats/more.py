"""Форматы этапа 4. Каждый: план озвучки → события таймлайна → SFX → правила → ответ → слова для орфографии.

Цели событий (target) в таймлайне — строки: "q" (вопрос), "opt:i", "row:i", "w:i", "card", "literal", "meaning", "question".
"""
from __future__ import annotations

import math
import re
from typing import Any, ClassVar

from pydantic import BaseModel

from ..schemas_gen.conjugation_challenge import ConjugationChallengeBody
from ..schemas_gen.daily_word import DailyWordBody
from ..schemas_gen.emoji_vocab import EmojiVocabBody
from ..schemas_gen.false_friends import FalseFriendsBody
from ..schemas_gen.fill_blank import FillBlankBody
from ..schemas_gen.idiom import IdiomBody
from ..schemas_gen.level_ladder import LevelLadderBody
from ..schemas_gen.quiz_abc import QuizAbcBody
from ..schemas_gen.spot_the_error import SpotTheErrorBody
from ..schemas_gen.tongue_twister import TongueTwisterBody
from .base import FormatSpec, Issue, Placement, Segment, TimingConfig, join_pair, normalize, speech_text

LETTERS = "ABCD"
PRONOUNS = ["io", "tu", "lui/lei", "noi", "voi", "loro"]
BLANK = "___"


def _plain(xs: Any) -> list[Any]:
    """Элементы массивов с ограничениями кодоген оборачивает в RootModel — разворачиваем."""
    return [getattr(x, "root", x) for x in xs]


def _ev(t0: float, t1: float, action: str, target: Any = None) -> dict[str, Any]:
    return {"t_start": round(t0, 3), "t_end": round(t1, 3), "action": action, "target": target}


def _hook_cta(script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> tuple[list[Segment], list[Segment]]:
    hook = (script.get("spoken_hook") or script.get("hook_text") or "").strip()
    head = [Segment("hook", speech_text(hook), gap_after=timing.gap_after_hook)] if hook else []
    tail = [Segment("cta", cta_spoken, min_dur=1.0, gap_after=timing.end_hold)] if cta_spoken else []
    return head, tail


def _common_events(by: dict[str, Placement], total: float) -> list[dict[str, Any]]:
    ev = []
    if "hook" in by:
        ev.append(_ev(0.0, by["hook"].slot_end, "hook"))
    if "cta" in by:
        ev.append(_ev(by["cta"].start, total, "cta"))
    return ev


def _sequence_events(placements: list[Placement], prefix: str, total: float, until: str | None = None) -> list[dict[str, Any]]:
    """Подсветка подряд идущих сегментов prefix:i — каждая до начала следующей (или до `until`/конца)."""
    seq = [p for p in placements if p.key.startswith(prefix + ":")]
    by = {p.key: p for p in placements}
    out = []
    for k, p in enumerate(seq):
        end = seq[k + 1].start if k + 1 < len(seq) else (by[until].start if until and until in by else total)
        out.append(_ev(p.start, end, "highlight", p.key))
    return out


def _countdown_sfx(timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for e in timeline:
        if e["action"] == "countdown":
            n = int(math.floor(e["t_end"] - e["t_start"]))
            out += [{"t": round(e["t_start"] + i, 3), "name": "tick", "volume": 0.5} for i in range(max(n, 1))]
    return out


def _std_sfx(timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in timeline:
        if e["action"] == "highlight":
            out.append({"t": e["t_start"], "name": "pop", "volume": 0.3})
        elif e["action"] == "reveal":
            out += [{"t": e["t_start"], "name": "ding", "volume": 0.45}, {"t": e["t_start"], "name": "confetti", "volume": 0.35}]
        elif e["action"] == "cta":
            out.append({"t": e["t_start"], "name": "whoosh", "volume": 0.25})
    return out + _countdown_sfx(timeline)


def _dupes(values: list[str], path: str) -> list[Issue]:
    seen: dict[str, int] = {}
    out = []
    for i, v in enumerate(values):
        k = normalize(v)
        if k in seen:
            out.append(Issue(f"{path}.{i}", f"Дубль варианта {seen[k] + 1}"))
        seen[k] = i
    return out


class _Base:
    id: ClassVar[str]
    body_model: ClassVar[type[BaseModel]]

    def sfx(self, timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return _std_sfx(timeline)

    def content_words(self, script: dict[str, Any]) -> list[str]:
        return [w for _, w in self.italian_words(script)] or [script.get("title", "")]

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        return []


# ====================================================================== quiz_abc
class QuizAbc(_Base):
    id = "quiz_abc"
    body_model: ClassVar[type[BaseModel]] = QuizAbcBody

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = QuizAbcBody.model_validate(script["body"])
        head, tail = _hook_cta(script, cta_spoken, timing)
        q = b.spoken_question or b.question
        segs = [*head, Segment("q", speech_text(q) if (b.question_lang or "it") == "it" else "", min_dur=1.6, gap_after=0.35)]
        for i, o in enumerate(_plain(b.options)):
            segs.append(Segment(f"opt:{i}", speech_text(o) if (b.options_lang or "it") == "it" else "", min_dur=0.9, gap_after=0.25))
        timer = float(b.timer_s or 3)
        if b.reveal is not False:
            segs += [Segment("countdown", "", min_dur=timer, gap_after=0.0)]
            ans = _plain(b.options)[b.correct]
            segs += [Segment("reveal", f"Risposta {LETTERS[b.correct]}: {speech_text(ans)}" if (b.options_lang or "it") == "it" else f"Risposta {LETTERS[b.correct]}",
                             min_dur=1.4, gap_after=0.3)]
            segs += tail
        else:
            segs += [*[Segment(t.key, t.text, t.min_dur, 0.2) for t in tail], Segment("countdown", "", min_dur=timer, gap_after=0.0)]
        return segs

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev = _common_events(by, total)
        ev.append(_ev(by["q"].start, by["opt:0"].start, "highlight", "q"))
        ev += _sequence_events(placements, "opt", total, until="countdown")
        cd = by["countdown"]
        ev.append(_ev(cd.start, cd.slot_end, "countdown", round(cd.slot_end - cd.start)))
        if "reveal" in by:
            b = QuizAbcBody.model_validate(script["body"])
            ev.append(_ev(by["reveal"].start, total, "reveal", f"opt:{b.correct}"))
        return ev

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = QuizAbcBody.model_validate(script["body"])
        out = _dupes(_plain(b.options), "body.options")
        if b.correct >= len(_plain(b.options)):
            out.append(Issue("body.correct", "Номер правильного ответа вне списка"))
        return out

    def answer(self, script: dict[str, Any]) -> str:
        b = QuizAbcBody.model_validate(script["body"])
        return f"{LETTERS[b.correct]}) {_plain(b.options)[b.correct]}"

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = QuizAbcBody.model_validate(script["body"])
        out = [("body.question", b.question)] if (b.question_lang or "it") == "it" else []
        if (b.options_lang or "it") == "it":
            out += [(f"body.options.{i}", o) for i, o in enumerate(_plain(b.options))]
        return out


# ====================================================================== fill_blank
class FillBlank(QuizAbc):
    id = "fill_blank"
    body_model = FillBlankBody

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = FillBlankBody.model_validate(script["body"])
        head, tail = _hook_cta(script, cta_spoken, timing)
        spoken = b.sentence.replace(BLANK, "…")
        segs = [*head, Segment("q", speech_text(spoken), min_dur=1.8, gap_after=0.35)]
        segs += [Segment(f"opt:{i}", speech_text(o), min_dur=0.8, gap_after=0.2) for i, o in enumerate(_plain(b.options))]
        timer = float(b.timer_s or 3)
        if b.reveal is not False:
            segs += [Segment("countdown", "", min_dur=timer, gap_after=0.0), Segment("reveal", speech_text(self.full(b)), min_dur=1.6, gap_after=0.3), *tail]
        else:
            segs += [*[Segment(t.key, t.text, t.min_dur, 0.2) for t in tail], Segment("countdown", "", min_dur=timer, gap_after=0.0)]
        return segs

    @staticmethod
    def full(b: FillBlankBody) -> str:
        return b.sentence.replace(BLANK, _plain(b.options)[b.correct], 1)

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev = _common_events(by, total)
        ev.append(_ev(by["q"].start, by["opt:0"].start, "highlight", "q"))
        ev += _sequence_events(placements, "opt", total, until="countdown")
        cd = by["countdown"]
        ev.append(_ev(cd.start, cd.slot_end, "countdown", round(cd.slot_end - cd.start)))
        if "reveal" in by:
            ev.append(_ev(by["reveal"].start, total, "reveal", f"opt:{FillBlankBody.model_validate(script['body']).correct}"))
        return ev

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = FillBlankBody.model_validate(script["body"])
        out = _dupes(_plain(b.options), "body.options")
        if b.sentence.count(BLANK) != 1:
            out.append(Issue("body.sentence", f"В фразе должен быть ровно один пропуск {BLANK}"))
        if b.correct >= len(_plain(b.options)):
            out.append(Issue("body.correct", "Номер правильного ответа вне списка"))
        return out

    def answer(self, script: dict[str, Any]) -> str:
        b = FillBlankBody.model_validate(script["body"])
        return str(_plain(b.options)[b.correct])

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = FillBlankBody.model_validate(script["body"])
        if b.correct >= len(_plain(b.options)):
            return []
        return [("body.sentence", self.full(b))]


# ====================================================================== spot_the_error
class SpotTheError(_Base):
    id = "spot_the_error"
    body_model = SpotTheErrorBody

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = SpotTheErrorBody.model_validate(script["body"])
        head, tail = _hook_cta(script, cta_spoken, timing)
        # неправильную фразу голосом не читаем — чтобы не закреплять ошибку на слух
        segs = [*head, Segment("q", "Trova l'errore!", min_dur=1.2, gap_after=0.2)]
        timer = float(b.timer_s or 3)
        if b.reveal is not False:
            segs += [Segment("countdown", "", min_dur=timer, gap_after=0.0), Segment("reveal", speech_text(self.fixed(b)), min_dur=2.0, gap_after=0.4), *tail]
        else:
            segs += [*[Segment(t.key, t.text, t.min_dur, 0.2) for t in tail], Segment("countdown", "", min_dur=timer, gap_after=0.0)]
        return segs

    @staticmethod
    def fixed(b: SpotTheErrorBody) -> str:
        return b.sentence.replace(b.wrong, b.right, 1)

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev = _common_events(by, total)
        ev.append(_ev(by["q"].start, by["countdown"].start, "highlight", "q"))
        cd = by["countdown"]
        ev.append(_ev(cd.start, cd.slot_end, "countdown", round(cd.slot_end - cd.start)))
        if "reveal" in by:
            ev.append(_ev(by["reveal"].start, total, "reveal", "fix"))
        return ev

    def sfx(self, timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = _std_sfx(timeline)
        return [{**x, "name": "buzz"} if x["name"] == "ding" else x for x in out]  # «бзз» на зачёркивании

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = SpotTheErrorBody.model_validate(script["body"])
        out = []
        if b.wrong not in b.sentence:
            out.append(Issue("body.wrong", "Ошибочный фрагмент должен точно встречаться во фразе"))
        if normalize(b.wrong) == normalize(b.right):
            out.append(Issue("body.right", "Исправление совпадает с ошибкой"))
        return out

    def answer(self, script: dict[str, Any]) -> str:
        return self.fixed(SpotTheErrorBody.model_validate(script["body"]))

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = SpotTheErrorBody.model_validate(script["body"])
        return [("body.right", self.fixed(b))] if b.wrong in b.sentence else []


# ====================================================================== rows: false_friends / emoji / level / conjugation
class _Rows(_Base):
    """Строки подсвечиваются по очереди; hidden(i) — что скрыто (голос молчит или говорит только видимое)."""

    def row_texts(self, script: dict[str, Any]) -> list[str]:
        raise NotImplementedError

    def hidden(self, script: dict[str, Any]) -> set[int]:
        return set()

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        head, tail = _hook_cta(script, cta_spoken, timing)
        rows = self.row_texts(script)
        hid = self.hidden(script)
        segs = [Segment(f"row:{i}", "" if i in hid else speech_text(t), min_dur=timing.min_item + 0.15, gap_after=timing.gap_between_items)
                for i, t in enumerate(rows)]
        return [*head, *segs, *tail]

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        return _common_events(by, total) + _sequence_events(placements, "row", total)


class FalseFriends(_Rows):
    id = "false_friends"
    body_model = FalseFriendsBody

    def row_texts(self, script: dict[str, Any]) -> list[str]:
        return [it.it for it in FalseFriendsBody.model_validate(script["body"]).items]

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = FalseFriendsBody.model_validate(script["body"])
        return _dupes([i.it for i in b.items], "body.items")

    def answer(self, script: dict[str, Any]) -> str:
        last = FalseFriendsBody.model_validate(script["body"]).items[-1]
        return f"{last.it} = {last.it_means}"

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = FalseFriendsBody.model_validate(script["body"])
        return [(f"body.items.{i}.it", x.it) for i, x in enumerate(b.items)] + [(f"body.items.{i}.say_instead", x.say_instead) for i, x in enumerate(b.items)]


class EmojiVocab(_Rows):
    id = "emoji_vocab"
    body_model = EmojiVocabBody

    def row_texts(self, script: dict[str, Any]) -> list[str]:
        return [join_pair(it.article, it.word) if it.article else it.word for it in EmojiVocabBody.model_validate(script["body"]).items]

    def hidden(self, script: dict[str, Any]) -> set[int]:
        return {len(EmojiVocabBody.model_validate(script["body"]).items) - 1}

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = EmojiVocabBody.model_validate(script["body"])
        return _dupes([i.word for i in b.items], "body.items") + _dupes([i.emoji for i in b.items], "body.items")

    def answer(self, script: dict[str, Any]) -> str:
        return self.row_texts(script)[-1]

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        return [(f"body.items.{i}.word", t) for i, t in enumerate(self.row_texts(script))]


class LevelLadder(_Rows):
    id = "level_ladder"
    body_model = LevelLadderBody
    ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

    def row_texts(self, script: dict[str, Any]) -> list[str]:
        return [s.text for s in LevelLadderBody.model_validate(script["body"]).steps]

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = LevelLadderBody.model_validate(script["body"])
        lv = [self.ORDER.index(s.level) for s in b.steps]
        out = _dupes([s.text for s in b.steps], "body.steps")
        if lv != sorted(lv) or len(set(lv)) != len(lv):
            out.append(Issue("body.steps", "Уровни должны идти по возрастанию без повторов (A1 → C2)"))
        return out

    def answer(self, script: dict[str, Any]) -> str:
        return ""

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = LevelLadderBody.model_validate(script["body"])
        return [(f"body.steps.{i}.text", s.text) for i, s in enumerate(b.steps)]


class ConjugationChallenge(_Rows):
    id = "conjugation_challenge"
    body_model = ConjugationChallengeBody

    def row_texts(self, script: dict[str, Any]) -> list[str]:
        b = ConjugationChallengeBody.model_validate(script["body"])
        return [join_pair(p, f) for p, f in zip(PRONOUNS, _plain(b.forms), strict=True)]

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        segs = super().segments(script, cta_spoken, timing)
        hid = self.hidden(script)
        # для скрытых форм голос говорит только местоимение («noi…»)
        return [Segment(s.key, PRONOUNS[int(s.key[4:])].split("/")[0], s.min_dur, s.gap_after) if s.key.startswith("row:") and int(s.key[4:]) in hid else s for s in segs]

    def hidden(self, script: dict[str, Any]) -> set[int]:
        return set(_plain(ConjugationChallengeBody.model_validate(script["body"]).hidden))

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        ev = super().timeline(script, placements, total)
        b = ConjugationChallengeBody.model_validate(script["body"])
        by = {p.key: p for p in placements}
        if b.reveal and "cta" in by:
            ev.append(_ev(by["cta"].end + 0.2, total, "reveal", None))
        return ev

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = ConjugationChallengeBody.model_validate(script["body"])
        out = []
        if len(set(_plain(b.hidden))) != len(_plain(b.hidden)):
            out.append(Issue("body.hidden", "Одна и та же форма скрыта дважды"))
        return out

    def answer(self, script: dict[str, Any]) -> str:
        b = ConjugationChallengeBody.model_validate(script["body"])
        return ", ".join(join_pair(PRONOUNS[i], _plain(b.forms)[i]) for i in sorted(set(_plain(b.hidden))))

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = ConjugationChallengeBody.model_validate(script["body"])
        return [(f"body.forms.{i}", f) for i, f in enumerate(_plain(b.forms))]


# ====================================================================== tongue_twister
_WORDS = re.compile(r"[^\s]+")


class TongueTwister(_Base):
    id = "tongue_twister"
    body_model = TongueTwisterBody

    @staticmethod
    def words(text: str) -> list[str]:
        return _WORDS.findall(text)

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = TongueTwisterBody.model_validate(script["body"])
        head, tail = _hook_cta(script, cta_spoken, timing)
        slow = float(b.slow_speed or 0.8)
        words = [Segment(f"w:{i}", re.sub(r"[^\w'’àèéìòù]", "", w, flags=re.I) or w, min_dur=0.35, gap_after=0.12, speed=slow)
                 for i, w in enumerate(self.words(b.text))]
        fast = Segment("fast", b.text, min_dur=1.0, gap_after=0.5, speed=float(b.fast_speed or 1.25))
        return [*head, *words, fast, *tail]

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev = _common_events(by, total)
        ev += [{**e, "action": "word"} for e in _sequence_events(placements, "w", total, until="fast")]
        f = by["fast"]
        ev.append(_ev(f.start, f.slot_end, "speak_fast", None))
        return ev

    def sfx(self, timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [{"t": e["t_start"], "name": "whoosh", "volume": 0.3} for e in timeline if e["action"] in ("speak_fast", "cta")]

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = TongueTwisterBody.model_validate(script["body"])
        n = len(self.words(b.text))
        return [Issue("body.text", "Скороговорка: нужно от 4 до 22 слов")] if not 4 <= n <= 22 else []

    def answer(self, script: dict[str, Any]) -> str:
        return ""

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        return [("body.text", TongueTwisterBody.model_validate(script["body"]).text)]


# ====================================================================== idiom
class Idiom(_Base):
    id = "idiom"
    body_model = IdiomBody

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = IdiomBody.model_validate(script["body"])
        head, tail = _hook_cta(script, cta_spoken, timing)
        segs = [*head, Segment("card", speech_text(b.idiom), min_dur=1.6, gap_after=0.4),
                Segment("literal", "", min_dur=1.8, gap_after=0.2),  # буквальный и реальный смысл — на 2-м языке, голос молчит
                Segment("meaning", "", min_dur=2.0, gap_after=0.3)]
        if b.example:
            segs.append(Segment("example", speech_text(b.example), min_dur=1.5, gap_after=0.3))
        if b.question:
            segs.append(Segment("question", speech_text(b.question), min_dur=1.4, gap_after=0.3))
        return [*segs, *tail]

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev = _common_events(by, total)
        order = [k for k in ("card", "literal", "meaning", "example", "question") if k in by]
        for i, k in enumerate(order):
            end = by[order[i + 1]].start if i + 1 < len(order) else total
            ev.append(_ev(by[k].start, end, "highlight", k))
        return ev

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = IdiomBody.model_validate(script["body"])
        return [Issue("body.answer", "Есть скрытый ответ, но нет вопроса к нему")] if b.answer and not b.question else []

    def cta_fits(self, script: dict[str, Any], cta: str) -> bool:
        """«E cosa si risponde?» уместен только когда у идиомы есть фиксированный ответ (In bocca al lupo → Crepi!)."""
        has_answer = bool(IdiomBody.model_validate(script["body"]).answer)
        return has_answer or "rispond" not in cta.lower()

    def answer(self, script: dict[str, Any]) -> str:
        b = IdiomBody.model_validate(script["body"])
        return b.answer or b.meaning

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = IdiomBody.model_validate(script["body"])
        return [(f"body.{k}", v) for k, v in (("idiom", b.idiom), ("question", b.question), ("answer", b.answer), ("example", b.example)) if v]


# ====================================================================== daily_word
class DailyWord(_Base):
    id = "daily_word"
    body_model = DailyWordBody

    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = DailyWordBody.model_validate(script["body"])
        head, tail = _hook_cta(script, cta_spoken, timing)
        w = join_pair(b.article, b.word) if b.article else b.word
        return [*head, Segment("card", speech_text(w), min_dur=1.4, gap_after=0.5), Segment("slow", speech_text(w), min_dur=1.2, gap_after=0.5, speed=0.8),
                Segment("example", speech_text(b.example), min_dur=2.0, gap_after=0.5), *tail]

    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev = _common_events(by, total)
        ev.append(_ev(by["card"].start, by["slow"].start, "highlight", "card"))
        ev.append(_ev(by["slow"].start, by["example"].start, "speak_slow", "card"))
        ev.append(_ev(by["example"].start, by["cta"].start if "cta" in by else total, "highlight", "example"))
        return ev

    def rules(self, script: dict[str, Any]) -> list[Issue]:
        b = DailyWordBody.model_validate(script["body"])
        if normalize(b.word.split()[0])[:3] not in normalize(b.example):
            return [Issue("body.example", "В примере нет самого слова", "warning")]
        return []

    def answer(self, script: dict[str, Any]) -> str:
        return ""

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = DailyWordBody.model_validate(script["body"])
        return [("body.word", b.word), ("body.example", b.example)]


ALL: list[FormatSpec] = [QuizAbc(), FillBlank(), SpotTheError(), FalseFriends(), EmojiVocab(), LevelLadder(), ConjugationChallenge(), TongueTwister(), Idiom(), DailyWord()]
