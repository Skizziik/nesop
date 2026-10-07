# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ListItem(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    left: Annotated[str, Field(max_length=18, min_length=1)]
    right: Annotated[str, Field(max_length=20, min_length=1)]
    sub: Annotated[
        str | None, Field(description="Подпись вторым языком", max_length=28)
    ] = None


class ListMysteryBody(BaseModel):
    """
    Классика канала: столбик пар, последовательная подсветка, последняя строка спрятана.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    left_style: Annotated[
        Literal["badge", "dark"],
        Field(
            description="badge = бордовая плашка (числа), dark = чёрная (местоимения, EN-слова, артикли)"
        ),
    ]
    speak: Annotated[
        Literal["right", "both"],
        Field(description="Что озвучивать: только итальянское справа или пару целиком"),
    ]
    hide: Annotated[
        Literal["right", "left"],
        Field(description="Что спрятать в последней строке (??? справа или ?? слева)"),
    ]
    reveal: Annotated[
        bool | None,
        Field(
            description="Показать ответ в конце (по умолчанию нет: ответ уходит в комменты)"
        ),
    ] = False
    items: Annotated[list[ListItem], Field(max_length=12, min_length=4)]
