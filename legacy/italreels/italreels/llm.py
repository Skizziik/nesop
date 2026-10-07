"""Генерация новых уроков через LLM (Claude API или локальная Ollama).
Модель возвращает JSON в той же схеме, что lessons/bank.yaml."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent

PROMPT = """You create content for a YouTube Shorts channel that teaches Italian (ItalianoPerTe).
Each Short is ONE vertical card: a title and a list of pairs. The narrator reads the list;
the LAST row is a quiz: one side is hidden as ??? and viewers answer in the comments.

Return ONLY a JSON object, no markdown, no comments, with this exact schema:
{{
  "id": "kebab-case-unique-id",
  "title": "short Italian title, max 28 chars",
  "left_style": "badge" | "dark",
  "speak": "right" | "both",
  "hide": "right" | "left",
  "items": [["left", "right"], ...]
}}

Rules:
- 6 to 10 items. Every string max 18 characters.
- Lesson types you can use:
  * numbers: left = digits, right = Italian word, left_style "badge", speak "right"
  * verb conjugation: left = io/tu/lui/lei/noi/voi/loro (write "lui/lei"), right = verb form, left_style "dark", speak "both"
  * vocabulary: left = English word, right = Italian word, left_style "dark", speak "right"
  * articles: left = article (il/lo/la/l'/i/gli/le), right = noun, speak "both", hide "left"
  * pairs (opposites, singular/plural, masc/fem): left and right both Italian, speak "both"
- Italian must be 100% correct, with proper accents (è, più, città, perché, può, caffè).
- Make the last item slightly tricky but fair for a beginner (A1-A2).
- Do not repeat these existing lesson ids or topics: {existing}

Topic request: {topic}
"""


def _extract_json(text: str) -> dict:
    text = re.sub(r"```(?:json)?", "", text).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("LLM не вернула JSON:\n" + text[:500])
    return json.loads(m.group(0))


def generate_lesson(topic: str, cfg: dict, existing_ids: list[str]) -> dict:
    prompt = PROMPT.format(topic=topic or "pick a useful new beginner topic yourself",
                           existing=", ".join(existing_ids) or "none")
    lcfg = cfg["llm"]
    if lcfg.get("provider") == "ollama":
        r = requests.post(f"{lcfg['ollama_url']}/api/generate", timeout=300, json={
            "model": lcfg["ollama_model"], "prompt": prompt, "stream": False, "format": "json",
            "options": {"temperature": 0.7},
        })
        r.raise_for_status()
        return _extract_json(r.json()["response"])

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("Нет ANTHROPIC_API_KEY в переменных окружения (или переключи llm.provider на ollama)")
    r = requests.post("https://api.anthropic.com/v1/messages", timeout=120, headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
    }, json={
        "model": lcfg.get("claude_model", "claude-sonnet-5-5"), "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
    })
    r.raise_for_status()
    text = "".join(b.get("text", "") for b in r.json()["content"])
    return _extract_json(text)


def save_generated(lesson: dict) -> Path:
    """Добавляет урок в lessons/generated.yaml (чтобы его можно было поправить руками)."""
    p = ROOT / "lessons" / "generated.yaml"
    data = yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else []
    data = data or []
    data.append(lesson)
    p.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=None),
                 encoding="utf-8")
    return p
