from __future__ import annotations

from typing import Any

from .models import Batch, JobEvent, Lesson, Series, Video


def _dt(x: Any) -> str | None:
    return x.isoformat() if x else None


def media_url(rel: str | None, name: str) -> str | None:
    return f"/media{rel}/{name}" if rel else None


def series_out(s: Series, counts: dict[str, int] | None = None) -> dict[str, Any]:
    return {
        "id": s.id, "slug": s.slug, "name": s.name, "format": s.format, "level": s.level, "topic": s.topic, "description": s.description,
        "palettes": s.palettes, "fonts": s.fonts, "voice": s.voice, "avatar": s.avatar, "hook_type": s.hook_type, "answer_mode": s.answer_mode.value,
        "answer_delay_h": s.answer_delay_h, "second_lang": s.second_lang, "episode_counter": s.episode_counter, "auto_approve": s.auto_approve,
        "youtube_playlist_id": s.youtube_playlist_id, "archived": s.archived, "created_at": _dt(s.created_at), **({"counts": counts} if counts is not None else {}),
    }


def lesson_out(x: Lesson) -> dict[str, Any]:
    return {"id": x.id, "series_id": x.series_id, "slug": x.slug, "title": x.title, "script": x.script, "source": x.source, "used_count": x.used_count}


def video_out(v: Video, full: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": v.id, "series_id": v.series_id, "batch_id": v.batch_id, "status": v.status.value, "format": v.format, "title": v.title,
        "episode_no": v.episode_no, "palette": v.palette_name, "progress": v.progress, "stage": v.stage, "error": v.error,
        "duration_s": v.duration_s, "issues": v.issues, "meta": v.meta, "hook_text": (v.script or {}).get("hook_text", ""),
        "video_url": media_url(v.out_dir, "video.mp4") if v.status.value in ("ready", "scheduled", "published") else None,
        "cover_url": media_url(v.out_dir, "cover.png") if v.out_dir else None,
        "published_manually": v.published_manually, "published_url": v.published_url, "answer_comment_status": v.answer_comment_status,
        "answer_reveal_at": _dt(v.answer_reveal_at), "created_at": _dt(v.created_at), "updated_at": _dt(v.updated_at),
    }
    if full:
        out |= {"script": v.script, "render_props": v.render_props, "seed": v.seed, "voice": v.voice, "out_dir": v.out_dir}
    return out


def batch_out(b: Batch, counts: dict[str, int] | None = None) -> dict[str, Any]:
    return {"id": b.id, "series_id": b.series_id, "requested": b.requested, "auto_approve": b.auto_approve, "status": b.status,
            "similarity_index": b.similarity_index, "created_at": _dt(b.created_at), "counts": counts or {}}


def event_out(e: JobEvent) -> dict[str, Any]:
    return {"id": e.id, "stage": e.stage, "status": e.status, "message": e.message, "data": e.data, "duration_ms": e.duration_ms, "created_at": _dt(e.created_at)}
