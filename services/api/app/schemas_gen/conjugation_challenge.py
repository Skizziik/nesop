# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Form(RootModel[str]):
    root: Annotated[str, Field(max_length=22, min_length=1)]


class HiddenItem(RootModel[int]):
    root: Annotated[int, Field(ge=0, le=5)]


class ConjugationChallengeBody(BaseModel):
    """
    Таблица спряжения, одна-две формы скрыты (не обязательно последняя).
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    verb: Annotated[str, Field(max_length=20, min_length=1)]
    tense: Annotated[
        str,
        Field(
            description="Время, напр. «presente», «passato prossimo»",
            max_length=30,
            min_length=1,
        ),
    ]
    forms: Annotated[
        list[Form],
        Field(
            description="io, tu, lui/lei, noi, voi, loro", max_length=6, min_length=6
        ),
    ]
    hidden: Annotated[
        list[HiddenItem],
        Field(description="Какие формы спрятать", max_length=2, min_length=1),
    ]
    reveal: bool | None = False
