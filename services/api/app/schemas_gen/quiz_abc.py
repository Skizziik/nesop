# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Option(RootModel[str]):
    root: Annotated[str, Field(max_length=28, min_length=1)]


class QuizAbcBody(BaseModel):
    """
    Вопрос и три варианта A/B/C, кольцо-таймер, затем ответ с конфетти (или ответ только в комментах).
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    question: Annotated[
        str,
        Field(
            description='Вопрос, напр. «Come si dice "cucchiaio" in inglese?»',
            max_length=90,
            min_length=1,
        ),
    ]
    spoken_question: Annotated[
        str | None,
        Field(
            description="Что говорит голос (пусто = question)",
            max_length=120,
            min_length=0,
        ),
    ] = None
    options: Annotated[list[Option], Field(max_length=3, min_length=3)]
    correct: Annotated[int, Field(ge=0, le=2)]
    timer_s: Annotated[float | None, Field(ge=2.0, le=6.0)] = 3
    reveal: Annotated[bool | None, Field(description="Показать ответ в конце ролика")] = (
        True
    )
    explanation: Annotated[
        str | None,
        Field(
            description="Короткое пояснение после ответа", max_length=90, min_length=0
        ),
    ] = None
    question_lang: Annotated[
        Literal["it", "en", "ru", "uk", "es"] | None, Field(description="Язык вопроса")
    ] = "it"
    options_lang: Annotated[
        Literal["it", "en", "ru", "uk", "es"] | None,
        Field(description="Язык вариантов"),
    ] = "it"
