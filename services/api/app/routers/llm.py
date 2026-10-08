"""Этап 3: генерация через LLM, проверки, настройки провайдера, расход."""
from __future__ import annotations

from datetime import timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..checks import full_check
from ..config import get_settings
from ..db import get_session, utcnow
from ..formats import FORMATS
from ..llm.generate import get_provider, llm_settings
from ..llm.providers import LLMError
from ..models import Batch, LlmCall, Series, Setting, Video, VideoStatus
from ..serializers import batch_out, video_out
from ..worker import enqueue

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]


async def _require_llm(s: AsyncSession) -> None:
    try:
        await get_provider(s)
    except LLMError as e:
        raise HTTPException(400, str(e)) from e


class IdeasIn(BaseModel):
    count: int = Field(default=20, ge=1, le=50)
    topic: str = Field(default="", max_length=300)
    auto_approve: bool | None = None


@router.post("/series/{sid}/ideas", status_code=202)
async def ideas(sid: str, body: IdeasIn, s: Session) -> dict[str, Any]:
    """«Придумать N идей»: LLM → идеи → скрипты → проверки. Появляются в канбане."""
    ser = await s.get(Series, sid)
    if ser is None:
        raise HTTPException(404, "Серия не найдена")
    if ser.format not in FORMATS:
        raise HTTPException(400, f"Формат «{ser.format}» ещё не реализован")
    await _require_llm(s)
    b = Batch(series_id=sid, requested=body.count, auto_approve=body.auto_approve if body.auto_approve is not None else ser.auto_approve, note="llm")
    s.add(b)
    await s.commit()
    await enqueue("run_llm_ideas", b.id, body.topic)
    return batch_out(b)


class SimilarIn(BaseModel):
    count: int = Field(default=5, ge=1, le=20)


@router.post("/videos/{vid}/similar", status_code=202)
async def similar(vid: str, body: SimilarIn, s: Session) -> dict[str, Any]:
    """«Сделать похожие на этот»."""
    v = await s.get(Video, vid)
    if v is None or v.series_id is None:
        raise HTTPException(404, "Ролик не найден")
    await _require_llm(s)
    ser = await s.get(Series, v.series_id)
    b = Batch(series_id=v.series_id, requested=body.count, auto_approve=bool(ser and ser.auto_approve), note=f"similar:{vid}")
    s.add(b)
    await s.commit()
    await enqueue("run_llm_ideas", b.id, "", vid)
    return batch_out(b)


class FillIn(BaseModel):
    count: int = Field(default=10, ge=1, le=30)


@router.post("/series/{sid}/fill-bank", status_code=202)
async def fill(sid: str, body: FillIn, s: Session) -> dict[str, Any]:
    if await s.get(Series, sid) is None:
        raise HTTPException(404, "Серия не найдена")
    await _require_llm(s)
    await enqueue("run_fill_bank", sid, body.count)
    return {"ok": True, "queued": body.count}


@router.post("/videos/{vid}/check")
async def recheck(vid: str, s: Session, llm: bool = True) -> dict[str, Any]:
    """Перепроверить скрипт: правила + LanguageTool + Hunspell + LLM-верификатор + дедуп."""
    v = await s.get(Video, vid)
    if v is None or not v.script:
        raise HTTPException(404, "Ролик не найден")
    issues, script = await full_check(s, dict(v.script), v.series_id, video_id=vid, use_llm=llm)
    v.script, v.issues = script, issues
    if v.status not in (VideoStatus.ready, VideoStatus.published, VideoStatus.rendering, VideoStatus.approved):
        v.status = VideoStatus.needs_review if any(i["severity"] == "error" for i in issues) else VideoStatus.verified
    await s.commit()
    return video_out(v, full=True)


# ------------------------------------------------------------------ настройки и расход
class LlmSettingsIn(BaseModel):
    provider: Literal["anthropic", "openai", "ollama"]
    anthropic_model: str = "claude-sonnet-5-5"
    openai_base_url: str = ""
    openai_model: str = ""
    ollama_url: str = ""
    ollama_model: str = ""


@router.get("/settings/llm")
async def get_llm(s: Session) -> dict[str, Any]:
    st = get_settings()
    return await llm_settings(s) | {"anthropic_key_set": bool(st.anthropic_api_key), "openai_key_set": bool(st.openai_api_key)}


@router.put("/settings/llm")
async def put_llm(body: LlmSettingsIn, s: Session) -> dict[str, Any]:
    row = await s.get(Setting, "llm")
    if row is None:
        s.add(Setting(key="llm", value=body.model_dump()))
    else:
        row.value = body.model_dump()
    await s.commit()
    return await get_llm(s)


@router.post("/settings/llm/test")
async def test_llm(s: Session) -> dict[str, Any]:
    try:
        prov = await get_provider(s)
        r = await prov.complete_json("Rispondi in JSON.", "Scrivi la parola italiana per 'apple'.", {"type": "object", "properties": {"word": {"type": "string"}}},
                                     purpose="test", max_tokens=200, effort="low")
    except LLMError as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True, "answer": r.data, "model": r.model, "cost_usd": r.cost_usd}


@router.get("/batches/{bid}/spell-report")
async def spell_report(bid: str) -> dict[str, Any]:
    """Орфография готовых роликов пачки: LanguageTool + Hunspell по итальянским фрагментам (приёмка этапа 3)."""
    from scripts.spell_report import build

    return await build(bid)


@router.get("/llm/usage")
async def usage(s: Session, days: int = 30) -> dict[str, Any]:
    since = utcnow() - timedelta(days=days)
    rows = (await s.execute(
        select(LlmCall.purpose, LlmCall.model, func.count(), func.sum(LlmCall.input_tokens), func.sum(LlmCall.output_tokens), func.sum(LlmCall.cost_usd))
        .where(LlmCall.created_at >= since).group_by(LlmCall.purpose, LlmCall.model)
    )).all()
    return {"days": days, "rows": [{"purpose": p, "model": m, "calls": c, "input_tokens": int(i or 0), "output_tokens": int(o or 0), "usd": round(float(u or 0), 4)}
                                   for p, m, c, i, o, u in rows]}
