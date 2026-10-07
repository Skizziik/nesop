"""list_mystery: столбик пар, последовательная подсветка, последняя строка спрятана."""
from __future__ import annotations

import re
from typing import Any, ClassVar

from ..schemas_gen.list_mystery import ListMysteryBody
from .base import ACCENT_FIXES, Issue, Placement, Segment, TimingConfig, join_pair, normalize, speech_text

_APOS_BAD = re.compile(r"\b(l|dell|nell|all|sull|dall|un|quell|bell)\s+'", re.I)
_DIGITS = re.compile(r"^[\d.:°,]+$")


class ListMystery:
    id: ClassVar[str] = "list_mystery"
    body_model: ClassVar[type[ListMysteryBody]] = ListMysteryBody

    def _body(self, script: dict[str, Any]) -> ListMysteryBody:
        return ListMysteryBody.model_validate(script["body"])

    # ---------- озвучка ----------
    def segments(self, script: dict[str, Any], cta_spoken: str, timing: TimingConfig) -> list[Segment]:
        b = self._body(script)
        hook = (script.get("spoken_hook") or script.get("hook_text") or "").strip()
        segs: list[Segment] = []
        if hook:
            segs.append(Segment("hook", speech_text(hook), gap_after=timing.gap_after_hook))
        n = len(b.items)
        for i, it in enumerate(b.items):
            last = i == n - 1
            if not last:
                text = join_pair(it.left, it.right) if b.speak == "both" else it.right
            elif b.speak == "both":
                text = it.right if b.hide == "left" else it.left  # произносим только видимую половину
            else:
                text = ""
            segs.append(Segment(f"item:{i}", speech_text(text), min_dur=timing.min_item, gap_after=timing.gap_between_items))
        if cta_spoken:
            segs.append(Segment("cta", cta_spoken, min_dur=1.0, gap_after=timing.end_hold))
        if b.reveal:
            segs.append(Segment("reveal", speech_text(self._full(b, n - 1)), min_dur=1.2, gap_after=0.8))
        return segs

    def _full(self, b: ListMysteryBody, i: int) -> str:
        it = b.items[i]
        return join_pair(it.left, it.right) if b.speak == "both" or b.hide == "left" else it.right

    # ---------- таймлайн ----------
    def timeline(self, script: dict[str, Any], placements: list[Placement], total: float) -> list[dict[str, Any]]:
        by = {p.key: p for p in placements}
        ev: list[dict[str, Any]] = []
        if "hook" in by:
            ev.append({"t_start": 0.0, "t_end": round(by["hook"].slot_end, 3), "action": "hook", "target": None})
        items = [p for p in placements if p.key.startswith("item:")]
        for k, p in enumerate(items):
            nxt = items[k + 1].start if k + 1 < len(items) else total
            ev.append({"t_start": round(p.start, 3), "t_end": round(nxt, 3), "action": "highlight", "target": int(p.key.split(":")[1])})
        if "cta" in by:
            ev.append({"t_start": round(by["cta"].start, 3), "t_end": round(total, 3), "action": "cta", "target": None})
        if "reveal" in by:
            ev.append({"t_start": round(by["reveal"].start, 3), "t_end": round(total, 3), "action": "reveal", "target": len(items) - 1})
        return ev

    def sfx(self, timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = [{"t": e["t_start"], "name": "pop", "volume": 0.35} for e in timeline if e["action"] == "highlight"]
        out += [{"t": e["t_start"], "name": "whoosh", "volume": 0.3} for e in timeline if e["action"] == "cta"]
        out += [{"t": e["t_start"], "name": "ding", "volume": 0.45} for e in timeline if e["action"] == "reveal"]
        return out

    # ---------- проверки ----------
    def rules(self, script: dict[str, Any]) -> list[Issue]:
        issues: list[Issue] = []
        b = self._body(script)
        seen: dict[str, int] = {}
        for i, it in enumerate(b.items):
            for side in ("left", "right"):
                val: str = getattr(it, side)
                path = f"body.items.{i}.{side}"
                if val != val.strip() or "  " in val:
                    issues.append(Issue(path, "Лишние пробелы"))
                if _APOS_BAD.search(val):
                    issues.append(Issue(path, "Пробел перед апострофом (нужно «l'acqua», «dell'anno»)"))
                low = normalize(val)
                for bad, good in ACCENT_FIXES.items():
                    if re.search(rf"(^|\s){re.escape(bad)}($|\s)", low):
                        issues.append(Issue(path, f"«{bad}» → «{good}»: нужен акцент, а не апостроф"))
            key = normalize(f"{it.left}|{it.right}")
            if key in seen:
                issues.append(Issue(f"body.items.{i}", f"Дубль строки {seen[key] + 1}"))
            seen[key] = i
        if b.left_style == "badge" and not all(_DIGITS.match(it.left) for it in b.items):
            issues.append(Issue("body.left_style", "Бордовые плашки (badge) — только для чисел", "warning"))
        rights = [normalize(it.right) for it in b.items]
        if len(set(rights)) < len(rights) and script.get("topic") != "invariabili" and not any(normalize(it.left) == normalize(it.right) for it in b.items):
            issues.append(Issue("body.items", "Повторяющиеся слова в правой колонке", "warning"))
        return issues

    def answer(self, script: dict[str, Any]) -> str:
        b = self._body(script)
        last = b.items[-1]
        return last.left if b.hide == "left" else last.right

    def content_words(self, script: dict[str, Any]) -> list[str]:
        b = self._body(script)
        return [f"{it.left}={it.right}" for it in b.items]

    def italian_words(self, script: dict[str, Any]) -> list[tuple[str, str]]:
        b = self._body(script)
        out: list[tuple[str, str]] = []
        for i, it in enumerate(b.items):
            out.append((f"body.items.{i}.right", it.right))
            if b.speak == "both":  # слева тоже итальянский (местоимения, артикли, singolare)
                out.append((f"body.items.{i}.left", it.left))
        return out
