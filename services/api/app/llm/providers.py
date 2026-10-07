"""LLMProvider: Anthropic (по умолчанию), OpenAI-совместимый endpoint, Ollama. Каждый вызов логируется в llm_calls с токенами и стоимостью."""
from __future__ import annotations

import abc
import copy
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

from ..db import SessionLocal
from ..models import LlmCall

log = logging.getLogger("farm.llm")

# $ за 1M токенов (вход, выход). Неизвестная модель — 0 (локальные модели бесплатны).
PRICES: dict[str, tuple[float, float]] = {
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-fable-5-1": (10.0, 50.0),
}


class LLMError(RuntimeError):
    pass


@dataclass
class LLMResult:
    data: Any
    input_tokens: int
    output_tokens: int
    cost_usd: float
    model: str


_DROP = {"$schema", "$id", "maxLength", "minLength", "minItems", "maxItems", "minimum", "maximum", "default", "title", "format", "pattern", "const"}


def to_output_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """JSON Schema проекта → схема для structured output: инлайним $ref, убираем неподдерживаемые ограничения
    (их всё равно проверяет Pydantic после ответа), закрываем объекты additionalProperties=false."""
    defs = schema.get("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node and str(node["$ref"]).startswith("#/$defs/"):
                return walk(copy.deepcopy(defs[node["$ref"][8:]]))
            if "const" in node and "enum" not in node:
                node = {**node, "enum": [node["const"]]}
            out = {k: walk(v) for k, v in node.items() if k not in _DROP and k != "$defs"}
            if out.get("type") == "object" or "properties" in out:
                out["additionalProperties"] = False
                out["required"] = list(out.get("properties", {}).keys())  # строгий режим: все поля обязательны
            return out
        if isinstance(node, list):
            return [walk(x) for x in node]
        return node

    return walk(schema)  # type: ignore[no-any-return]


class LLMProvider(abc.ABC):
    name: str
    model: str

    @abc.abstractmethod
    async def _complete(self, system: str, user: str, schema: dict[str, Any], max_tokens: int, effort: str) -> tuple[str, int, int]: ...

    async def complete_json(self, system: str, user: str, schema: dict[str, Any], *, purpose: str, video_id: str | None = None,
                            max_tokens: int = 8000, effort: str = "medium") -> LLMResult:
        t0 = time.monotonic()
        ok, err, it, ot = True, None, 0, 0
        try:
            text, it, ot = await self._complete(system, user, to_output_schema(schema), max_tokens, effort)
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                raise LLMError(f"Модель вернула не-JSON: {text[:200]}") from e
            return LLMResult(data=data, input_tokens=it, output_tokens=ot, cost_usd=self.cost(it, ot), model=self.model)
        except Exception as e:
            ok, err = False, str(e)[:1000]
            raise
        finally:
            await self._log(purpose, it, ot, int((time.monotonic() - t0) * 1000), ok, err, video_id)

    def cost(self, it: int, ot: int) -> float:
        pin, pout = PRICES.get(self.model, (0.0, 0.0))
        return round(it / 1e6 * pin + ot / 1e6 * pout, 6)

    async def _log(self, purpose: str, it: int, ot: int, ms: int, ok: bool, err: str | None, video_id: str | None) -> None:
        try:
            async with SessionLocal() as s:
                s.add(LlmCall(provider=self.name, model=self.model, purpose=purpose, input_tokens=it, output_tokens=ot, cost_usd=self.cost(it, ot),
                              duration_ms=ms, ok=ok, error=err, video_id=video_id))
                await s.commit()
        except Exception:  # noqa: BLE001 — учёт не должен ронять генерацию
            log.warning("llm_calls log failed", exc_info=True)


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str) -> None:
        import anthropic

        self.model = model
        self.client = anthropic.AsyncAnthropic(api_key=api_key, max_retries=3, timeout=300)

    async def _complete(self, system: str, user: str, schema: dict[str, Any], max_tokens: int, effort: str) -> tuple[str, int, int]:
        import anthropic

        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},  # type: ignore[arg-type]
                # серверный fallback: при ложном отказе классификатора запрос сам перезапускается на другой модели
                extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
                extra_body={"fallbacks": "default"},
            ) as stream:
                msg = await stream.get_final_message()
        except anthropic.AuthenticationError as e:
            raise LLMError("Ключ Anthropic не принят (проверь ANTHROPIC_API_KEY)") from e
        except anthropic.RateLimitError as e:
            raise LLMError("Anthropic: превышен лимит запросов, попробуй позже") from e
        except anthropic.APIStatusError as e:
            raise LLMError(f"Anthropic {e.status_code}: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise LLMError("Нет связи с Anthropic API") from e
        if msg.stop_reason == "refusal":
            raise LLMError("Модель отказалась отвечать на этот запрос")
        if msg.stop_reason == "max_tokens":
            raise LLMError("Ответ модели обрезан по max_tokens")
        text = next((b.text for b in msg.content if b.type == "text"), "")
        return text, msg.usage.input_tokens, msg.usage.output_tokens


class OpenAICompatProvider(LLMProvider):
    name = "openai"

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self.base, self.key, self.model = base_url.rstrip("/"), api_key, model

    async def _complete(self, system: str, user: str, schema: dict[str, Any], max_tokens: int, effort: str) -> tuple[str, int, int]:
        body = {
            "model": self.model, "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_schema", "json_schema": {"name": "out", "schema": schema, "strict": True}},
        }
        async with httpx.AsyncClient(timeout=300) as c:
            r = await c.post(f"{self.base}/chat/completions", json=body, headers={"Authorization": f"Bearer {self.key}"} if self.key else {})
        if r.status_code >= 400:
            raise LLMError(f"OpenAI-совместимый endpoint {r.status_code}: {r.text[:300]}")
        d = r.json()
        u = d.get("usage") or {}
        return d["choices"][0]["message"]["content"], int(u.get("prompt_tokens", 0)), int(u.get("completion_tokens", 0))


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, url: str, model: str) -> None:
        self.url, self.model = url.rstrip("/"), model

    async def _complete(self, system: str, user: str, schema: dict[str, Any], max_tokens: int, effort: str) -> tuple[str, int, int]:
        body = {"model": self.model, "stream": False, "format": schema, "options": {"num_predict": max_tokens, "temperature": 0.7},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        try:
            async with httpx.AsyncClient(timeout=600) as c:
                r = await c.post(f"{self.url}/api/chat", json=body)
        except httpx.HTTPError as e:
            raise LLMError(f"Ollama недоступна по {self.url}") from e
        if r.status_code >= 400:
            raise LLMError(f"Ollama {r.status_code}: {r.text[:300]}")
        d = r.json()
        return d["message"]["content"], int(d.get("prompt_eval_count", 0)), int(d.get("eval_count", 0))
