"""Оркестрация: пачка → ролики → (озвучка → таймлайн → рендер → метаданные)."""
from __future__ import annotations

import copy
import json
import random
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import SessionLocal, utcnow
from ..events import publish, record, set_video, stage
from ..formats import FORMATS, get_format
from ..formats.base import TimingConfig, content_hash
from ..models import AnswerMode, Asset, Batch, Lesson, Series, Video, VideoStatus
from ..schemas_gen.render_props import RenderProps
from . import clients, hooks, metadata, variation
from .audio import SR, Track, assemble, envelope, load_mono, trim_silence, write_wav


# ---------------------------------------------------------------- планирование
async def load_palettes(s: AsyncSession) -> dict[str, dict[str, Any]]:
    rows = (await s.scalars(select(Asset).where(Asset.kind == "palette", Asset.enabled.is_(True)))).all()
    return {r.name: r.data for r in rows}


async def last_palette(s: AsyncSession, series_id: str) -> str | None:
    q = select(Video.palette_name).where(Video.series_id == series_id, Video.palette_name.is_not(None)).order_by(Video.created_at.desc()).limit(1)
    return (await s.scalars(q)).first()


async def pick_lesson(s: AsyncSession, rng: random.Random, series_id: str, taken: set[str]) -> Lesson | None:
    rows = list((await s.scalars(select(Lesson).where(Lesson.series_id == series_id).order_by(Lesson.used_count, Lesson.slug))).all())
    rows = [r for r in rows if r.id not in taken]
    if not rows:
        return None
    least = rows[0].used_count
    return rng.choice([r for r in rows if r.used_count == least])


def validate_script(script: dict[str, Any]) -> list[dict[str, str]]:
    spec = get_format(script["format"])
    try:
        spec.body_model.model_validate(script["body"])
    except Exception as e:  # noqa: BLE001 — ошибка валидации → needs_review с текстом
        return [{"field": "body", "message": f"Схема: {e}", "severity": "error", "source": "schema"}]
    return [i.as_dict() for i in spec.rules(script)]


class Presenter:
    """Оформление ролика внутри пачки: тема без повтора палитры подряд, хук/CTA без повторов, номер эпизода."""

    def __init__(self, s: AsyncSession, palettes: dict[str, dict[str, Any]]) -> None:
        self.s, self.palettes = s, palettes
        self.used_hooks: set[str] = set()
        self.used_ctas: set[str] = set()
        self.prev_palette: dict[str, str | None] = {}
        self.themes: list[dict[str, Any]] = []
        self.hook_texts: list[str] = []

    async def dress(self, series: Series, script: dict[str, Any], seed: int) -> dict[str, Any]:
        """Добавляет к скрипту хук/CTA, возвращает поля для Video (тема, паттерны, эпизод)."""
        s = self.s
        if series.id not in self.prev_palette:
            self.prev_palette[series.id] = await last_palette(s, series.id)
        theme = variation.build_theme(seed, series, self.palettes, {p for p in [self.prev_palette[series.id]] if p})
        self.prev_palette[series.id] = theme["palette"]["name"]
        vrng = random.Random(seed)
        hook = await hooks.pick(s, vrng, "hook", series.format, series.id, self.used_hooks)
        cta = await hooks.pick(s, vrng, "cta", series.format, series.id, self.used_ctas, answer_mode=series.answer_mode.value)
        if hook:
            self.used_hooks.add(hook.id)
        if cta:
            self.used_ctas.add(cta.id)
        script["hook_text"] = hook.text if hook else ""
        script["spoken_hook"] = (hook.spoken or hook.text) if hook else ""
        script["comment_hook"] = {"type": series.hook_type, "text": cta.text if cta else "", "spoken": (cta.spoken or cta.text) if cta else ""}
        if series.answer_mode == AnswerMode.reveal:
            script["body"]["reveal"] = True
        series.episode_counter += 1
        self.themes.append(theme)
        self.hook_texts.append(script["hook_text"])
        return {
            "seed": seed, "episode_no": series.episode_counter, "palette_name": theme["palette"]["name"],
            "hook_pattern_id": hook.id if hook else None, "cta_pattern_id": cta.id if cta else None,
            "voice": series.voice or {}, "render_props": {"theme": theme},
        }

    @property
    def similarity(self) -> float:
        return variation.similarity_index(self.themes, self.hook_texts)


async def plan_batch(batch_id: str) -> list[str]:
    """Создаёт ролики пачки из банка уроков. Возвращает id роликов, готовых к производству (approved)."""
    async with SessionLocal() as s:
        batch = await s.get(Batch, batch_id)
        if batch is None:
            raise ValueError("Пачка не найдена")
        if batch.series_id:
            one = await s.get(Series, batch.series_id)
            pool: list[Series] = [one] if one else []
        else:
            pool = list((await s.scalars(select(Series).where(Series.archived.is_(False), Series.format.in_(list(FORMATS))).order_by(Series.slug))).all())
        if not pool:
            raise ValueError("Нет серий с реализованным форматом")
        pres = Presenter(s, await load_palettes(s))
        rng = random.Random(batch_id)
        taken: set[str] = set()
        approved: list[str] = []
        for i in range(batch.requested):
            series = pool[i % len(pool)] if not batch.series_id else pool[0]
            lesson = await pick_lesson(s, rng, series.id, taken)
            if lesson is None:
                taken = set()  # банк меньше пачки: повторяем уроки, но с другим оформлением/хуком
                lesson = await pick_lesson(s, rng, series.id, taken)
            if lesson is None:
                await record("plan", "error", f"В серии «{series.name}» пустой банк уроков", batch_id=batch_id)
                continue
            taken.add(lesson.id)
            script = copy.deepcopy(lesson.script)
            fields = await pres.dress(series, script, rng.randrange(1, 2**31 - 1))
            issues = validate_script(script)
            has_err = any(x["severity"] == "error" for x in issues)
            status = VideoStatus.needs_review if has_err else (VideoStatus.approved if batch.auto_approve else VideoStatus.verified)
            lesson.used_count += 1
            lesson.last_used_at = utcnow()
            spec = get_format(series.format)
            v = Video(series_id=series.id, lesson_id=lesson.id, batch_id=batch_id, status=status, format=series.format, title=script["title"],
                      script=script, issues=issues, content_hash=content_hash(spec.content_words(script)), **fields)
            s.add(v)
            await s.flush()
            if status == VideoStatus.approved:
                approved.append(v.id)
        batch.similarity_index = pres.similarity
        batch.status = "running" if approved else "done"
        await s.commit()
    await record("plan", "ok", f"Запланировано {len(pres.themes)}, в работу {len(approved)}", batch_id=batch_id, data={"similarity_index": batch.similarity_index})
    return approved


# ---------------------------------------------------------------- производство
def make_render_props(
    script: dict[str, Any], theme: dict[str, Any], track: Track, *, voice_url: str | None, video_id: str | None = None,
    series_id: str | None = None, episode_no: int | None = None, seed: int = 0, avatar: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Скрипт + оформление + звуковая дорожка → валидный RenderProps (dict для JSON)."""
    spec = get_format(script["format"])
    timeline = spec.timeline(script, track.placements, track.total)
    props = {
        "format": script["format"], "video_id": video_id, "series_id": series_id, "episode_no": episode_no,
        "canvas": {"w": 1080, "h": 1920, "fps": 30}, "theme": theme, "hook_text": script.get("hook_text", ""),
        "title": script["title"], "cta_text": (script.get("comment_hook") or {}).get("text", ""), "body": script["body"],
        "timeline": timeline,
        "audio": {"voice_url": voice_url, "music_url": None, "music_volume": 0.08, "sfx": spec.sfx(timeline), "envelope": envelope(track.audio)},
        "avatar": avatar or {"mode": "none"},
        "loop_seamless": True, "duration_s": max(track.total, 3.0), "asset_base": "", "seed": seed, "show_yt_overlay": False,
    }
    return RenderProps.model_validate(props).model_dump(mode="json", exclude_none=False)


def voice_config(video_voice: dict[str, Any] | None, series_voice: dict[str, Any] | None = None) -> dict[str, Any]:
    st = get_settings()
    return {"model": st.default_tts_model, "voice": st.default_tts_voice, "speed": st.default_tts_speed, **(series_voice or {}), **(video_voice or {})}


async def synth_track(script: dict[str, Any], voice_cfg: dict[str, Any], timing: TimingConfig | None = None) -> tuple[Track, dict[str, Any]]:
    """Озвучка построчно (кеш на стороне tts) → обрезка тишины → сборка дорожки по таймлайну.
    voice_cfg["variants"] = {"item:3": 2} — номер дубля для отдельных строк."""
    st = get_settings()
    timing = timing or TimingConfig()
    spec = get_format(script["format"])
    ch = script.get("comment_hook") or {}
    segs = spec.segments(script, ch.get("spoken") or ch.get("text", ""), timing)
    variants: dict[str, int] = voice_cfg.get("variants") or {}
    clips = {}
    cached = 0
    for seg in segs:
        if not seg.text:
            continue
        r = await clients.tts_synthesize(seg.text, voice_cfg["model"], voice_cfg.get("voice"), float(voice_cfg.get("speed", 1.0)), int(variants.get(seg.key, 0)))
        cached += bool(r["cached"])
        clips[seg.key] = trim_silence(load_mono(st.data_dir / r["path"].lstrip("/")))
    track = assemble(segs, clips, timing.lead_in)
    return track, {"segments": len(segs), "synthesized": len(clips), "cached": cached}


async def llm_metadata(base: dict[str, Any], script: dict[str, Any], answer: str, series_name: str, answer_mode: str, video_id: str) -> dict[str, Any]:
    """Если LLM настроена — варианты A/B, описание, теги от LLM; правило-движок проверяет. Иначе — шаблон по правилам."""
    from ..llm.generate import generate_metadata
    from ..llm.providers import LLMError

    try:
        async with SessionLocal() as s:
            m = await generate_metadata(s, script, answer, series_name, script.get("hook_text", ""), answer_mode, video_id)
    except LLMError:
        return {**base, "source": "rules"}
    cand = {**base, "title": m["title_a"], "title_variants": {"A": m["title_a"], "B": m["title_b"]}, "description": m["description"],
            "tags": list(dict.fromkeys([*m.get("tags", []), *base["tags"]]))[:15], "hashtags": [h if h.startswith("#") else f"#{h}" for h in m.get("hashtags", [])][:5],
            "pinned_comment": m["pinned_comment"], "source": "llm"}
    if answer_mode != "reveal" and answer.lower() not in cand["pinned_comment"].lower():
        cand["pinned_comment"] = base["pinned_comment"]  # закреп обязан содержать ответ
    return cand if not metadata.check(cand) else {**base, "source": "rules"}


def _rel(p: Path) -> str:
    return "/" + p.relative_to(get_settings().data_dir).as_posix()


async def produce_video(video_id: str) -> None:
    st = get_settings()
    async with SessionLocal() as s:
        v = await s.get(Video, video_id)
        if v is None:
            return
        series = await s.get(Series, v.series_id) if v.series_id else None
        script = copy.deepcopy(v.script or {})
        theme = (v.render_props or {}).get("theme")
        batch_id, seed, episode_no = v.batch_id, v.seed, v.episode_no
        voice_cfg = voice_config(v.voice, series.voice if series else None)
        if not theme:
            theme = variation.build_theme(seed, series, await load_palettes(s), set())
    await set_video(video_id, status=VideoStatus.rendering, error=None, progress=0.0)
    spec = get_format(script["format"])
    out_dir = st.renders_dir / utcnow().strftime("%Y-%m-%d") / video_id
    out_dir.mkdir(parents=True, exist_ok=True)
    timing = TimingConfig()
    try:
        # 1. озвучка: каждая строка отдельно, кеш на стороне tts
        async with stage("tts", video_id, batch_id, 0.05) as info:
            track, tstats = await synth_track(script, voice_cfg, timing)
            info.update(**tstats, voice=voice_cfg)
        # 2. таймлайн и RenderProps
        async with stage("timeline", video_id, batch_id, 0.25) as info:
            voice_path = out_dir / "voice.wav"
            write_wav(voice_path, track.audio, SR)
            props = make_render_props(
                script, theme, track, voice_url="/media" + _rel(voice_path), video_id=video_id, series_id=series.id if series else None,
                episode_no=episode_no, seed=seed, avatar=series.avatar if series and series.avatar else None,
            )
            await set_video(video_id, render_props=props, duration_s=props["duration_s"])
            info.update(duration_s=props["duration_s"], events=len(props["timeline"]))

        # 3. рендер
        async def on_progress(p: float) -> None:
            await set_video(video_id, progress=round(0.3 + 0.6 * p, 3))

        async with stage("render", video_id, batch_id, 0.3) as info:
            res = await clients.render(props, _rel(out_dir), on_progress)
            info.update(video=res.get("video"), cover=res.get("cover"))
        # 4. метаданные
        async with stage("metadata", video_id, batch_id, 0.95) as info:
            answer_mode = series.answer_mode.value if series else "hide"
            meta = metadata.build(script, spec.answer(script), series.name if series else "", episode_no, script.get("hook_text", ""), answer_mode)
            meta = await llm_metadata(meta, script, spec.answer(script), series.name if series else "", answer_mode, video_id)
            info["meta_source"] = meta.get("source", "rules")
            problems = metadata.check(meta)
            if problems:
                info["warnings"] = problems
            (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            (out_dir / "script.json").write_text(json.dumps(script, ensure_ascii=False, indent=2), encoding="utf-8")
            reveal_at = utcnow() + timedelta(hours=series.answer_delay_h) if series and series.answer_mode == AnswerMode.answer_tomorrow else None
        await set_video(video_id, status=VideoStatus.ready, stage="done", progress=1.0, meta=meta, out_dir=_rel(out_dir), answer_reveal_at=reveal_at,
                        answer_comment_status="pending" if answer_mode != "reveal" else "n/a")
    except Exception as e:  # noqa: BLE001 — любой сбой → failed с понятным текстом
        await set_video(video_id, status=VideoStatus.failed, error=str(e)[:2000])
    finally:
        if batch_id:
            await refresh_batch(batch_id)


async def refresh_batch(batch_id: str) -> None:
    async with SessionLocal() as s:
        rows = (await s.execute(select(Video.status, func.count()).where(Video.batch_id == batch_id).group_by(Video.status))).all()
        counts = {str(st.value if hasattr(st, "value") else st): n for st, n in rows}
        active = counts.get("approved", 0) + counts.get("rendering", 0)
        batch = await s.get(Batch, batch_id)
        if batch is None:
            return
        if active == 0:
            batch.status = "failed" if counts.get("ready", 0) == 0 and counts.get("failed", 0) else ("partial" if counts.get("failed") else "done")
        await s.commit()
    await publish({"type": "batch", "batch_id": batch_id, "counts": counts})
