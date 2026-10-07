# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class TongueTwisterBody(BaseModel):
    """
    Scioglilingua: медленно по словам с подсветкой, затем быстро. Челлендж «Riesci a dirlo 3 volte?».
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    text: Annotated[
        str, Field(description="Скороговорка", max_length=120, min_length=1)
    ]
    translation: Annotated[str | None, Field(max_length=120, min_length=0)] = None
    slow_speed: Annotated[float | None, Field(ge=0.6, le=1.0)] = 0.8
    fast_speed: Annotated[float | None, Field(ge=1.0, le=1.5)] = 1.25
