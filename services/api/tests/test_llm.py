"""Этап 3 с моком LLM: схема для structured output, нормализация, конвейер идея → скрипт → проверки, Hunspell."""
from __future__ import annotations

import json
from typing import Any

import pytest
from sqlalchemy import select

from app import checks
from app.llm import generate
from app.llm.providers import LLMProvider, to_output_schema
from app.models import Batch, LlmCall, Series, Video, VideoStatus
from app.pipeline import ideas as ideas_mod
from app.seeds import seed_all


class FakeLLM(LLMProvider):
    """Отвечает по purpose; script сначала возвращает невалидное, чтобы проверить ретрай."""

    name = "fake"
    model = "claude-sonnet-5-5"

    def __init__(self) -> None:
        self.script_calls = 0

    async def _complete(self, system: str, user: str, schema: dict[str, Any], max_tokens: int, effort: str) -> tuple[str, int, int]:
        if "idee NUOVE" in user:
            data: Any = {"ideas": [{"title": "Avere: presente", "topic": "verbi", "angle": "последняя форма", "level": "A1"},
                                   {"title": "Stare: presente", "topic": "verbi", "angle": "stanno", "level": "A1"}]}
        elif "Scrivi lo script" in user:
            self.script_calls += 1
            if self.script_calls == 1:
                data = {"title": "Avere: presente", "topic": "verbi", "level": "A1", "body": {"left_style": "dark", "speak": "both", "hide": "right", "reveal": False,
                        "items": [{"left": "io", "right": "ho", "sub": None}]}}  # слишком мало строк → ретрай
            else:
                verb = "avere" if "Avere" in user else "stare"
                forms = {"avere": ["ho", "hai", "ha", "abbiamo", "avete", "hanno"], "stare": ["sto", "stai", "sta", "stiamo", "state", "stanno"]}[verb]
                data = {"title": f"{verb.capitalize()}: presente", "topic": "verbi", "level": "A1",
                        "body": {"left_style": "dark", "speak": "both", "hide": "right", "reveal": False,
                                 "items": [{"left": p, "right": f, "sub": None} for p, f in zip(["io", "tu", "lui / lei", "noi", "voi", "loro"], forms, strict=True)]}}
        elif "revisore" in system:
            data = {"ok": True, "issues": [], "fixed_body_json": ""}
        else:
            data = {}
        return json.dumps(data, ensure_ascii=False), 100, 50


def test_output_schema_inlines_refs_and_strips_limits() -> None:
    src = json.loads((generate.get_settings().schemas_dir / "formats" / "list_mystery.schema.json").read_text(encoding="utf-8"))
    out = to_output_schema(src)
    items = out["properties"]["items"]
    assert "$ref" not in json.dumps(out) and "$defs" not in out
    assert "maxItems" not in items and "maxLength" not in json.dumps(out)
    assert items["items"]["additionalProperties"] is False
    assert set(out["required"]) == set(out["properties"])
    env = to_output_schema({"type": "object", "title": "Env", "properties": {"title": {"type": "string", "maxLength": 60}, "body": src}, "$defs": src.get("$defs", {})})
    assert "title" in env["properties"] and "title" in env["required"]  # поле «title» не путаем с ключевым словом схемы
    assert "title" not in env and "maxLength" not in env["properties"]["title"]


def test_normalize_body() -> None:
    assert generate.normalize_body({"items": [{"left": "lui / lei", "right": "l’acqua  fresca "}]}) == {"items": [{"left": "lui/lei", "right": "l'acqua fresca"}]}


def test_hunspell_flags_typo() -> None:
    if checks._dictionary() is None:
        pytest.skip("hunspell-it не установлен")
    found = checks.hunspell_check([("body.items.7.right", "diciasssette"), ("body.items.0.right", "dell'anno"), ("body.items.1.right", "città")])
    assert [i["field"] for i in found] == ["body.items.7.right"]  # опечатка DICIASSSETTE из старых роликов ловится


async def test_ideas_pipeline_with_fake_llm(session, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    fake = FakeLLM()

    async def provider(_: Any) -> LLMProvider:
        return fake

    monkeypatch.setattr(generate, "get_provider", provider)

    async def no_lt(_: Any) -> list[dict[str, str]]:
        return []

    monkeypatch.setattr(checks, "languagetool_check", no_lt)
    await seed_all(session)
    ser = (await session.scalars(select(Series).where(Series.slug == "verbi-presente"))).one()
    b = Batch(series_id=ser.id, requested=2, auto_approve=True, note="llm")
    session.add(b)
    await session.commit()
    approved = await ideas_mod.run_ideas(b.id)
    vids = list((await session.scalars(select(Video).where(Video.batch_id == b.id).execution_options(populate_existing=True))).all())
    assert len(vids) == 2
    for v in vids:
        assert v.script and v.script["body"]["items"][2]["left"] == "lui/lei"  # нормализовано
        assert v.script["hook_text"] and v.palette_name and v.episode_no
        assert not [i for i in v.issues if i["severity"] == "error"], v.issues
    assert sorted(approved) == sorted(v.id for v in vids) and all(v.status == VideoStatus.approved for v in vids)
    assert fake.script_calls >= 3  # был ретрай после невалидного ответа
    calls = (await session.scalars(select(LlmCall).where(LlmCall.provider == "fake"))).all()
    assert calls and all(c.cost_usd > 0 for c in calls)  # стоимость считается по прайсу модели
