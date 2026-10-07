# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class FormatId(
    RootModel[Literal["list_mystery", "quiz_abc", "spot_the_error", "false_friends", "fill_blank", "level_ladder", "tongue_twister", "idiom", "emoji_vocab", "conjugation_challenge", "daily_word"]]
):
    root: Literal["list_mystery", "quiz_abc", "spot_the_error", "false_friends", "fill_blank", "level_ladder", "tongue_twister", "idiom", "emoji_vocab", "conjugation_challenge", "daily_word"]


class Canvas(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    w: Literal[1080]
    h: Literal[1920]
    fps: Literal[30]


class Palette(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str | None = None
    bg: str
    bg2: Annotated[
        str | None, Field(description="Второй цвет для градиента, null = однотонный")
    ] = None
    title_bg: str
    title_text: str
    left_bg: str
    left_text: str
    right_bg: str
    right_text: str
    highlight_bg: str
    highlight_text: str
    highlight_left_text: str
    accent: str


class Bookmark(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    enabled: bool | None = True
    position: Literal["top_right", "top_left", "mid_right"] | None = "top_right"


class StickerPlacement(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    x: float
    y: float
    size: float
    rotate: float | None = 0


class TimelineEvent(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    t_start: Annotated[float, Field(ge=0.0)]
    t_end: Annotated[float, Field(ge=0.0)]
    action: Literal["show_title", "hook", "highlight", "reveal", "countdown", "cta", "speak_slow", "speak_fast", "word"]
    target: int | str | None = None


class Sfx(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    t: Annotated[float, Field(ge=0.0)]
    name: Literal["pop", "tick", "ding", "whoosh", "buzz", "confetti"]
    volume: float | None = 0.5


class Audio(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    voice_url: str | None
    music_url: str | None = None
    music_volume: Annotated[float | None, Field(ge=0.0, le=1.0)] = 0.08
    sfx: Annotated[list[Sfx] | None, Field(validate_default=True)] = []
    envelope: Annotated[
        list[float] | None,
        Field(description="RMS-огибающая голоса по кадрам (0..1) для маскота"),
    ] = []


class Avatar(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    mode: Literal["none", "loop", "mascot", "lipsync"]
    src: str | None = None
    position: Literal["bottom_right", "bottom_left"] | None = "bottom_right"
    height: int | None = 620


class Theme(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    palette: Palette
    font: Literal["Montserrat", "Fredoka", "Nunito"]
    badge_shape: Literal["rounded", "square", "pill"]
    layout: Literal["center", "left"]
    stickers: Annotated[
        list[StickerPlacement] | None, Field(validate_default=True)
    ] = []
    bookmark: Bookmark | None = None
    watermark: str | None = "@ItalianoPerTe"
    show_progress_bar: bool | None = True
    second_lang: Annotated[
        str | None,
        Field(description="Язык подписей вторым языком (en, ru, uk, es) или null"),
    ] = None


class RenderProps(BaseModel):
    """
    Единый вход любой Remotion-композиции. Один и тот же JSON идёт в @remotion/player и в renderer.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    format: FormatId
    video_id: str | None = None
    series_id: str | None = None
    episode_no: Annotated[int | None, Field(ge=1)] = None
    canvas: Canvas
    theme: Theme
    hook_text: Annotated[str, Field(max_length=60)]
    title: Annotated[str, Field(max_length=60, min_length=1)]
    cta_text: Annotated[str | None, Field(max_length=80)] = ""
    body: Annotated[
        dict[str, Any],
        Field(
            description="Формат-специфичный объект, схема в schemas/formats/<format>.schema.json"
        ),
    ]
    timeline: list[TimelineEvent]
    audio: Audio
    avatar: Avatar
    loop_seamless: bool | None = True
    duration_s: Annotated[float, Field(ge=3.0, le=60.0)]
    asset_base: Annotated[
        str | None,
        Field(
            description="Префикс для относительных /media/... URL. Пусто в браузере, http://api:8000 в renderer."
        ),
    ] = ""
    seed: Annotated[int, Field(ge=0)]
    show_yt_overlay: Annotated[
        bool | None,
        Field(description="Только для превью: оверлей интерфейса YouTube Shorts."),
    ] = False
