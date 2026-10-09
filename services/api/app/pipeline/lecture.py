"""Длинная лекция 16:9 (15-20 мин): LLM план → главы → проверка → озвучка по предложениям → проект-таймлайн."""

from __future__ import annotations

import asyncio
import json
import random
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from ..checks import languagetool_check
from ..config import get_settings
from ..db import SessionLocal
from ..events import publish
from ..llm.generate import SYSTEM_TEACHER, SYSTEM_VERIFIER, get_provider, normalize_body
from ..llm.providers import LLMError
from ..models import Asset, Project, Series
from . import clients
from .audio import SR, envelope, load_mono, trim_silence, write_wav
from .music import TRACKS

LANG_NAME = {"en": "inglese"}  # канал учит итальянскому на английском: второй язык только en
ASR_OK = 0.8  # совпадение слов текста и распознанного Whisper; ниже — переозвучиваем
WPM = 140  # замер: лекция 1446 слов = 10:03 вместе с паузами, титулами и квизами (~144 сл/мин)
UNDERSHOOT = 1.1  # LLM пишет ~90% от запрошенного числа слов
GAP_SENT, GAP_SLIDE, GAP_CHAPTER = 0.35, 0.9, 0.7
QUIZ_TIMER = 5.0

OUTLINE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Titolo del video, ≤ 60 caratteri"},
        "subtitle": {"type": "string"},
        "intro": {"type": "array", "items": {"$ref": "#/$defs/Sent"}, "description": "3-5 frasi di benvenuto e cosa impareremo"},
        "chapters": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string", "description": "Titolo del capitolo in italiano"},
            "title_en": {"type": "string", "description": "Lo stesso titolo in inglese (per i capitoli di YouTube)"},
            "goal": {"type": "string"}}}},
        "outro": {"type": "array", "items": {"$ref": "#/$defs/Sent"}, "description": "3-4 frasi finali: ripasso veloce, invito a commentare e iscriversi"},
    },
    "$defs": {"Sent": {"type": "object", "properties": {"it": {"type": "string", "description": "Testo detto dalla voce"}, "lang": {"type": "string", "enum": ["it", "en"]},
                                                         "tr": {"type": "string", "description": "Traduzione inglese se lang=it, vuoto se lang=en"}}}},
}

SLIDE = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["explain", "examples", "table", "quiz", "recap"]},
        "title": {"type": "string"},
        "bullets": {"type": "array", "items": {"type": "string"}},
        "rows": {"type": "array", "items": {"type": "object", "properties": {"it": {"type": "string"}, "tr": {"type": "string"}, "note": {"type": "string"}}}},
        "table_header": {"type": "array", "items": {"type": "string"}},
        "table_rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}},
        "quiz_question": {"type": "string"},
        "quiz_options": {"type": "array", "items": {"type": "string"}},
        "quiz_correct": {"type": "integer"},
        "narration": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "it": {"type": "string", "description": "Frase detta dalla voce (nella lingua lang)"},
                    "lang": {"type": "string", "enum": ["it", "en"], "description": "Lingua della frase: it = italiano, en = spiegazione in inglese"},
                    "tr": {"type": "string", "description": "Traduzione inglese per i sottotitoli se lang=it; vuoto se lang=en"},
                    "mark": {"type": "integer", "description": "Indice del punto/riga che questa frase mette in evidenza (-1 nessuno)"},
                    "phase": {"type": "string", "enum": ["normal", "ask", "answer"]},
                },
            },
        },
    },
}
CHAPTER_SCHEMA: dict[str, Any] = {"type": "object", "properties": {"slides": {"type": "array", "items": SLIDE}}}
VERIFY_CH_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "issues": {"type": "array", "items": {"type": "object", "properties": {"where": {"type": "string"}, "message": {"type": "string"}}}},
        "fixed_chapter_json": {"type": "string", "description": "Il capitolo corretto (stessa struttura) come JSON, vuoto se tutto ok"},
    },
}


# Сколько английского у преподавателя: новичкам объясняем по-английски, дальше — всё больше итальянского.
VOICE_POLICY = {
    "A1": "L'insegnante SPIEGA IN INGLESE (lang=en) regole e istruzioni, frasi brevi e amichevoli; tutti gli esempi, le parole nuove e le frasi da ripetere sono in ITALIANO (lang=it), "
          "lenti e chiari, spesso con «Ripeti con me» / «Repeat after me». Circa 55% delle frasi in inglese, 45% in italiano.",
    "A2": "Spiegazioni soprattutto in inglese (lang=en), ma saluti, istruzioni semplici e tutti gli esempi in italiano (lang=it). Circa 40% inglese, 60% italiano.",
    "B1": "L'insegnante parla soprattutto in italiano semplice (lang=it); usa l'inglese (lang=en) solo per chiarire un punto difficile o una differenza con l'inglese. Circa 15% inglese.",
    "B2": "Solo italiano (lang=it), chiaro e naturale; niente frasi in inglese (i sottotitoli traducono).",
    "C1": "Solo italiano (lang=it), naturale e ricco; niente frasi in inglese (i sottotitoli traducono).",
}


def chapter_guide(level: str, lang: str, words: int, n_chapters: int) -> str:
    sentences = max(10, round(words / 13))
    return (
        f"Lezione video YouTube 16:9 per studenti ANGLOFONI di livello {level} (canale per chi parla inglese e impara l'italiano).\n"
        f"Lingua della voce: {VOICE_POLICY.get(level, VOICE_POLICY['A2'])}\n"
        "Ogni frase narrata ha lang = it oppure en, e una frase è in UNA sola lingua: non mescolare. Se una spiegazione inglese introduce una parola italiana, "
        "dividi in due frasi: «In Italian, cat is…» (en) e poi «il gatto» (it). tr = traduzione inglese solo per le frasi italiane, vuoto per quelle inglesi.\n"
        "Testi delle slide (titoli, punti, esempi) in italiano; note e traduzioni sulle slide (rows.tr, note) in inglese. Mai russo o altre lingue.\n"
        f"Questo capitolo deve durare circa {round(words / WPM, 1)} minuti: circa {words} parole di narrazione, cioè ~{sentences} frasi in totale, divise in 3-5 slide.\n"
        "Tipi di slide: explain (3-5 punti brevi in bullets), examples (4-8 righe rows: it + tr + note facoltativa), table (coniugazioni, articoli: table_header + table_rows), "
        "quiz (una domanda con ESATTAMENTE 3 quiz_options e quiz_correct 0-2: frasi phase=ask che leggono la domanda, poi phase=answer che spiegano la risposta), "
        "recap (riepilogo in bullets, di solito l'ultima slide del capitolo).\n"
        "Narrazione: frasi brevi (≤ 22 parole), naturali, come un insegnante simpatico; ripeti gli esempi con la voce. "
        "mark = indice del punto/riga che la frase introduce (la slide lo evidenzia in quel momento), -1 se nessuno; ogni punto/riga deve avere almeno una frase con il suo mark, in ordine.\n"
        "Il saluto e la presentazione ci sono SOLO nell'intro del video: nei capitoli non salutare e non dire «benvenuti», entra subito nell'argomento.\n"
        f"Il video ha {n_chapters} capitoli: non ripetere i contenuti degli altri capitoli. Niente emoji nel testo parlato. Italiano corretto al 100%."
    )


@dataclass
class Sent:
    it: str  # произносимый текст (исторически «it»; язык — в lang)
    tr: str
    mark: int = -1
    lang: str = "it"
    phase: str = "normal"
    key: str = ""
    clip: np.ndarray | None = None
    start: float = 0.0
    end: float = 0.0


@dataclass
class SlideBuild:
    props: dict[str, Any]
    sents: list[Sent] = field(default_factory=list)
    gap_after: float = GAP_SLIDE
    start: float = 0.0
    end: float = 0.0


def _sents(items: list[dict[str, Any]]) -> list[Sent]:
    out = []
    for x in items or []:
        it = str(x.get("it", "")).strip()
        if it:
            out.append(
                Sent(
                    it=it,
                    tr="" if x.get("lang") == "en" else str(x.get("tr", "")).strip(),
                    mark=int(x.get("mark", -1) if x.get("mark") is not None else -1),
                    phase=str(x.get("phase") or "normal"),
                    lang="en" if x.get("lang") == "en" else "it",
                )
            )
    return out


def slide_from_llm(s: dict[str, Any], chapter_label: str) -> SlideBuild:
    kind = s.get("kind", "explain")
    props: dict[str, Any] = {"kind": kind, "chapter": chapter_label, "title": str(s.get("title", ""))[:90]}
    if kind in ("explain", "recap"):
        props["bullets"] = [str(b)[:120] for b in (s.get("bullets") or [])][:6]
    elif kind == "examples":
        props["rows"] = [
            {"it": str(r.get("it", ""))[:60], "tr": str(r.get("tr", ""))[:60], **({"note": str(r["note"])[:70]} if r.get("note") else {})}
            for r in (s.get("rows") or [])
        ][:8]
    elif kind == "table":
        props["table"] = {
            "header": [str(h)[:30] for h in (s.get("table_header") or [])][:4],
            "rows": [[str(c)[:30] for c in r][:4] for r in (s.get("table_rows") or [])][:8],
        }
    elif kind == "quiz":
        opts = [str(o)[:40] for o in (s.get("quiz_options") or [])][:3]
        props["quiz"] = {
            "question": str(s.get("quiz_question", ""))[:120],
            "options": opts,
            "correct": max(0, min(int(s.get("quiz_correct", 0) or 0), max(len(opts) - 1, 0))),
            "timer_s": QUIZ_TIMER,
        }
    return SlideBuild(props=props, sents=_sents(s.get("narration") or []))


# ---------------------------------------------------------------- LLM
async def llm_outline(s: AsyncSession, topic: str, level: str, minutes: int, lang: str) -> dict[str, Any]:
    prov = await get_provider(s)
    n = max(4, min(10, round(minutes / 2.2)))
    user = (
        f"Prepara la scaletta di una video-lezione di {minutes} minuti per il canale @ItalianoPerTe. Argomento: «{topic}». Livello {level}.\n"
        f"Esattamente {n} capitoli, dal più semplice al più difficile, ognuno con un obiettivo concreto. Pubblico: anglofoni che imparano l'italiano. Intro/outro: {VOICE_POLICY.get(level, VOICE_POLICY['A2'])} Ogni frase ha lang (it/en); tr = traduzione inglese delle frasi italiane, vuoto per quelle inglesi. Il saluto iniziale sempre in italiano («Ciao a tutti!»)."
    )
    r = await prov.complete_json(SYSTEM_TEACHER, user, OUTLINE_SCHEMA, purpose="lecture_outline", max_tokens=6000, effort="medium")
    return dict(r.data)


async def llm_chapter(s: AsyncSession, outline: dict[str, Any], idx: int, level: str, lang: str, words: int) -> dict[str, Any]:
    prov = await get_provider(s)
    chs = outline.get("chapters", [])
    ch = chs[idx]
    user = (
        chapter_guide(level, lang, words, len(chs))
        + f"\n\nLezione: «{outline.get('title')}». Scaletta: {json.dumps([c.get('title') for c in chs], ensure_ascii=False)}.\n"
        f"Scrivi ora il capitolo {idx + 1}: «{ch.get('title')}» — obiettivo: {ch.get('goal')}."
    )
    r = await prov.complete_json(SYSTEM_TEACHER, user, CHAPTER_SCHEMA, purpose="lecture_chapter", max_tokens=16000, effort="medium")
    return dict(r.data)


def chapter_words(ch: dict[str, Any]) -> int:
    return sum(len(str(n.get("it", "")).split()) for sl in ch.get("slides", []) for n in sl.get("narration") or [])


async def llm_expand_chapter(s: AsyncSession, outline: dict[str, Any], idx: int, level: str, lang: str, words: int, ch: dict[str, Any], have: int) -> dict[str, Any]:
    prov = await get_provider(s)
    chs = outline.get("chapters", [])
    user = (
        chapter_guide(level, lang, words, len(chs))
        + f"\n\nQuesto è il capitolo {idx + 1} «{chs[idx].get('title')}», ma è troppo corto: {have} parole di narrazione invece di circa {words}.\n"
        "Riscrivilo più lungo e più ricco, stesso stile e stesse regole: più esempi spiegati, una slide di pratica in più "
        "(examples o quiz), frasi «Ripeti con me» per gli esempi. Mantieni le slide buone che ci sono già.\n"
        + json.dumps(ch, ensure_ascii=False)
    )
    r = await prov.complete_json(SYSTEM_TEACHER, user, CHAPTER_SCHEMA, purpose="lecture_chapter", max_tokens=16000, effort="medium")
    out = dict(r.data)
    return out if chapter_words(out) > have else ch


async def llm_verify_chapter(s: AsyncSession, chapter: dict[str, Any], level: str) -> tuple[dict[str, Any], list[dict[str, str]]]:
    prov = await get_provider(s)
    user = (
        f"Capitolo di una video-lezione (livello {level}) in JSON. Controlla l'italiano di slide e narrazione (campo it): grammatica, accenti, apostrofi, "
        "correttezza di traduzioni ed esempi, coniugazioni. Le frasi con lang=en sono in inglese DI PROPOSITO (spiegazioni per anglofoni): non tradurle, "
        "controlla solo che siano in inglese corretto e che le parole italiane citate siano giuste. Non cambiare la struttura né il numero di elementi; correggi solo gli errori.\n"
        + json.dumps(chapter, ensure_ascii=False)
    )
    r = await prov.complete_json(SYSTEM_VERIFIER, user, VERIFY_CH_SCHEMA, purpose="lecture_verify", max_tokens=16000, effort="high")
    issues = [{"where": str(i.get("where", "")), "message": str(i.get("message", ""))} for i in r.data.get("issues", [])]
    fixed = chapter
    raw = r.data.get("fixed_chapter_json") or ""
    if raw.strip():
        try:
            cand = json.loads(raw)
            if isinstance(cand, dict) and len(cand.get("slides", [])) == len(chapter.get("slides", [])):
                fixed = normalize_body(cand)
        except json.JSONDecodeError:
            pass
    return fixed, issues


# ---------------------------------------------------------------- сборка
def _mmss(t: float) -> str:
    t = int(t)
    return f"{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60:02d}:{t % 60:02d}"


def _word_times(text: str, dur: float) -> list[list[float]]:
    """Оценка пословного тайминга по длине слов (для караоке-субтитров)."""
    words = text.split()
    total = sum(len(w) + 1 for w in words) or 1
    t, out = 0.0, []
    for w in words:
        d = dur * (len(w) + 1) / total
        out.append([round(t, 3), round(d, 3)])
        t += d
    return out


async def build_lecture(project_id: str) -> None:
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
            params = dict(pr.params)
            series = await s.get(Series, pr.series_id) if pr.series_id else None
            topic, level, minutes = params["topic"], params.get("level", "A2"), int(params.get("minutes", 15))
            lang = params.get("lang") or "en"
            await progress("план", 0.02)
            outline = await llm_outline(s, topic, level, minutes, lang)
        chapters = outline.get("chapters", [])
        words_per = int(minutes * WPM * UNDERSHOOT / max(len(chapters), 1))
        built: list[dict[str, Any]] = []
        report: list[dict[str, str]] = []
        for i in range(len(chapters)):
            await progress(f"глава {i + 1}/{len(chapters)}", 0.05 + 0.45 * i / len(chapters))
            async with SessionLocal() as s:
                ch = await llm_chapter(s, outline, i, level, lang, words_per)
                have = chapter_words(ch)
                if have < 0.75 * words_per:
                    # модель часто пишет короче (особенно с короткими английскими фразами) — просим расширить, а не обрезаем лекцию
                    await progress(f"глава {i + 1}/{len(chapters)}: дописываю", 0.05 + 0.45 * (i + 0.5) / len(chapters))
                    ch = await llm_expand_chapter(s, outline, i, level, lang, words_per, ch, have)
                ch, issues = await llm_verify_chapter(s, ch, level)
            report += [{"chapter": str(i + 1), **x} for x in issues]
            built.append(ch)

        # ---- раскладка: слайды и фразы
        slides: list[SlideBuild] = [
            SlideBuild(
                props={
                    "kind": "title",
                    "chapter": f"Livello {level}",
                    "title": outline.get("title", topic)[:90],
                    "subtitle": outline.get("subtitle", "")[:120],
                },
                sents=_sents(outline.get("intro", [])),
                gap_after=GAP_CHAPTER,
            )
        ]
        for i, (c, ch) in enumerate(zip(chapters, built, strict=False)):
            label = f"Capitolo {i + 1}"
            slides.append(
                SlideBuild(
                    props={"kind": "title", "chapter": label, "title": str(c.get("title", ""))[:90], "subtitle": str(c.get("title_en", ""))[:120],
                           "title_en": str(c.get("title_en", ""))[:90]},
                    sents=[Sent(it=f"Capitolo {i + 1}: {c.get('title', '')}.", tr=f"Chapter {i + 1}: {c.get('title_en', '')}".rstrip(": "))],
                    gap_after=GAP_CHAPTER,
                )
            )
            slides += [slide_from_llm(sl, label) for sl in ch.get("slides", []) if sl.get("narration")]
        outro = _sents(outline.get("outro", []))
        slides.append(
            SlideBuild(
                props={"kind": "recap", "chapter": "Ripasso", "title": "Grazie e alla prossima!", "bullets": [str(c.get("title", "")) for c in chapters][:6]},
                sents=outro,
            )
        )

        # ---- LanguageTool по всей речи (отчёт; правки уже сделал верификатор)
        all_sents = [x for sl in slides for x in sl.sents]
        lt = await languagetool_check([(f"s{k}", x.it) for k, x in enumerate(all_sents) if x.lang == "it"])
        lt_errors = [i for i in lt if i["severity"] == "error"]

        # ---- озвучка по предложениям
        async with SessionLocal() as s:
            from .produce import default_voice, voice_config

            vcfg = voice_config(params.get("voice"), series.voice if series else None, await default_voice(s))
        sem = asyncio.Semaphore(4)
        done = 0

        asr: dict[str, Any] = {"checked": 0, "redone": 0, "still_bad": [], "available": True}

        async def synth(x: Sent) -> None:
            nonlocal done
            async with sem:
                best: tuple[float, dict[str, Any], str] | None = None
                # проверка произношения (Whisper): плохая фраза переозвучивается другим дублем, берём лучший
                for variant in range(3):
                    r = await clients.tts_synthesize(
                        x.it, vcfg["model"], vcfg.get("voice"), float(vcfg.get("speed", 0.92)), variant, vcfg.get("ref_audio"), vcfg.get("ref_text"),
                        vcfg.get("design"), language=x.lang,
                    )
                    heard = await clients.tts_transcribe(r["path"], x.lang) if asr["available"] else None
                    if heard is None:
                        asr["available"] = False
                        best = (1.0, r, "")
                        break
                    score = clients.speech_match(x.it, heard, x.lang)
                    asr["checked"] += variant == 0
                    asr["redone"] += variant > 0
                    if best is None or score > best[0]:
                        best = (score, r, heard)
                    if score >= ASR_OK:
                        break
                assert best is not None
                if best[0] < ASR_OK:
                    asr["still_bad"].append({"text": x.it, "heard": best[2], "lang": x.lang, "score": round(best[0], 2)})
                x.clip = trim_silence(load_mono(st.data_dir / best[1]["path"].lstrip("/")))
                done += 1
                if done % 10 == 0:
                    await progress("озвучка", 0.5 + 0.35 * done / len(all_sents))

        await progress("озвучка", 0.5)
        await asyncio.gather(*(synth(x) for x in all_sents))

        # ---- таймлайн
        t = 0.6
        for sl in slides:
            sl.start = t
            asked = False
            for x in sl.sents:
                if sl.props["kind"] == "quiz" and x.phase == "answer" and not asked:
                    sl.props["countdown_at"] = round(t - sl.start, 3)
                    t += QUIZ_TIMER  # пауза на раздумье (тикает таймер)
                    sl.props["reveal_at"] = round(t - sl.start, 3)
                    asked = True
                dur = len(x.clip) / SR if x.clip is not None else 0.8
                x.start, x.end = t, t + dur
                t += dur + GAP_SENT
            if sl.props["kind"] == "quiz" and not asked:
                sl.props["countdown_at"] = round(t - sl.start, 3)
                t += QUIZ_TIMER
                sl.props["reveal_at"] = round(t - sl.start, 3)
                t += 1.5
            # отметки: когда подсвечивается i-й пункт
            n_items = len(sl.props.get("bullets") or sl.props.get("rows") or (sl.props.get("table") or {}).get("rows") or [])
            if n_items:
                marks: list[float | None] = [None] * n_items
                for x in sl.sents:
                    if 0 <= x.mark < n_items and marks[x.mark] is None:
                        marks[x.mark] = round(x.start - sl.start, 3)
                last = 0.0
                filled: list[float] = []
                for m in marks:  # пропущенные — вместе с предыдущим, монотонно
                    last = max(last, m) if m is not None else last
                    filled.append(last)
                sl.props["marks"] = filled
            t += sl.gap_after - GAP_SENT
            sl.end = t
        total = round(t + 1.0, 3)

        buf = np.zeros(int(np.ceil(total * SR)) + 1, np.float32)
        for x in all_sents:
            if x.clip is not None and len(x.clip):
                a = int(round(x.start * SR))
                buf[a : a + len(x.clip)] += x.clip[: max(len(buf) - a, 0)]
        peak = float(np.abs(buf).max()) or 1.0
        buf = (buf / peak * 0.89).astype(np.float32)
        out_dir = st.data_dir / "projects" / project_id
        voice_path = out_dir / "voice.wav"
        write_wav(voice_path, buf)
        await progress("сборка таймлайна", 0.9)

        mascot = params.get("mascot") or "pizza"
        aspect = params.get("aspect", "16:9")
        land = aspect == "16:9"
        rng = random.Random(project_id)
        async with SessionLocal() as s:
            from sqlalchemy import select

            pal_rows = (await s.scalars(select(Asset).where(Asset.kind == "palette", Asset.name.in_(["notte", "blu", "oliva", "terracotta"])))).all()
            palette = dict(rng.choice(pal_rows).data) if pal_rows else None
        track = rng.choice(TRACKS)
        doc: dict[str, Any] = {
            "version": 1,
            "title": outline.get("title", topic)[:200],
            "canvas": {"w": 1920, "h": 1080, "fps": 30} if land else {"w": 1080, "h": 1920, "fps": 30},
            "duration_s": total,
            "background": "#1B1035",
            "palette": palette or {},
            "font": "Montserrat",
            "subtitle_style": {"size": 44, "y": 0.9 if land else 0.8, "show_translation": True, "highlight_words": True,
                               # 16:9: справа ведущий-маскот — субтитры в левой части кадра
                               **({"x": 0.36, "max_w": 0.66} if land else {})},
            "envelope": envelope(buf),
            "asset_base": "",
            "seed": rng.randrange(1, 2**31 - 1),
            "tracks": [
                {
                    "id": "scenes",
                    "kind": "scene",
                    "name": "Слайды",
                    "clips": [
                        {
                            "id": f"sl{k}",
                            "type": "slide",
                            "start": round(sl.start - (0.6 if k == 0 else 0.25), 3),
                            "duration": round(sl.end - sl.start + (0.6 if k == 0 else 0.25), 3),
                            "anim_in": "fade" if sl.props["kind"] == "title" else "slide_left",
                            "anim_out": "none",
                            "label": sl.props.get("title", "")[:40],
                            "props": sl.props,
                        }
                        for k, sl in enumerate(slides)
                    ],
                },
                {
                    "id": "voice",
                    "kind": "audio",
                    "name": "Голос",
                    "clips": [
                        {
                            "id": "v1",
                            "type": "audio",
                            "start": 0,
                            "duration": total,
                            "label": "Голос",
                            "props": {"src": f"/media/projects/{project_id}/voice.wav", "volume": 1},
                        }
                    ],
                },
                {
                    "id": "music",
                    "kind": "audio",
                    "name": "Музыка",
                    "clips": [
                        {
                            "id": "mu1",
                            "type": "audio",
                            "start": 0,
                            "duration": total,
                            "label": track.name,
                            "props": {"src": f"/media/music/{track.slug}.wav", "volume": 0.07, "loop": True, "fade_in": 2, "fade_out": 3},
                        }
                    ],
                },
                {
                    "id": "mascot",
                    "kind": "mascot",
                    "name": "Маскот",
                    "clips": [
                        {
                            "id": "ma1",
                            "type": "mascot",
                            "start": 0,
                            "duration": total,
                            "label": mascot,
                            "x": 0.71 if land else 0.6,
                            "y": 0.34 if land else 0.66,
                            "w": 0.26 if land else 0.36,
                            "h": 0.6 if land else 0.2,
                            "props": {"character": mascot, "emotion": "auto", "talk": True},
                        }
                    ],
                },
                {
                    "id": "subs",
                    "kind": "subtitle",
                    "name": "Субтитры",
                    "clips": [
                        {
                            "id": f"sub{k}",
                            "type": "subtitle",
                            "start": round(x.start, 3),
                            "duration": round(max(x.end - x.start, 0.4) + 0.15, 3),
                            "label": x.it[:30],
                            "props": {"text": x.it, "tr": x.tr, "words": _word_times(x.it, x.end - x.start)},
                        }
                        for k, x in enumerate(all_sents)
                    ],
                },
            ],
        }
        # главы YouTube: таймкоды в описании
        chapter_marks = ["00:00 Intro"] + [
            f"{_mmss(sl.start)} {sl.props.get('title_en') or sl.props.get('title', '')}" + (f" ({sl.props['title']})" if sl.props.get("title_en") else "")
            for sl in slides
            if sl.props["kind"] == "title" and sl.props.get("chapter", "").startswith("Capitolo")
        ]
        meta = {
            "outline": outline,
            "report": {"llm_fixes": report, "languagetool_errors": lt_errors, "sentences": len(all_sents), "pronunciation": asr},
            "youtube": {
                "title": f"{outline.get('title', topic)[:70]} 🇮🇹 Learn Italian ({level})",
                "description": f"{outline.get('subtitle', '')}\n\nChapters:\n"
                + "\n".join(chapter_marks)
                + "\n\nTell me in the comments what you want to learn next! 👇\n\n#learnitalian #italianlesson #italiano #italianforbeginners",
                "chapters": chapter_marks,
            },
        }
        await progress("готов к редактированию", 1.0, doc=doc, meta=meta, status="draft", title=doc["title"][:200], error=None, revision=1)
    except (LLMError, clients.ServiceError, KeyError, ValueError) as e:
        await progress("ошибка", 0.0, status="failed", error=str(e)[:2000])
    except Exception as e:  # noqa: BLE001 — любой сбой виден в проекте
        await progress("ошибка", 0.0, status="failed", error=f"{type(e).__name__}: {e}"[:2000])
