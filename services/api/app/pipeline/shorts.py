"""Шортсы из готового мультика: 2-3 вертикальных ролика 20-45 с (припев песни, смешной/милый момент, вопрос зрителю).

`pick_moments(doc)` — чистая функция по CartoonDoc (без БД и сети): окна [from, to] в секундах эпизода,
границы — только на краях сцен и в паузах между репликами (слово не режется, строка караоке целиком).
`render_shorts(pid)` — рендер каждого окна композицией CartoonShort (1080×1920) в /projects/<pid>/shorts/<n>/video.mp4,
статусы — в project.meta["shorts"].
"""
from __future__ import annotations

import re
import time
from collections import Counter
from typing import Any

MIN_S = 20.0
MAX_S = 45.0
FALLBACK_MIN_S = 15.0  # короткий эпизод: лучше шортс 15 с, чем никакого
STORY_KINDS = {"story", None}
CARD_KINDS = {"intro", "outro", "bumper"}

# смешное и милое: эмоции, эффекты над головой, бросок/ловля и прыжки
EMO_SCORE = {"laugh": 3.0, "surprised": 2.0}
FX_SCORE = {"hearts": 3.0, "sparkles": 2.0}
ACTION_SCORE = {"throw": 3.0, "catch": 3.0, "spin": 1.0, "jump": 1.0, "hop": 1.0, "dance": 1.0}
FUNNY_TITLES = {
    "hearts": "Aww, so sweet!",
    "throw": "Throw and catch!",
    "catch": "Throw and catch!",
    "laugh": "Ha-ha! So silly!",
    "surprised": "Whoa! Surprise!",
    "sparkles": "Wow! So magical!",
}


def _abs(sc: dict[str, Any], t: float) -> float:
    return float(sc.get("start", 0.0)) + float(t)


def _end(sc: dict[str, Any]) -> float:
    return float(sc.get("start", 0.0)) + float(sc.get("duration", 0.0))


def _name(char: str) -> str:
    return char.replace("_", " ").title() if char else "Benny"


def _blocks(scenes: list[dict[str, Any]], kinds: set[Any]) -> list[tuple[int, int]]:
    """Подряд идущие сцены нужного вида: [(i0, i1)] включительно."""
    out: list[tuple[int, int]] = []
    i = 0
    while i < len(scenes):
        if scenes[i].get("kind") in kinds:
            j = i
            while j + 1 < len(scenes) and scenes[j + 1].get("kind") in kinds:
                j += 1
            out.append((i, j))
            i = j + 1
        else:
            i += 1
    return out


def cut_points(scenes: list[dict[str, Any]]) -> list[float]:
    """Где можно резать: края сцен, паузы между репликами, края строк караоке. Не внутри реплики, строки песни или паузы-вопроса."""
    cuts: set[float] = set()
    busy: list[tuple[float, float]] = []  # абсолютные интервалы, внутри которых резать нельзя
    for sc in scenes:
        cuts.update({round(_abs(sc, 0), 3), round(_end(sc), 3)})
        lines = sorted(sc.get("lines") or [], key=lambda x: float(x["start"]))
        for a, b in zip(lines, lines[1:], strict=False):
            ae = float(a["start"]) + float(a["dur"])
            gap = float(b["start"]) - ae
            if gap >= 0.2:
                cuts.add(round(_abs(sc, ae + min(0.35, gap / 2)), 3))
        if lines:
            last = lines[-1]
            le = float(last["start"]) + float(last["dur"])
            if _abs(sc, le + 0.4) < _end(sc):
                cuts.add(round(_abs(sc, le + 0.4), 3))
        for ln in lines:
            busy.append((_abs(sc, float(ln["start"])), _abs(sc, float(ln["start"]) + float(ln["dur"]))))
        for o in sc.get("overlays") or []:
            if o.get("kind") in ("lyric", "question"):
                t0, t1 = _abs(sc, float(o["t"])), _abs(sc, float(o["t"]) + float(o["dur"]))
                busy.append((t0, t1))
                if o.get("kind") == "lyric":
                    cuts.update({round(t0, 3), round(min(_end(sc), t1 + 0.05), 3)})
    return sorted(c for c in cuts if not any(b0 + 0.02 < c < b1 - 0.02 for b0, b1 in busy))


EDGE_TAIL = 2.5  # шортс не начинается последними секундами сцены и не кончается первыми секундами следующей


def _overlaps(w: tuple[float, float], used: list[tuple[float, float]] | tuple[()] = ()) -> bool:
    return any(w[0] < u1 - 0.25 and u0 + 0.25 < w[1] for u0, u1 in used)


def fit_window(cuts: list[float], a0: float, a1: float, pre: float = 1.5, post: float = 0.8, lo: float = MIN_S, hi: float = MAX_S,
               edges: list[float] | tuple[()] = (), used: list[tuple[float, float]] | tuple[()] = ()) -> tuple[float, float] | None:
    """Окно по точкам резки, содержащее якорь [a0, a1] (с запасом pre/post), длиной lo..hi; расширяется вперёд, потом назад.
    edges — стыки сцен внутри блока (начало окна не берёт хвост прошлой сцены, конец — огрызок следующей);
    used — уже занятые окна (не пересекаемся)."""
    starts = [c for c in cuts if not any(e - EDGE_TAIL < c < e - 1e-6 for e in edges)]
    ends = [c for c in cuts if not any(e + 1e-6 < c < e + EDGE_TAIL for e in edges)]
    if not starts or not ends:
        return None
    before = [c for c in starts if c <= a0 - pre + 1e-6] or [c for c in starts if c <= a0 + 1e-6] or [starts[0]]
    after = [c for c in ends if c >= a1 + post - 1e-6] or [c for c in ends if c >= a1 - 1e-6] or [ends[-1]]
    fr, to = max(before), min(after)
    # якорь недалеко от стыка сцен — режем ровно по стыку: шортс начинается/кончается вместе со сценой
    near_start = [e for e in edges if a0 - pre - 4.0 <= e <= a0 + 1e-6]
    near_end = [e for e in edges if a1 - 1e-6 <= e <= a1 + post + 4.0]
    fr = max(near_start) if near_start else fr
    to = min(near_end) if near_end else to
    if to <= fr or _overlaps((fr, to), used):
        return None
    while to - fr < lo:
        nxt = [c for c in ends if c > to + 1e-6 and c - fr <= hi and not _overlaps((fr, c), used)]
        prv = [c for c in starts if c < fr - 1e-6 and to - c <= hi and not _overlaps((c, to), used)]
        if to - fr >= FALLBACK_MIN_S:  # хвост прошлой сцены в начале шортса — только если иначе совсем коротко
            prv = [c for c in prv if not any(c < e <= fr + 1e-6 for e in edges)]
        if not nxt and not prv:
            break
        # вперёд — история продолжается; назад — если вперёд нельзя или шаг вперёд сильно длиннее
        if nxt and not (prv and min(nxt) - to > 2.5 * (fr - max(prv))):
            to = min(nxt)
        else:
            fr = max(prv)
    if to - fr > hi:
        inside = [c for c in ends if fr + 1e-6 < c <= fr + hi + 1e-6]
        good = [c for c in inside if c >= a1 - 1e-6]
        if not inside:
            return None
        to = max(good or inside)
    if to - fr < min(lo, FALLBACK_MIN_S):
        return None
    return round(fr, 3), round(to, 3)


def _block_cuts(scenes: list[dict[str, Any]], i0: int, i1: int) -> tuple[list[float], list[float]]:
    """Точки резки блока сцен и стыки сцен внутри него."""
    return cut_points(scenes[i0:i1 + 1]), [round(_abs(sc, 0), 3) for sc in scenes[i0 + 1:i1 + 1]]


def _block_of(blocks: list[tuple[int, int]], i: int) -> tuple[int, int] | None:
    return next((b for b in blocks if b[0] <= i <= b[1]), None)


def song_moment(scenes: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Припев первой песни: с начала песни (титр «Sing along!» + вступление), если припев идёт сразу, иначе с первой строки припева."""
    for sc in scenes:
        if sc.get("kind") != "song":
            continue
        lyr = sorted((o for o in sc.get("overlays") or [] if o.get("kind") == "lyric"), key=lambda o: float(o["t"]))
        if not lyr:
            continue
        count = Counter(str(o["text"]).strip().lower() for o in lyr)
        chorus = {k for k, n in count.items() if n >= 2} or set(count)
        i0 = next(i for i, o in enumerate(lyr) if str(o["text"]).strip().lower() in chorus)
        i1 = i0
        while i1 + 1 < len(lyr) and str(lyr[i1 + 1]["text"]).strip().lower() in chorus:
            i1 += 1
        a0 = _abs(sc, float(lyr[i0]["t"]))
        if a0 - _abs(sc, 0) < 7.0:
            a0 = _abs(sc, 0)
        a1 = _abs(sc, float(lyr[i1]["t"]) + float(lyr[i1]["dur"]))
        w = fit_window(cut_points([sc]), a0, a1, pre=0.0, post=0.0)
        if not w:
            continue
        name = next((str(o.get("text", "")).strip() for o in sc.get("overlays") or [] if o.get("kind") == "title"), "")
        title = f"Sing along: {name}" if name and len(name) <= 24 else "Sing along!"
        return {"kind": "song", "from": w[0], "to": w[1], "title": title}
    return None


def _question_title(text: str) -> str:
    qs = [q.strip() for q in re.findall(r"[^.!?]*\?", text) if q.strip()]
    qs = [q for q in qs if len(q) <= 38]
    return min(qs, key=len) if qs else "Can you answer?"


def question_moment(scenes: list[dict[str, Any]], used: list[tuple[float, float]]) -> dict[str, Any] | None:
    """Вопрос зрителю: подводка → вопрос → пауза на ответ ребёнка → ответ героя."""
    blocks = _blocks(scenes, STORY_KINDS)
    best: tuple[float, dict[str, Any]] | None = None
    n = 0
    for i, sc in enumerate(scenes):
        if sc.get("kind") not in STORY_KINDS:
            continue
        lines = sorted(sc.get("lines") or [], key=lambda x: float(x["start"]))
        for q in sc.get("overlays") or []:
            if q.get("kind") != "question":
                continue
            n += 1
            qt, qe = float(q["t"]), float(q["t"]) + float(q["dur"])
            ask = next((ln for ln in reversed(lines) if float(ln["start"]) < qt), None)
            if ask is None:
                continue
            ans = next((ln for ln in lines if qe - 0.5 <= float(ln["start"]) <= qe + 6.0), None)
            a0 = _abs(sc, float(ask["start"]))
            a1 = _abs(sc, float(ans["start"]) + float(ans["dur"])) if ans else _abs(sc, qe)
            blk = _block_of(blocks, i)
            if blk is None:
                continue
            cuts, edges = _block_cuts(scenes, *blk)
            w = fit_window(cuts, a0, a1, pre=4.0, post=0.6, edges=edges, used=used)
            if not w:
                continue
            text = str(ask.get("text", ""))
            score = (2.0 if "?" in text else 0.0) + (1.0 if ans else 0.0) + (1.0 if len(text) <= 60 else 0.0) - n * 0.01
            if best is None or score > best[0]:
                best = (score, {"kind": "question", "from": w[0], "to": w[1], "title": _question_title(text)})
    return best[1] if best else None


def _funny_events(scenes: list[dict[str, Any]]) -> list[tuple[float, float, str, int]]:
    """(время, вес, вид, индекс сцены) — смешные и милые события в историях."""
    ev: list[tuple[float, float, str, int]] = []
    for i, sc in enumerate(scenes):
        if sc.get("kind") not in STORY_KINDS:
            continue
        for a in sc.get("actors") or []:
            for k in a.get("keys") or []:
                t = float(k.get("t", 0))
                if t < 0.3 or t > float(sc.get("duration", 0)) - 0.5:
                    continue  # начальное состояние сцены — не событие
                if k.get("emotion") in EMO_SCORE:
                    ev.append((_abs(sc, t), EMO_SCORE[k["emotion"]], str(k["emotion"]), i))
                if k.get("fx") in FX_SCORE:
                    ev.append((_abs(sc, t), FX_SCORE[k["fx"]], str(k["fx"]), i))
                if k.get("action") in ACTION_SCORE:
                    ev.append((_abs(sc, t), ACTION_SCORE[k["action"]], str(k["action"]), i))
        for it in sc.get("items") or []:
            for k in it.get("keys") or []:
                if k.get("anim") == "throw":
                    ev.append((_abs(sc, float(k.get("t", 0))), 3.0, "throw", i))
    return sorted(ev)


def funny_moment(scenes: list[dict[str, Any]], used: list[tuple[float, float]]) -> dict[str, Any] | None:
    """Самый «плотный» по смеху/милоте участок историй (сумма весов событий в окне ~16 с вокруг пика)."""
    ev = _funny_events(scenes)
    blocks = _blocks(scenes, STORY_KINDS)
    ranked = sorted(
        ((sum(w for t2, w, _, j in ev if j == i and t - 6.0 <= t2 <= t + 10.0), t, i) for t, _, _, i in ev),
        key=lambda x: (-x[0], x[1]),
    )
    for _, t, i in ranked:
        blk = _block_of(blocks, i)
        if blk is None:
            continue
        cuts, edges = _block_cuts(scenes, *blk)
        w = fit_window(cuts, t - 3.0, t + 4.0, pre=0.0, post=0.0, edges=edges, used=used)
        if not w:
            continue
        near: Counter[str] = Counter()
        for t2, wt, kind, _ in ev:
            if w[0] <= t2 <= w[1] and kind in FUNNY_TITLES:
                near[kind] += wt
        title = FUNNY_TITLES[near.most_common(1)[0][0]] if near else "So much fun!"
        return {"kind": "funny", "from": w[0], "to": w[1], "title": title}
    return None


def pick_moments(doc: dict[str, Any]) -> list[dict[str, Any]]:
    """2-3 момента для шортсов: [{kind: song|funny|question, from, to, title}] — по порядку song, funny, question."""
    scenes = sorted(doc.get("scenes") or [], key=lambda s: float(s.get("start", 0)))
    used: list[tuple[float, float]] = []
    song = song_moment(scenes)
    if song:
        used.append((song["from"], song["to"]))
    question = question_moment(scenes, used)
    if question:
        used.append((question["from"], question["to"]))
    funny = funny_moment(scenes, used)
    out = [m for m in (song, funny, question) if m]
    if funny and len(out) < 3:  # нет песни или вопроса — второй смешной момент
        used.append((funny["from"], funny["to"]))
        more = funny_moment(scenes, used)
        if more:
            out.append(more)
    return out[:3]


def clip_doc(doc: dict[str, Any], fr: float, to: float) -> dict[str, Any]:
    """Для рендера шортса нужны только сцены около окна (запрос к рендереру ограничен 5 МБ, а у 20-минутного эпизода огибающие тяжёлые)."""
    scenes = [sc for sc in doc.get("scenes") or [] if float(sc.get("start", 0)) < to + 1.0 and _end(sc) > fr - 1.0]
    return {**doc, "scenes": scenes}


def short_meta(doc: dict[str, Any], m: dict[str, Any]) -> dict[str, Any]:
    """Тексты для загрузки: детский контент (made for kids), без призывов подписаться."""
    ep = str(doc.get("title") or "Benny & Friends")
    title = f"{m['title']} | Benny & Friends #shorts"[:100]
    desc = (f"A little moment from “{ep}” — Benny & Friends, gentle cartoons and songs for kids 2-5 in English.\n\n"
            "#shorts #kidscartoon #nurseryrhymes #toddlers #learnenglish")
    return {"title": title, "description": desc, "made_for_kids": True}


# ------------------------------------------------------------------ рендер
async def render_shorts(pid: str) -> None:
    """Рендер всех шортсов проекта по очереди (meta["shorts"]["items"] уже заполнен эндпоинтом)."""
    from ..config import get_settings
    from ..db import SessionLocal
    from ..events import publish
    from ..models import Project

    st = get_settings()

    async def update(n: int | None, **fields: Any) -> dict[str, Any] | None:
        async with SessionLocal() as s:
            p = await s.get(Project, pid)
            if p is None:
                return None
            meta = dict(p.meta or {})
            sh = dict(meta.get("shorts") or {})
            items = [dict(x) for x in sh.get("items") or []]
            if n is None:
                sh |= fields
            elif n < len(items):
                items[n] |= fields
            sh["items"] = items
            meta["shorts"] = sh
            p.meta = meta
            doc = dict(p.doc or {})
            await s.commit()
        await publish({"type": "project", "project_id": pid})
        return {"doc": doc, "shorts": sh}

    cur = await update(None, status="rendering")
    if cur is None:
        return
    doc, items = cur["doc"], cur["shorts"].get("items") or []
    failed = 0
    try:
        await _render_items(pid, doc, items, update, st)
    finally:
        fresh = await update(None)
        its = (fresh or {}).get("shorts", {}).get("items") or []
        failed = sum(1 for x in its if x.get("status") != "ready")
        await update(None, status="failed" if its and failed == len(its) else "ready")


async def _render_items(pid: str, doc: dict[str, Any], items: list[dict[str, Any]], update: Any, st: Any) -> None:
    from . import clients

    for n, it in enumerate(items):
        rel = f"/projects/{pid}/shorts/{n + 1}"
        (st.data_dir / rel.lstrip("/")).mkdir(parents=True, exist_ok=True)

        async def on_progress(x: float, n: int = n) -> None:
            await update(n, progress=round(x, 3))

        try:
            await update(n, status="rendering", progress=0.0, error=None)
            props = {"doc": clip_doc(doc, it["from"], it["to"]), "from": it["from"], "to": it["to"], "title": it.get("title") or ""}
            await clients.render(props, rel, on_progress, composition="CartoonShort", timeout_s=int(max(600, (it["to"] - it["from"]) * 20)))
            v = int(time.time())  # повторный рендер в ту же папку — новый адрес, браузер не покажет старое видео
            await update(n, status="ready", progress=1.0, video_url=f"/media{rel}/video.mp4?v={v}",
                         cover_url=f"/media{rel}/cover.png?v={v}")
        except Exception as e:  # noqa: BLE001 — ошибка видна у шортса, остальные рендерятся дальше
            await update(n, status="failed", error=(str(e) or type(e).__name__)[:500])
