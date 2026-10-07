# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Step(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    level: Literal["A1", "A2", "B1", "B2", "C1", "C2"]
    text: Annotated[str, Field(max_length=30, min_length=1)]
    note: Annotated[
        str | None, Field(description="Перевод/оттенок", max_length=28, min_length=0)
    ] = None


class LevelLadderBody(BaseModel):
    """
    Da A1 a C2: одно понятие на разных уровнях. Хук «Che livello sei?».
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    concept: Annotated[
        str,
        Field(
            description="Понятие, напр. «bello» или «Sono stanco»",
            max_length=30,
            min_length=1,
        ),
    ]
    concept_translation: Annotated[str | None, Field(max_length=30, min_length=0)] = (
        None
    )
    steps: Annotated[list[Step], Field(max_length=6, min_length=4)]
