"""Этап 5: страница «Голоса» — модели TTS (через tts-сервис), профили голосов, тест, A/B со слепым голосованием."""
from __future__ import annotations

import random
from typing import Annotated, Any, Literal

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session, new_id
from ..models import Series, Setting, VoiceProfile
from ..pipeline.clients import ServiceError, tts_synthesize

router = APIRouter(prefix="/api")
Session = Annotated[AsyncSession, Depends(get_session)]
TEST_PHRASE = "Ciao! Oggi impariamo i numeri: uno, due, tre. E l'ultima? Scrivila nei commenti!"


async def _tts(method: str, path: str, **kw: Any) -> Any:
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.request(method, f"{get_settings().tts_url}{path}", **kw)
    except httpx.HTTPError as e:
        raise HTTPException(503, "Сервис озвучки недоступен") from e
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.json().get("detail", r.text[:300]) if r.headers.get("content-type", "").startswith("application/json") else r.text[:300])
    return r.json()


@router.get("/tts/models")
async def tts_models() -> Any:
    return await _tts("GET", "/models")


@router.get("/tts/hardware")
async def tts_hardware() -> Any:
    return await _tts("GET", "/hardware")


class InstallIn(BaseModel):
    voice: str | None = None


@router.post("/tts/models/{pid}/install")
async def tts_install(pid: str, body: InstallIn) -> Any:
    return await _tts("POST", f"/models/{pid}/install", json=body.model_dump())


@router.delete("/tts/models/{pid}")
async def tts_uninstall(pid: str, voice: str | None = None) -> Any:
    return await _tts("DELETE", f"/models/{pid}", params={"voice": voice} if voice else None)


# ------------------------------------------------------------------ профили голосов
def profile_out(p: VoiceProfile) -> dict[str, Any]:
    votes = p.votes or {}
    return {"id": p.id, "name": p.name, "kind": p.kind, "model": p.model, "voice": p.voice, "speed": p.speed, "description": p.description,
            "ref_audio": p.ref_audio_path, "ref_text": (p.votes or {}).get("_ref_text", ""), "consent": p.consent,
            "wins": int(votes.get("wins", 0)), "losses": int(votes.get("losses", 0)), "created_at": p.created_at.isoformat()}


def voice_cfg(p: VoiceProfile) -> dict[str, Any]:
    """Профиль → конфиг голоса для серии/ролика (то, что уходит в synth_track)."""
    cfg: dict[str, Any] = {"model": p.model, "voice": p.voice, "speed": p.speed, "profile_id": p.id}
    if p.kind == "clone" and p.ref_audio_path:
        cfg |= {"ref_audio": p.ref_audio_path, "ref_text": (p.votes or {}).get("_ref_text", "")}
    if p.kind == "design":
        cfg["design"] = p.description
    return cfg


@router.get("/voices")
async def list_profiles(s: Session) -> list[dict[str, Any]]:
    row = await s.get(Setting, "default_voice")
    cur = (row.value or {}).get("profile_id") if row else None
    return [profile_out(p) | {"is_default": p.id == cur} for p in (await s.scalars(select(VoiceProfile).order_by(VoiceProfile.created_at))).all()]


@router.post("/voices/{vid}/default")
async def make_default(vid: str, s: Session) -> dict[str, Any]:
    """Основной голос канала: им озвучиваются все серии и лекции, где голос не выбран отдельно."""
    p = await s.get(VoiceProfile, vid)
    if p is None:
        raise HTTPException(404, "Голос не найден")
    row = await s.get(Setting, "default_voice")
    if row is None:
        s.add(Setting(key="default_voice", value=voice_cfg(p)))
    else:
        row.value = voice_cfg(p)
    # серии начинают наследовать основной голос (свой голос серии можно задать снова кнопкой «Применить к сериям»)
    for ser in (await s.scalars(select(Series))).all():
        ser.voice = {}
    await s.commit()
    return profile_out(p) | {"is_default": True}


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["builtin", "design"] = "builtin"
    model: str
    voice: str = ""
    speed: float = Field(default=0.92, ge=0.6, le=1.3)
    description: str = Field(default="", max_length=500, description="Для voice design: описание голоса (англ.)")


@router.post("/voices", status_code=201)
async def create_profile(body: ProfileIn, s: Session) -> dict[str, Any]:
    if body.kind == "design" and len(body.description) < 10:
        raise HTTPException(400, "Опиши голос подробнее (пол, возраст, тембр, темп), например: warm young Italian female teacher, clear diction, slightly slow")
    p = VoiceProfile(**body.model_dump())
    s.add(p)
    await s.commit()
    return profile_out(p)


@router.post("/voices/clone", status_code=201)
async def create_clone(
    s: Session,
    file: Annotated[UploadFile, File()],
    name: Annotated[str, Form(min_length=1, max_length=120)],
    model: Annotated[str, Form()],
    consent: Annotated[bool, Form()],
    ref_text: Annotated[str, Form(max_length=1000)] = "",
    speed: Annotated[float, Form(ge=0.6, le=1.3)] = 0.92,
) -> dict[str, Any]:
    """Клон по образцу 10-30 сек. Без подтверждения согласия владельца голоса не создаётся."""
    if not consent:
        raise HTTPException(400, "Нужно подтвердить согласие владельца голоса")
    data = await file.read()
    if not 50_000 < len(data) < 30 * 1024 * 1024:
        raise HTTPException(400, "Нужен wav/mp3 длиной 10-30 секунд")
    pid = new_id()
    ext = ".wav" if (file.filename or "").lower().endswith(".wav") else ".mp3"
    rel = f"/voices/{pid}{ext}"
    dest = get_settings().data_dir / rel.lstrip("/")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    p = VoiceProfile(id=pid, name=name, kind="clone", model=model, voice="clone", speed=speed, ref_audio_path=rel, consent=True, votes={"_ref_text": ref_text})
    s.add(p)
    await s.commit()
    return profile_out(p)


@router.delete("/voices/{vid}")
async def delete_profile(vid: str, s: Session) -> dict[str, bool]:
    p = await s.get(VoiceProfile, vid)
    if p is None:
        raise HTTPException(404, "Голос не найден")
    if p.ref_audio_path:
        (get_settings().data_dir / p.ref_audio_path.lstrip("/")).unlink(missing_ok=True)
    await s.delete(p)
    await s.commit()
    return {"ok": True}


class TestIn(BaseModel):
    text: str = Field(default=TEST_PHRASE, min_length=1, max_length=300)
    profile_id: str | None = None
    model: str | None = None
    voice: str | None = None
    speed: float = 0.92


async def _synth_for(s: AsyncSession, body: TestIn) -> dict[str, Any]:
    if body.profile_id:
        p = await s.get(VoiceProfile, body.profile_id)
        if p is None:
            raise HTTPException(404, "Голос не найден")
        cfg = voice_cfg(p)
    else:
        if not body.model:
            raise HTTPException(400, "Укажи модель или профиль")
        cfg = {"model": body.model, "voice": body.voice, "speed": body.speed}
    try:
        r = await tts_synthesize(body.text, cfg["model"], cfg.get("voice"), float(cfg.get("speed", 1.0)), 0, cfg.get("ref_audio"), cfg.get("ref_text"), cfg.get("design"))
    except ServiceError as e:
        raise HTTPException(409, str(e)) from e
    return {"url": f"/media{r['path']}", "duration": r["duration"], "cfg": cfg}


@router.post("/voices/test")
async def test_voice(body: TestIn, s: Session) -> dict[str, Any]:
    return await _synth_for(s, body)


class AbIn(BaseModel):
    a: str
    b: str
    text: str = Field(default=TEST_PHRASE, max_length=300)


@router.post("/voices/ab")
async def ab(body: AbIn, s: Session) -> dict[str, Any]:
    """A/B: одна фраза двумя голосами в случайном порядке (слепое сравнение)."""
    pair = [body.a, body.b]
    random.shuffle(pair)
    out = []
    for pid in pair:
        out.append({"profile_id": pid, **(await _synth_for(s, TestIn(text=body.text, profile_id=pid)))})
    return {"left": out[0], "right": out[1]}


class VoteIn(BaseModel):
    winner: str
    loser: str


@router.post("/voices/vote")
async def vote(body: VoteIn, s: Session) -> dict[str, Any]:
    w, lo = await s.get(VoiceProfile, body.winner), await s.get(VoiceProfile, body.loser)
    if w is None or lo is None:
        raise HTTPException(404, "Голос не найден")
    w.votes = {**(w.votes or {}), "wins": int((w.votes or {}).get("wins", 0)) + 1}
    lo.votes = {**(lo.votes or {}), "losses": int((lo.votes or {}).get("losses", 0)) + 1}
    await s.commit()
    return {"winner": profile_out(w), "loser": profile_out(lo)}


class ApplyIn(BaseModel):
    series_ids: list[str] = Field(min_length=1)


@router.post("/voices/{vid}/apply")
async def apply_to_series(vid: str, body: ApplyIn, s: Session) -> dict[str, Any]:
    """Сделать голос голосом по умолчанию для серий."""
    p = await s.get(VoiceProfile, vid)
    if p is None:
        raise HTTPException(404, "Голос не найден")
    rows = (await s.scalars(select(Series).where(Series.id.in_(body.series_ids)))).all()
    for ser in rows:
        ser.voice = voice_cfg(p)
    await s.commit()
    return {"ok": True, "updated": len(rows)}
