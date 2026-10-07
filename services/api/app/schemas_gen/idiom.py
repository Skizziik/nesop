# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class IdiomBody(BaseModel):
    """
    Espressioni: буквальный смысл vs реальный, затем вопрос со скрытым ответом.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    idiom: Annotated[str, Field(description="Выражение", max_length=50, min_length=1)]
    literal: Annotated[
        str,
        Field(description="Буквальный перевод (2-й язык)", max_length=60, min_length=1),
    ]
    meaning: Annotated[
        str, Field(description="Реальный смысл (2-й язык)", max_length=60, min_length=1)
    ]
    question: Annotated[
        str | None,
        Field(
            description="Вопрос-продолжение, напр. «E cosa si risponde?»",
            max_length=60,
            min_length=0,
        ),
    ] = None
    answer: Annotated[
        str | None,
        Field(description="Скрытый ответ, напр. «Crepi!»", max_length=40, min_length=0),
    ] = None
    example: Annotated[
        str | None,
        Field(description="Пример употребления", max_length=90, min_length=0),
    ] = None
