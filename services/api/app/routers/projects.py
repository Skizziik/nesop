"""Этап 9: проекты видеоредактора — лекции 16:9, редактирование шортсов, произвольные монтажи."""

from __future__ import annotations

import copy
import re
import tempfile
import unicodedata
import zipfile
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session, new_id
from ..llm.generate import get_provider
from ..llm.providers import LLMError
from ..models import Project, ProjectVersion, Video, VoiceProfile
from ..pipeline.clients import ServiceError
from ..pipeline.revoice import RevoiceError, revoice_sentence
from ..schemas_gen.timeline import TimelineDoc
from ..worker import enqueue
from .voices import voice_cfg

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]
KEEP_VERSIONS = 50


def project_out(p: Project, full: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": p.id,
        "title": p.title,
        "kind": p.kind,
        "aspect": p.aspect,
        "status": p.status,
        "progress": p.progress,
        "stage": p.stage,
        "error": p.error,
        "series_id": p.series_id,
        "video_id": p.video_id,
        "params": p.params,
        "revision": p.revision,
        "duration_s": (p.doc or {}).get("duration_s"),
        # последний рендер доступен и после правок (статус draft): иначе готовое видео «пропадает» из интерфейса
        "video_url": f"/media{p.out_dir}/video.mp4" if p.out_dir else None,
        "video_stale": bool(p.out_dir) and p.status != "ready",
        "cover_url": f"/media{p.out_dir}/cover.png" if p.out_dir else None,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }
    if full:
        out |= {"doc": p.doc, "meta": p.meta}
    return out


def blank_doc(title: str, aspect: str) -> dict[str, Any]:
    land = aspect == "16:9"
    return {
        "version": 1,
        "title": title,
        "canvas": {"w": 1920, "h": 1080, "fps": 30} if land else {"w": 1080, "h": 1920, "fps": 30},
        "duration_s": 30,
        "background": "#1B1035",
        "palette": {},
        "font": "Montserrat",
        "subtitle_style": {"size": 44, "y": 0.9 if land else 0.8},
        "envelope": [],
        "asset_base": "",
        "seed": 1,
        "tracks": [
            {
                "id": "scenes",
                "kind": "scene",
                "name": "Сцены",
                "clips": [{"id": new_id()[:8], "type": "slide", "start": 0, "duration": 30, "props": {"kind": "title", "title": title}}],
            },
            {"id": "overlay", "kind": "overlay", "name": "Текст и наклейки", "clips": []},
            {"id": "mascot", "kind": "mascot", "name": "Маскоты", "clips": []},
            {"id": "subs", "kind": "subtitle", "name": "Субтитры", "clips": []},
            {"id": "audio", "kind": "audio", "name": "Звук", "clips": []},
        ],
    }


@router.get("/projects")
async def list_projects(s: Session, kind: str | None = None) -> list[dict[str, Any]]:
    q = select(Project).order_by(Project.updated_at.desc()).limit(200)
    if kind:
        q = q.where(Project.kind == kind)
    return [project_out(p) for p in (await s.scalars(q)).all()]


class NewIn(BaseModel):
    title: str = Field(default="Новый проект", max_length=200)
    aspect: Literal["16:9", "9:16"] = "16:9"


@router.post("/projects", status_code=201)
async def create_project(body: NewIn, s: Session) -> dict[str, Any]:
    p = Project(title=body.title, kind="custom", aspect=body.aspect, doc=blank_doc(body.title, body.aspect), status="draft", revision=1)
    s.add(p)
    await s.commit()
    return project_out(p, full=True)


class LectureIn(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    level: Literal["A1", "A2", "B1", "B2", "C1"] = "A2"
    minutes: int = Field(default=15, ge=3, le=25)
    mascot: str = "espresso"
    lang: Literal["en"] = "en"  # субтитры-перевод только на английском
    aspect: Literal["16:9", "9:16"] = "16:9"
    series_id: str | None = None
    voice: dict[str, Any] | None = None
    voice_profile_id: str | None = Field(default=None, description="Голос лекции (профиль со страницы «Голоса»); пусто — голос серии или основной")
    auto_render: bool = Field(default=False, description="Сразу отрендерить mp4 после генерации")


@router.post("/projects/lecture", status_code=202)
async def create_lecture(body: LectureIn, s: Session) -> dict[str, Any]:
    """Длинная лекция от LLM: план → главы → проверка → озвучка → таймлайн. Потом — правка в редакторе и рендер."""
    try:
        await get_provider(s)
    except LLMError as e:
        raise HTTPException(400, str(e)) from e
    params = body.model_dump()
    if body.voice_profile_id:
        prof = await s.get(VoiceProfile, body.voice_profile_id)
        if prof is None:
            raise HTTPException(404, "Голос не найден")
        params["voice"] = voice_cfg(prof)
    p = Project(
        title=body.topic[:200],
        kind="lecture",
        aspect=body.aspect,
        doc={},
        status="generating",
        stage="в очереди",
        series_id=body.series_id,
        params=params,
    )
    s.add(p)
    await s.commit()
    await enqueue("run_lecture", p.id)
    return project_out(p)


@router.get("/projects/{pid}")
async def get_project(pid: str, s: Session) -> dict[str, Any]:
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    return project_out(p, full=True)


class SaveIn(BaseModel):
    doc: dict[str, Any]
    title: str | None = None
    note: str = ""
    base_revision: int | None = Field(default=None, description="Ревизия, с которой начал редактор — защита от перезаписи чужих правок")


def validate_doc(doc: dict[str, Any]) -> dict[str, Any]:
    try:
        return TimelineDoc.model_validate(doc).model_dump(mode="json", exclude_none=True)
    except ValidationError as e:
        first = e.errors()[0]
        raise HTTPException(400, f"Документ некорректен: {'.'.join(map(str, first['loc']))}: {first['msg']}") from e


@router.put("/projects/{pid}")
async def save_project(pid: str, body: SaveIn, s: Session) -> dict[str, Any]:
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    if p.status in ("generating", "rendering"):
        raise HTTPException(409, "Проект сейчас генерируется или рендерится — дождись окончания")
    if body.base_revision is not None and body.base_revision != p.revision:
        raise HTTPException(409, f"Проект изменился в другом окне (ревизия {p.revision}, у тебя {body.base_revision}) — обнови страницу")
    doc = validate_doc(body.doc)
    p.doc, p.revision = doc, p.revision + 1
    if body.title:
        p.title = body.title
    if p.status in ("ready", "failed"):
        p.status = "draft"
    s.add(ProjectVersion(project_id=pid, revision=p.revision, doc=doc, note=body.note[:200]))
    await s.flush()
    old = (
        await s.scalars(select(ProjectVersion.id).where(ProjectVersion.project_id == pid).order_by(ProjectVersion.revision.desc()).offset(KEEP_VERSIONS))
    ).all()
    if old:
        await s.execute(delete(ProjectVersion).where(ProjectVersion.id.in_(old)))
    await s.commit()
    return project_out(p)


class RevoiceIn(BaseModel):
    clip_id: str
    base_revision: int | None = None


@router.post("/projects/{pid}/revoice")
async def revoice(pid: str, body: RevoiceIn, s: Session) -> dict[str, Any]:
    """Переозвучить одну фразу (клип субтитров): новый дубль голоса вклеивается на место старого, сохраняется новой ревизией."""
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    if p.status in ("generating", "rendering"):
        raise HTTPException(409, "Проект сейчас генерируется или рендерится — дождись окончания")
    if body.base_revision is not None and body.base_revision != p.revision:
        raise HTTPException(409, "Проект изменился — сначала сохрани правки")
    try:
        res = await revoice_sentence(s, p, body.clip_id)
    except RevoiceError as e:
        raise HTTPException(400, str(e)) from e
    except ServiceError as e:
        raise HTTPException(502, f"Озвучка не удалась: {e}") from e
    text = next((c["props"].get("text", "") for t in res["doc"]["tracks"] for c in t["clips"] if c["id"] == body.clip_id), "")
    out = await save_project(pid, SaveIn(doc=res["doc"], note=f"переозвучка: {text[:60]}", base_revision=p.revision), s)
    return out | {"doc": (await s.get(Project, pid)).doc, "revoice": {k: res[k] for k in ("score", "heard", "take", "duration")}}  # type: ignore[union-attr]


@router.post("/projects/{pid}/youtube")
async def regen_youtube(pid: str, s: Session) -> dict[str, Any]:
    """Пересобрать обложки и тексты для YouTube (после правок лекции: новые главы, другой маскот)."""
    from ..pipeline.youtube import build_youtube

    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    if not p.doc:
        raise HTTPException(409, "Проект ещё генерируется")
    yt = await build_youtube(pid)
    return {"youtube": yt}


@router.get("/projects/{pid}/youtube.zip")
async def youtube_zip(pid: str, s: Session) -> FileResponse:
    """Всё для ручной загрузки на YouTube одним архивом: mp4, 3 обложки, тексты (названия, описание, теги, хештеги)."""
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    st = get_settings()
    yt = (p.meta or {}).get("youtube") or {}
    video = st.data_dir / p.out_dir.lstrip("/") / "video.mp4" if p.out_dir else None
    if not yt.get("title") and not (video and video.exists()):
        raise HTTPException(409, "Нет ни видео, ни YouTube-пакета — сначала «Рендер» и «Сгенерировать» в панели YouTube")
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", p.title).encode("ascii", "ignore").decode().lower()).strip("-")[:60] or "video"
    tmp = Path(tempfile.gettempdir()) / f"yt-{pid}.zip"
    text = "\n\n".join(
        [
            "НАЗВАНИЕ (варианты, первый — основной):\n" + "\n".join(yt.get("titles") or [yt.get("title", p.title)]),
            "ОПИСАНИЕ:\n" + str(yt.get("description", "")),
            "ТЕГИ (вставить в поле «Теги»):\n" + ", ".join(yt.get("tags") or []),
            "ХЕШТЕГИ:\n" + " ".join(yt.get("hashtags") or []),
            "ОБЛОЖКИ: thumbnail-1..3.png — загрузи все три в YouTube Studio → «Тест и сравнение» (Test & Compare).",
        ]
    )
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:  # mp4 уже сжат — без повторного сжатия
        if video and video.exists():
            z.write(video, f"{slug}.mp4")
        for i, url in enumerate(yt.get("thumbnails") or []):
            f = st.data_dir / str(url).removeprefix("/media/")
            if f.exists():
                z.write(f, f"thumbnail-{i + 1}.png")
        z.writestr("youtube.txt", text)
    return FileResponse(tmp, media_type="application/zip", filename=f"{slug}-youtube.zip")


@router.get("/projects/{pid}/versions")
async def versions(pid: str, s: Session) -> list[dict[str, Any]]:
    rows = (await s.scalars(select(ProjectVersion).where(ProjectVersion.project_id == pid).order_by(ProjectVersion.revision.desc()))).all()
    return [{"id": v.id, "revision": v.revision, "note": v.note, "created_at": v.created_at.isoformat(), "duration_s": v.doc.get("duration_s")} for v in rows]


@router.post("/projects/{pid}/versions/{vid}/restore")
async def restore(pid: str, vid: str, s: Session) -> dict[str, Any]:
    v = await s.get(ProjectVersion, vid)
    if v is None or v.project_id != pid:
        raise HTTPException(404, "Версия не найдена")
    return await save_project(pid, SaveIn(doc=copy.deepcopy(v.doc), note=f"восстановлена ревизия {v.revision}"), s)


@router.post("/projects/{pid}/render", status_code=202)
async def render_project(pid: str, s: Session) -> dict[str, Any]:
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    if p.status in ("generating", "rendering"):
        raise HTTPException(409, "Уже идёт генерация или рендер")
    validate_doc(p.doc)
    p.status, p.progress, p.stage, p.error = "rendering", 0.0, "в очереди", None
    await s.commit()
    await enqueue("run_project_render", p.id)
    return project_out(p)


@router.delete("/projects/{pid}")
async def delete_project(pid: str, s: Session) -> dict[str, bool]:
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    await s.delete(p)
    await s.commit()
    return {"ok": True}


@router.post("/projects/{pid}/duplicate", status_code=201)
async def duplicate(pid: str, s: Session) -> dict[str, Any]:
    p = await s.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Проект не найден")
    q = Project(
        title=f"{p.title} (копия)",
        kind=p.kind,
        aspect=p.aspect,
        doc=copy.deepcopy(p.doc),
        status="draft" if p.doc else p.status,
        series_id=p.series_id,
        video_id=p.video_id,
        params=p.params,
        meta=p.meta,
        revision=1,
    )
    s.add(q)
    await s.commit()
    return project_out(q)


# ------------------------------------------------------------------ шортс → проект
@router.post("/videos/{vid}/to-project", status_code=201)
async def short_to_project(vid: str, s: Session) -> dict[str, Any]:
    """Открыть готовый шортс в редакторе: ролик — базовый клип, сверху пустые дорожки + субтитры из реплик голоса."""
    v = await s.get(Video, vid)
    if v is None or not v.render_props or "canvas" not in (v.render_props or {}):
        raise HTTPException(400, "У ролика ещё нет собранных пропсов — сначала рендер или превью")
    rp = v.render_props
    dur = float(rp["duration_s"])
    subs = [
        {
            "id": f"c{k}",
            "type": "subtitle",
            "start": round(c["t_start"], 3),
            "duration": round(max(c["t_end"] - c["t_start"], 0.3) + 0.1, 3),
            "label": c["text"][:30],
            "props": {"text": c["text"]},
        }
        for k, c in enumerate(rp.get("captions") or [])
    ]
    doc = {
        "version": 1,
        "title": v.title,
        "canvas": {"w": 1080, "h": 1920, "fps": 30},
        "duration_s": dur,
        "background": "#000000",
        "palette": (rp.get("theme") or {}).get("palette", {}),
        "font": (rp.get("theme") or {}).get("font", "Montserrat"),
        "subtitle_style": {"size": 40, "y": 0.78, "show_translation": False, "highlight_words": False},
        "envelope": (rp.get("audio") or {}).get("envelope", []),
        "asset_base": "",
        "seed": v.seed,
        "tracks": [
            {
                "id": "base",
                "kind": "scene",
                "name": "Шортс",
                "clips": [{"id": "short", "type": "short", "start": 0, "duration": dur, "label": v.title[:40], "props": {"render_props": rp}}],
            },
            {"id": "overlay", "kind": "overlay", "name": "Текст и наклейки", "clips": []},
            {"id": "mascot", "kind": "mascot", "name": "Маскоты", "clips": []},
            {"id": "subs", "kind": "subtitle", "name": "Субтитры", "hidden": True, "clips": subs},
            {"id": "audio", "kind": "audio", "name": "Звук", "clips": []},
        ],
    }
    p = Project(title=v.title, kind="short_edit", aspect="9:16", doc=validate_doc(doc), status="draft", video_id=vid, series_id=v.series_id, revision=1)
    s.add(p)
    await s.commit()
    return project_out(p)
