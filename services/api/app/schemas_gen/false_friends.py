# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class FalseFriend(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    it: Annotated[
        str, Field(description="Итальянское слово", max_length=16, min_length=1)
    ]
    looks_like: Annotated[
        str, Field(description="Похожее иностранное слово", max_length=16, min_length=1)
    ]
    it_means: Annotated[
        str,
        Field(
            description="Что на самом деле значит итальянское слово (на языке lang)",
            max_length=26,
            min_length=1,
        ),
    ]
    say_instead: Annotated[
        str,
        Field(
            description="Как по-итальянски сказать looks_like",
            max_length=20,
            min_length=1,
        ),
    ]


class FalseFriendsBody(BaseModel):
    """
    Falsi amici: CAMERA ≠ camera. Последний пример спрятан.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    lang: Annotated[
        Literal["en"] | None, Field(description="Язык, с которым «ложная дружба»")
    ] = "en"
    items: Annotated[list[FalseFriend], Field(max_length=6, min_length=3)]
