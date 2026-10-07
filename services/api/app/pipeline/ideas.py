"""Конвейер LLM: Idea → Script → Verified/needs_review → Approved (авто-аппрув) → рендер. Плюс «похожие» и «наполнить банк»."""
from __future__ import annotations

import json
import random

from sqlalchemy import select

from ..checks import full_check, lesson_exists
from ..db import SessionLocal
from ..events import publish, record
from ..formats import get_format
from ..formats.base import content_hash
from ..llm.generate import generate_ideas, generate_script
from ..llm.providers import LLMError
from ..models import Batch, Lesson, Series, Video, VideoStatus
from .produce import Presenter, load_palettes


async def run_ideas(batch_id: str, free_topic: str = "", like_video_id: str | None = None) -> list[str]:
    """Придумывает batch.requested идей для серии, пишет скрипты, проверяет. Возвращает id одобренных к рендеру."""
    async with SessionLocal() as s:
        batch = await s.get(Batch, batch_id)
        if batch is None or batch.series_id is None:
            raise ValueError("Для идей нужна серия")
        series = await s.get(Series, batch.series_id)
        if series is None:
            raise ValueError("Серия не найдена")
        topic = free_topic
        if like_video_id:
            ref = await s.get(Video, like_video_id)
            if ref and ref.script:
                topic = f"Simile a questo video (stesso tipo di sfida, contenuto DIVERSO): {json.dumps(ref.script.get('body'), ensure_ascii=False)[:1500]}"
        try:
            ideas = await generate_ideas(s, series, batch.requested, topic)
        except LLMError as e:
            batch.status, batch.note = "failed", str(e)
            await s.commit()
            await record("ideas", "error", str(e), batch_id=batch_id)
            return []
        vids = []
        for idea in ideas:
            v = Video(series_id=series.id, batch_id=batch_id, status=VideoStatus.idea, format=series.format, title=str(idea.get("title", ""))[:200],
                      idea=json.dumps(idea, ensure_ascii=False), parent_id=like_video_id)
            s.add(v)
            vids.append(v)
        batch.status = "running"
        await s.commit()
        ids = [v.id for v in vids]
    await record("ideas", "ok", f"Идей: {len(ids)}", batch_id=batch_id)
    await publish({"type": "batch", "batch_id": batch_id})

    approved: list[str] = []
    async with SessionLocal() as s:
        series = await s.get(Series, batch.series_id)
        batch = await s.get(Batch, batch_id)
        assert series is not None and batch is not None
        pres = Presenter(s, await load_palettes(s))
        rng = random.Random(batch_id)
        for vid in ids:
            got = await s.get(Video, vid)
            if got is None:
                continue
            v = got
            try:
                script = await generate_script(s, series, json.loads(v.idea), video_id=vid)
                issues, script = await full_check(s, script, series.id, video_id=vid)
            except LLMError as e:
                v.status, v.error = VideoStatus.needs_review, str(e)
                v.issues = [{"field": "body", "message": str(e), "severity": "error", "source": "llm"}]
                await s.commit()
                await record("script", "error", str(e), video_id=vid, batch_id=batch_id)
                continue
            fields = await pres.dress(series, script, rng.randrange(1, 2**31 - 1))
            for k, val in fields.items():
                setattr(v, k, val)
            has_err = any(i["severity"] == "error" for i in issues)
            v.script, v.issues, v.title = script, issues, script["title"]
            v.content_hash = content_hash(get_format(series.format).content_words(script))
            v.status = VideoStatus.needs_review if has_err else (VideoStatus.approved if batch.auto_approve else VideoStatus.verified)
            if v.status == VideoStatus.approved:
                approved.append(vid)
            await s.commit()
            await record("script", "ok", f"{len(issues)} замечаний", video_id=vid, batch_id=batch_id, data={"errors": sum(i["severity"] == "error" for i in issues)})
            await publish({"type": "video", "video_id": vid, "status": v.status.value})
        batch.similarity_index = pres.similarity
        if not approved:
            batch.status = "done"
        await s.commit()
    return approved


async def fill_bank(series_id: str, n: int) -> dict[str, int]:
    """«Наполнить банк»: LLM придумывает и пишет N уроков; в банк попадают только прошедшие все проверки."""
    added = skipped = 0
    async with SessionLocal() as s:
        series = await s.get(Series, series_id)
        if series is None:
            raise ValueError("Серия не найдена")
        ideas = await generate_ideas(s, series, n)
        spec = get_format(series.format)
        for idea in ideas:
            try:
                script = await generate_script(s, series, idea)
                issues, script = await full_check(s, script, series.id)
            except LLMError as e:
                await record("fill_bank", "error", str(e))
                skipped += 1
                continue
            if any(i["severity"] == "error" for i in issues) or await lesson_exists(s, series.id, script):
                skipped += 1
                continue
            slug = f"llm-{content_hash(spec.content_words(script))[:10]}"
            if (await s.execute(select(Lesson.id).where(Lesson.series_id == series.id, Lesson.slug == slug))).first():
                skipped += 1
                continue
            s.add(Lesson(series_id=series.id, slug=slug, title=script["title"], script=script, source="llm",
                         content_hash=content_hash(spec.content_words(script))))
            await s.commit()
            added += 1
    await record("fill_bank", "ok", f"Серия {series_id}: добавлено {added}, отброшено {skipped}")
    await publish({"type": "bank", "series_id": series_id, "added": added})
    return {"added": added, "skipped": skipped}

