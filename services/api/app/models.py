"""ORM. Схема полная с первой миграции: таблицы поздних этапов (публикации, аналитика, голоса) уже здесь, фичи — за флагами."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, IdMixin, TimestampMixin, utcnow

Json = JSON().with_variant(JSONB(), "postgresql")


class VideoStatus(enum.StrEnum):
    idea = "idea"
    script = "script"
    needs_review = "needs_review"
    verified = "verified"
    approved = "approved"
    rendering = "rendering"
    ready = "ready"
    failed = "failed"
    scheduled = "scheduled"
    published = "published"


class AnswerMode(enum.StrEnum):
    hide = "hide"  # ответ только в комментах
    reveal = "reveal"  # показать в конце ролика
    answer_tomorrow = "answer_tomorrow"  # закреп через N часов / кадр в следующем ролике


class Series(IdMixin, TimestampMixin, Base):
    __tablename__ = "series"
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    format: Mapped[str] = mapped_column(String(40), index=True)
    level: Mapped[str] = mapped_column(String(4), default="A1")
    topic: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    palettes: Mapped[list[str]] = mapped_column(Json, default=list)
    fonts: Mapped[list[str]] = mapped_column(Json, default=lambda: ["Montserrat"])
    voice: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)  # {model, voice, speed}
    avatar: Mapped[dict[str, Any]] = mapped_column(Json, default=lambda: {"mode": "none"})
    hook_type: Mapped[str] = mapped_column(String(30), default="hidden_answer")
    answer_mode: Mapped[AnswerMode] = mapped_column(Enum(AnswerMode, native_enum=False, length=20), default=AnswerMode.hide)
    answer_delay_h: Mapped[int] = mapped_column(Integer, default=24)
    second_lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    episode_counter: Mapped[int] = mapped_column(Integer, default=0)
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False)
    youtube_playlist_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    schedule: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    settings: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    lessons: Mapped[list[Lesson]] = relationship(back_populates="series", cascade="all, delete-orphan")


class Lesson(IdMixin, TimestampMixin, Base):
    """Банк уроков серии: готовый к рендеру скрипт (сид, LLM, ручной)."""

    __tablename__ = "lessons"
    __table_args__ = (UniqueConstraint("series_id", "slug"),)
    series_id: Mapped[str] = mapped_column(ForeignKey("series.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(120))
    script: Mapped[dict[str, Any]] = mapped_column(Json)
    source: Mapped[str] = mapped_column(String(20), default="seed")  # seed | legacy | llm | manual
    content_hash: Mapped[str] = mapped_column(String(40), index=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    series: Mapped[Series] = relationship(back_populates="lessons")


class Batch(IdMixin, TimestampMixin, Base):
    __tablename__ = "batches"
    series_id: Mapped[str | None] = mapped_column(ForeignKey("series.id", ondelete="SET NULL"), nullable=True)
    requested: Mapped[int] = mapped_column(Integer)
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | done | partial | failed
    similarity_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")


class Video(IdMixin, TimestampMixin, Base):
    __tablename__ = "videos"
    series_id: Mapped[str | None] = mapped_column(ForeignKey("series.id", ondelete="SET NULL"), nullable=True, index=True)
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True)
    batch_id: Mapped[str | None] = mapped_column(ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_id: Mapped[str | None] = mapped_column(String(32), nullable=True)  # «сделать похожие на этот», A/B
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus, native_enum=False, length=20), default=VideoStatus.idea, index=True)
    format: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    idea: Mapped[str] = mapped_column(Text, default="")
    script: Mapped[dict[str, Any] | None] = mapped_column(Json, nullable=True)
    render_props: Mapped[dict[str, Any] | None] = mapped_column(Json, nullable=True)
    seed: Mapped[int] = mapped_column(Integer, default=0)
    episode_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    variant: Mapped[str] = mapped_column(String(1), default="A")
    palette_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    hook_pattern_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    cta_pattern_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    voice: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    issues: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list)
    meta: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)  # title A/B, description, tags, pinned_comment...
    content_hash: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    stage: Mapped[str] = mapped_column(String(30), default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    out_dir: Mapped[str | None] = mapped_column(String(300), nullable=True)  # относительно /data
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    published_manually: Mapped[bool] = mapped_column(Boolean, default=False)
    published_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    answer_reveal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    answer_comment_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | posted | pinned | n/a


class JobEvent(IdMixin, Base):
    """Trace пайплайна: каждый этап каждой задачи."""

    __tablename__ = "job_events"
    video_id: Mapped[str | None] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), nullable=True, index=True)
    batch_id: Mapped[str | None] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), nullable=True, index=True)
    stage: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(10))  # start | ok | error | info
    message: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class HookPattern(IdMixin, TimestampMixin, Base):
    """Библиотека хуков (kind=hook) и фраз-призывов (kind=cta)."""

    __tablename__ = "hook_patterns"
    __table_args__ = (UniqueConstraint("kind", "text"),)
    kind: Mapped[str] = mapped_column(String(10), default="hook")  # hook | cta
    text: Mapped[str] = mapped_column(String(120))
    spoken: Mapped[str] = mapped_column(String(160), default="")
    type: Mapped[str] = mapped_column(String(30), default="hidden_answer")
    lang: Mapped[str] = mapped_column(String(5), default="it")
    format: Mapped[str | None] = mapped_column(String(40), nullable=True)  # null = любой формат
    answer_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(20), default="seed")
    metrics: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)


class Asset(IdMixin, TimestampMixin, Base):
    __tablename__ = "assets"
    kind: Mapped[str] = mapped_column(String(20), index=True)  # font | palette | sticker | music | sfx | avatar | mascot
    name: Mapped[str] = mapped_column(String(120))
    path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    license: Mapped[str] = mapped_column(String(120), default="")
    source: Mapped[str] = mapped_column(String(300), default="")
    attribution: Mapped[str] = mapped_column(String(300), default="")
    data: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class VoiceProfile(IdMixin, TimestampMixin, Base):
    __tablename__ = "voice_profiles"
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20), default="builtin")  # builtin | design | clone
    model: Mapped[str] = mapped_column(String(40))
    voice: Mapped[str] = mapped_column(String(120))
    speed: Mapped[float] = mapped_column(Float, default=0.92)
    description: Mapped[str] = mapped_column(Text, default="")
    ref_audio_path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    votes: Mapped[dict[str, Any]] = mapped_column(Json, default=dict)


class LlmCall(IdMixin, Base):
    __tablename__ = "llm_calls"
    provider: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(80))
    purpose: Mapped[str] = mapped_column(String(40))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[Any] = mapped_column(Json)


class Publication(IdMixin, TimestampMixin, Base):
    """Этап 7: автозагрузка (YOUTUBE_UPLOAD_ENABLED)."""

    __tablename__ = "publications"
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(20), default="youtube")
    status: Mapped[str] = mapped_column(String(20), default="planned")  # planned | uploading | scheduled | published | failed
    planned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    quota_units: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class AnalyticsSnapshot(IdMixin, Base):
    """Этап 8: метрики YouTube Analytics по роликам."""

    __tablename__ = "analytics_snapshots"
    video_id: Mapped[str | None] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), nullable=True, index=True)
    external_id: Mapped[str] = mapped_column(String(64), index=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    avg_view_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    swipe_away_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    retention: Mapped[list[float]] = mapped_column(Json, default=list)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChannelTitle(IdMixin, Base):
    """Этап 8: названия уже опубликованных шортсов канала (для дедупа)."""

    __tablename__ = "channel_titles"
    title: Mapped[str] = mapped_column(String(200))
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
