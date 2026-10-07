# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CommentHook(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["hidden_answer", "abc", "level", "challenge", "native_language", "debate", "streak"]
    text: Annotated[str, Field(max_length=80)]
    spoken: Annotated[str | None, Field(max_length=80)] = ""


class Script(BaseModel):
    """
    Скрипт ролика: то, что генерирует LLM / лежит в банке / правится в редакторе. body проверяется схемой формата.
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    format: Literal["list_mystery", "quiz_abc", "spot_the_error", "false_friends", "fill_blank", "level_ladder", "tongue_twister", "idiom", "emoji_vocab", "conjugation_challenge", "daily_word"]
    title: Annotated[str, Field(max_length=60, min_length=1)]
    hook_text: Annotated[str | None, Field(max_length=60)] = ""
    spoken_hook: Annotated[
        str | None,
        Field(
            description="Что голос говорит в первые 1.5 сек; пусто = hook_text",
            max_length=80,
        ),
    ] = ""
    comment_hook: CommentHook | None = None
    level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] | None = "A1"
    topic: str | None = ""
    body: dict[str, Any]
