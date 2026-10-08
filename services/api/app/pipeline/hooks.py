"""Выбор хука и CTA из библиотеки с антиповтором: не чаще раза в `window` роликов серии и без повторов в пачке."""
from __future__ import annotations

import random
from collections.abc import Callable

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import utcnow
from ..models import HookPattern, Video

DEFAULT_WINDOW = 15


async def recent_pattern_ids(s: AsyncSession, series_id: str | None, column: str, window: int) -> set[str]:
    col = getattr(Video, column)
    q = select(col).where(col.is_not(None)).order_by(Video.created_at.desc()).limit(window)
    if series_id:
        q = q.where(Video.series_id == series_id)
    return {r for r in (await s.scalars(q)).all() if r}


async def pick(
    s: AsyncSession,
    rng: random.Random,
    kind: str,
    fmt: str,
    series_id: str | None,
    exclude: set[str],
    answer_mode: str | None = None,
    window: int = DEFAULT_WINDOW,
    fits: Callable[[str], bool] | None = None,
) -> HookPattern | None:
    q = select(HookPattern).where(HookPattern.kind == kind, HookPattern.enabled.is_(True))
    if kind == "cta":
        q = q.where(or_(HookPattern.answer_mode.is_(None), HookPattern.answer_mode == answer_mode))
    rows = list((await s.scalars(q.order_by(HookPattern.id))).all())
    # сначала паттерны именно этого формата, иначе — универсальные ([] = подходит любому)
    pool = [p for p in rows if fmt in (p.formats or [])] or [p for p in rows if not p.formats]
    if fits:
        pool = [p for p in pool if fits(p.spoken or p.text)] or pool
    if not pool:
        return None
    column = "hook_pattern_id" if kind == "hook" else "cta_pattern_id"
    recent = await recent_pattern_ids(s, series_id, column, window)
    for blocked in (recent | exclude, exclude, set()):
        cand = [p for p in pool if p.id not in blocked]
        if cand:
            break
    # предпочитаем реже использованные
    min_use = min(p.use_count for p in cand)
    cand = [p for p in cand if p.use_count <= min_use + 2]
    if answer_mode == "answer_tomorrow" and kind == "cta":
        tomorrow = [p for p in cand if p.answer_mode == "answer_tomorrow"]
        cand = tomorrow or cand
    choice = rng.choice(cand)
    await s.execute(update(HookPattern).where(HookPattern.id == choice.id).values(use_count=HookPattern.use_count + 1, last_used_at=utcnow()))
    return choice
