"""Этап 2: серии (CRUD), банк уроков, канбан (массовые действия), редактор (скрипт, превью, перегенерация строки)."""
from __future__ import annotations

import copy
import hashlib
import json
import random
import re
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..events import publish
from ..formats import FORMATS, get_format
from ..formats.base import TimingConfig, content_hash
from ..models import AnswerMode, Asset, Lesson, Series, Video, VideoStatus
from ..pipeline import variation
from ..pipeline.audio import SR, write_wav
from ..pipeline.clients import ServiceError
from ..pipeline.produce import default_voice, load_palettes, make_render_props, synth_track, validate_script, voice_config
from ..serializers import lesson_out, series_out, video_out
from ..worker import enqueue

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]


# ------------------------------------------------------------------ справочники
@router.get("/meta/schemas")
async def schemas() -> dict[str, Any]:
    d = get_settings().schemas_dir

    def load(p: Path) -> Any:
        return json.loads(p.read_text(encoding="utf-8"))

    return {
        "script": load(d / "script.schema.json"),
        "render_props": load(d / "render_props.schema.json"),
        "formats": {p.name.removesuffix(".schema.json"): load(p) for p in sorted((d / "formats").glob("*.schema.json"))},
        "implemented": list(FORMATS),
    }


@router.get("/palettes")
async def palettes(s: Session) -> list[dict[str, Any]]:
    rows = (await s.scalars(select(Asset).where(Asset.kind == "palette").order_by(Asset.name))).all()
    return [{"name": r.name, "enabled": r.enabled, **r.data} for r in rows]


# ------------------------------------------------------------------ серии
class SeriesIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    format: str
    level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] = "A1"
    topic: str = ""
    description: str = ""
    palettes: list[str] = []
    fonts: list[Literal["Montserrat", "Fredoka", "Nunito"]] = ["Montserrat", "Fredoka", "Nunito"]
    voice: dict[str, Any] = {}
    avatar: dict[str, Any] = {"mode": "none"}
    hook_type: str = "hidden_answer"
    answer_mode: AnswerMode = AnswerMode.hide
    answer_delay_h: int = Field(default=24, ge=1, le=168)
    second_lang: Literal["en"] | None = None  # контент только итальянский + английский
    auto_approve: bool = False  # ТЗ: ручной аппрув по умолчанию для новых серий
    youtube_playlist_id: str | None = None


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "serie"


@router.post("/series", status_code=201)
async def create_series(body: SeriesIn, s: Session) -> dict[str, Any]:
    slug = _slug(body.name)
    if (await s.scalars(select(Series).where(Series.slug == slug))).first():
        slug = f"{slug}-{random.randint(100, 999)}"
    ser = Series(slug=slug, **body.model_dump())
    s.add(ser)
    await s.commit()
    return series_out(ser)


@router.get("/series/{sid}")
async def get_series(sid: str, s: Session) -> dict[str, Any]:
    ser = await s.get(Series, sid)
    if ser is None:
        raise HTTPException(404, "Серия не найдена")
    return series_out(ser) | {"implemented": ser.format in FORMATS}


@router.patch("/series/{sid}")
async def patch_series(sid: str, body: dict[str, Any], s: Session) -> dict[str, Any]:
    ser = await s.get(Series, sid)
    if ser is None:
        raise HTTPException(404, "Серия не найдена")
    merged = SeriesIn.model_validate({**series_out(ser), **body}).model_dump()  # валидируем целиком
    for k, v in merged.items():
        if k in body:
            setattr(ser, k, v)
    if "archived" in body:
        ser.archived = bool(body["archived"])
    await s.commit()
    return series_out(ser)


@router.delete("/series/{sid}")
async def archive_series(sid: str, s: Session) -> dict[str, bool]:
    ser = await s.get(Series, sid)
    if ser is None:
        raise HTTPException(404, "Серия не найдена")
    ser.archived = True  # ролики и банк остаются; серия скрывается
    await s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ банк уроков
class LessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    script: dict[str, Any]


@router.post("/series/{sid}/lessons", status_code=201)
async def add_lesson(sid: str, body: LessonIn, s: Session) -> dict[str, Any]:
    ser = await s.get(Series, sid)
    if ser is None:
        raise HTTPException(404, "Серия не найдена")
    script = {**body.script, "format": ser.format, "title": body.title}
    issues = validate_script(script)
    if any(i["severity"] == "error" for i in issues):
        raise HTTPException(400, "; ".join(f"{i['field']}: {i['message']}" for i in issues)[:500])
    spec = get_format(ser.format)
    les = Lesson(series_id=sid, slug=f"{_slug(body.title)}-{random.randint(1000, 9999)}", title=body.title, script=script, source="manual",
                 content_hash=content_hash(spec.content_words(script)))
    s.add(les)
    await s.commit()
    return lesson_out(les)


@router.delete("/lessons/{lid}")
async def delete_lesson(lid: str, s: Session) -> dict[str, bool]:
    les = await s.get(Lesson, lid)
    if les is None:
        raise HTTPException(404, "Урок не найден")
    await s.delete(les)
    await s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ канбан
class BulkIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    action: Literal["approve", "to_review", "reject", "rerender"]


@router.post("/videos/bulk")
async def bulk(body: BulkIn, s: Session) -> dict[str, Any]:
    vids = list((await s.scalars(select(Video).where(Video.id.in_(body.ids)))).all())
    to_render: list[str] = []
    skipped: list[str] = []
    for v in vids:
        if v.status == VideoStatus.rendering:
            skipped.append(v.id)
            continue
        if body.action == "approve":
            if any(i.get("severity") == "error" for i in v.issues or []):
                skipped.append(v.id)  # с ошибками в рендер нельзя — сначала поправить в редакторе
                continue
            if v.status in (VideoStatus.ready, VideoStatus.published):
                skipped.append(v.id)
                continue
            v.status = VideoStatus.approved
            to_render.append(v.id)
        elif body.action == "rerender":
            v.status, v.error, v.progress = VideoStatus.approved, None, 0.0
            to_render.append(v.id)
        elif body.action == "to_review":
            v.status = VideoStatus.verified
        elif body.action == "reject":
            await s.delete(v)
    await s.commit()
    for vid in to_render:
        await enqueue("run_video", vid)
    await publish({"type": "bulk", "action": body.action, "count": len(vids)})
    return {"ok": True, "processed": len(vids) - len(skipped), "skipped": skipped}


# ------------------------------------------------------------------ редактор
class EditIn(BaseModel):
    script: dict[str, Any] | None = None
    theme: dict[str, Any] | None = None
    voice: dict[str, Any] | None = None


async def _load(s: AsyncSession, vid: str) -> tuple[Video, Series | None]:
    v = await s.get(Video, vid)
    if v is None:
        raise HTTPException(404, "Ролик не найден")
    ser = await s.get(Series, v.series_id) if v.series_id else None
    return v, ser


async def _theme(s: AsyncSession, v: Video, ser: Series | None) -> dict[str, Any]:
    theme = (v.render_props or {}).get("theme")
    if theme:
        return dict(theme)
    return variation.build_theme(v.seed, ser or _DefaultSeries(), await load_palettes(s), set())


class _DefaultSeries:
    palettes: list[str] = []
    fonts = ["Montserrat"]
    second_lang = None


def _norm_script(script: dict[str, Any], fmt: str) -> dict[str, Any]:
    out = copy.deepcopy(script)
    out["format"] = fmt
    return out


@router.put("/videos/{vid}")
async def save_video(vid: str, body: EditIn, s: Session) -> dict[str, Any]:
    """Сохранить правки. Ролик возвращается на проверку (verified/needs_review); рендер — отдельной кнопкой."""
    v, ser = await _load(s, vid)
    if v.status == VideoStatus.rendering:
        raise HTTPException(409, "Ролик сейчас рендерится — дождись окончания")
    if body.script is not None:
        script = _norm_script(body.script, v.format)
        issues = validate_script(script)
        v.script, v.issues, v.title = script, issues, script.get("title", v.title)
        v.content_hash = content_hash(get_format(v.format).content_words(script)) if not any(i["source"] == "schema" for i in issues) else v.content_hash
        v.status = VideoStatus.needs_review if any(i["severity"] == "error" for i in issues) else VideoStatus.verified
    if body.theme is not None:
        v.render_props = {**(v.render_props or {}), "theme": body.theme}
        v.palette_name = body.theme.get("palette", {}).get("name", v.palette_name)
    if body.voice is not None:
        v.voice = {**(v.voice or {}), **body.voice}
    await s.commit()
    return video_out(v, full=True)


@router.post("/videos/{vid}/preview")
async def preview(vid: str, body: EditIn, s: Session) -> dict[str, Any]:
    """Живое превью: озвучка + таймлайн без рендера. Возвращает RenderProps для @remotion/player."""
    v, ser = await _load(s, vid)
    script = _norm_script(body.script if body.script is not None else (v.script or {}), v.format)
    issues = validate_script(script)
    if any(i["source"] == "schema" for i in issues):
        return {"props": None, "issues": issues}
    theme = body.theme or await _theme(s, v, ser)
    vcfg = voice_config({**(v.voice or {}), **(body.voice or {})}, ser.voice if ser else None, await default_voice(s))
    try:
        track, stats = await synth_track(script, vcfg, verify=False)  # живое превью — без проверки Whisper, чтобы не тормозить
    except ServiceError as e:
        raise HTTPException(503, f"Озвучка недоступна: {e}") from e
    st = get_settings()
    digest = hashlib.sha1(track.audio.tobytes()).hexdigest()[:16]
    path = st.data_dir / "previews" / vid / f"voice-{digest}.wav"
    if not path.exists():
        write_wav(path, track.audio, SR)
    props = make_render_props(script, theme, track, voice_url=f"/media/previews/{vid}/{path.name}", video_id=vid, series_id=v.series_id,
                              episode_no=v.episode_no, seed=v.seed, avatar=ser.avatar if ser and ser.avatar else None)
    segs = get_format(v.format).segments(script, (script.get("comment_hook") or {}).get("spoken", ""), TimingConfig())
    return {"props": props, "issues": issues, "stats": stats, "segments": [{"key": x.key, "text": x.text} for x in segs if x.text], "voice": vcfg}


class RegenIn(BaseModel):
    key: str = Field(pattern=r"^(hook|cta|reveal|item:\d+)$")


@router.post("/videos/{vid}/regen-line")
async def regen_line(vid: str, body: RegenIn, s: Session) -> dict[str, Any]:
    """Новый дубль озвучки одной строки: номер дубля сохраняется в video.voice.variants."""
    v, _ = await _load(s, vid)
    voice = dict(v.voice or {})
    variants = dict(voice.get("variants") or {})
    variants[body.key] = int(variants.get(body.key, 0)) + 1
    voice["variants"] = variants
    v.voice = voice
    await s.commit()
    return {"ok": True, "variants": variants}


@router.post("/videos/{vid}/reroll-theme")
async def reroll_theme(vid: str, s: Session) -> dict[str, Any]:
    """Другая палитра/раскладка/наклейки (новый сид оформления)."""
    v, ser = await _load(s, vid)
    seed = random.randrange(1, 2**31 - 1)
    current = (v.render_props or {}).get("theme", {}).get("palette", {}).get("name")
    theme = variation.build_theme(seed, ser or _DefaultSeries(), await load_palettes(s), {current} if current else set())
    return {"theme": theme}
