# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class DailyWordBody(BaseModel):
    """
    Parola del giorno #N: слово, произношение, пример, номер эпизода.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    word: Annotated[str, Field(max_length=24, min_length=1)]
    article: Annotated[str | None, Field(max_length=4, min_length=0)] = None
    syllables: Annotated[
        str,
        Field(
            description="Деление на слоги с ударением, напр. «buon-GIOR-no»",
            max_length=40,
            min_length=1,
        ),
    ]
    part_of_speech: Literal["nome", "verbo", "aggettivo", "avverbio", "espressione", "altro"]
    translation: Annotated[
        str, Field(description="Перевод (2-й язык)", max_length=40, min_length=1)
    ]
    example: Annotated[str, Field(max_length=90, min_length=1)]
    example_translation: Annotated[str | None, Field(max_length=110, min_length=0)] = (
        None
    )
