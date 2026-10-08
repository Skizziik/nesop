# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TlCanvas(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    w: Literal[1920, 1080]
    h: Literal[1080, 1920]
    fps: Literal[30]


class SubtitleStyle(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    size: float | None = 46
    y: Annotated[
        float | None, Field(description="Вертикаль центра субтитров (доля высоты)")
    ] = 0.88
    x: Annotated[
        float | None,
        Field(
            description="Горизонталь центра субтитров (доля ширины) — чтобы не наезжать на маскота"
        ),
    ] = 0.5
    max_w: Annotated[
        float | None,
        Field(description="Максимальная ширина блока субтитров (доля ширины)"),
    ] = 0.88
    color: str | None = "#FFFFFF"
    bg: str | None = "rgba(0,0,0,0.6)"
    show_translation: bool | None = True
    highlight_words: Annotated[
        bool | None, Field(description="Караоке: подсветка текущего слова")
    ] = True


class Clip(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    type: Literal["slide", "short", "text", "subtitle", "mascot", "sticker", "image", "video", "audio", "shape"]
    start: Annotated[float, Field(ge=0.0)]
    duration: Annotated[float, Field(ge=0.05)]
    trim: Annotated[
        float | None,
        Field(description="Сдвиг начала медиа (обрезка слева), сек", ge=0.0),
    ] = 0
    x: float | None = 0
    y: float | None = 0
    w: float | None = 1
    h: float | None = 1
    rotation: float | None = 0
    opacity: Annotated[float | None, Field(ge=0.0, le=1.0)] = 1
    anim_in: Literal["none", "fade", "pop", "slide_up", "slide_left", "zoom"] | None = (
        "none"
    )
    anim_out: (
        Literal["none", "fade", "pop", "slide_up", "slide_left", "zoom"] | None
    ) = "none"
    label: str | None = ""
    props: Annotated[dict[str, Any] | None, Field(description="Свойства по типу клипа: см. packages/templates/src/timeline/types.ts")] = {

    }


class Track(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    kind: Literal["scene", "overlay", "subtitle", "mascot", "audio"]
    name: str
    hidden: bool | None = False
    muted: bool | None = False
    locked: bool | None = False
    clips: list[Clip]


class TimelineDoc(BaseModel):
    """
    Проект-таймлайн: дорожки с клипами. Генерирует LLM (длинные лекции), правит видеоредактор, рендерит композиция Timeline. Время — в секундах, геометрия — доли холста (0..1).
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    version: Literal[1]
    title: Annotated[str, Field(max_length=200)]
    canvas: TlCanvas
    duration_s: Annotated[float, Field(ge=1.0, le=3600.0)]
    background: Annotated[
        str | None, Field(description="Цвет фона под всеми дорожками")
    ] = "#1B1035"
    palette: Annotated[
        dict[str, Any] | None,
        Field(
            description="Палитра (как в RenderProps.theme.palette) для слайдов и текста"
        ),
    ] = None
    font: Literal["Montserrat", "Fredoka", "Nunito"] | None = "Montserrat"
    subtitle_style: SubtitleStyle | None = None
    tracks: list[Track]
    envelope: Annotated[
        list[float] | None,
        Field(description="RMS голоса по кадрам (0..1) — рот маскотов"),
    ] = []
    asset_base: str | None = ""
    seed: int | None = 0
    show_safe_area: Annotated[bool | None, Field(description="Только для редактора")] = (
        False
    )
