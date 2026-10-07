# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class EmojiItem(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    emoji: Annotated[str, Field(max_length=8, min_length=1)]
    word: Annotated[str, Field(max_length=20, min_length=1)]
    article: Annotated[
        str | None,
        Field(
            description="Артикль, если нужен: il, la, l'...", max_length=4, min_length=0
        ),
    ] = None


class EmojiVocabBody(BaseModel):
    """
    Come si dice? Эмодзи → слово, последнее скрыто.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    items: Annotated[list[EmojiItem], Field(max_length=9, min_length=4)]
