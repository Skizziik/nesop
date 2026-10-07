# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class SpotTheErrorBody(BaseModel):
    """
    Trova l'errore: фраза с типичной ошибкой, таймер, затем зачёркивание и правильный вариант.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    sentence: Annotated[
        str,
        Field(
            description="Фраза с ОДНОЙ типичной ошибкой иностранца",
            max_length=80,
            min_length=1,
        ),
    ]
    wrong: Annotated[
        str,
        Field(
            description="Ошибочный фрагмент ровно как в sentence",
            max_length=30,
            min_length=1,
        ),
    ]
    right: Annotated[
        str,
        Field(description="Правильный вариант фрагмента", max_length=30, min_length=1),
    ]
    category: Literal["articoli", "preposizioni", "ausiliare", "accordo", "verbi", "pronomi", "altro"]
    explanation: Annotated[
        str | None,
        Field(description="Почему так (коротко)", max_length=90, min_length=0),
    ] = None
    timer_s: Annotated[float | None, Field(ge=2.0, le=6.0)] = 3
    reveal: Annotated[bool | None, Field(description="Показать ответ в конце ролика")] = (
        True
    )
