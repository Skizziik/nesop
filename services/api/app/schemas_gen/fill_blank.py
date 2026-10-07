# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Option(RootModel[str]):
    root: Annotated[str, Field(max_length=18, min_length=1)]


class FillBlankBody(BaseModel):
    """
    Completa la frase: пропуск и варианты (предлоги, артикли).
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    sentence: Annotated[
        str,
        Field(
            description="Фраза с пропуском ___ (ровно один)",
            max_length=80,
            min_length=1,
        ),
    ]
    options: Annotated[list[Option], Field(max_length=4, min_length=2)]
    correct: Annotated[int, Field(ge=0, le=3)]
    translation: Annotated[
        str | None, Field(description="Перевод фразы", max_length=90, min_length=0)
    ] = None
    timer_s: Annotated[float | None, Field(ge=2.0, le=6.0)] = 3
    reveal: Annotated[bool | None, Field(description="Показать ответ в конце ролика")] = (
        True
    )
