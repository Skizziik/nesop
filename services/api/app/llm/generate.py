"""Генерация через LLM: идеи, скрипты, проверка «строгим преподавателем», метаданные, наполнение банка."""
from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..formats import get_format
from ..models import HookPattern, Lesson, Series, Setting, Video
from .providers import AnthropicProvider, LLMError, LLMProvider, OllamaProvider, OpenAICompatProvider

FORMAT_GUIDES: dict[str, str] = {
    "list_mystery": (
        "Formato «list_mystery»: un titolo e 4-12 righe a coppie (sinistra → destra). Le righe vengono evidenziate una alla volta mentre la voce le legge; "
        "l'ULTIMA riga è nascosta (??? a destra oppure ?? a sinistra) e lo spettatore scrive la risposta nei commenti. "
        "left_style: 'badge' SOLO se a sinistra ci sono numeri, altrimenti 'dark'. "
        "speak: 'right' se a sinistra c'è inglese o un numero (la voce legge solo l'italiano a destra); 'both' se entrambe le colonne sono in italiano "
        "(pronome + verbo, articolo + nome, singolare + plurale, contrari). hide: 'right' di solito; 'left' quando la sfida è indovinare la parte sinistra (es. l'articolo). "
        "Limiti: sinistra ≤ 18 caratteri, destra ≤ 20 caratteri. Scrivi le forme alternative con lo slash senza spazi: «lui/lei», «andato/a». "
        "L'ultima riga deve essere la più interessante ma risolvibile da chi ha guardato le precedenti (stesso schema, un po' più difficile). "
        "IMPORTANTE: scrivi anche nell'ultima riga la risposta VERA (mai «???»): è il video a nasconderla, e la risposta serve per il commento fissato."
    ),
    "quiz_abc": (
        "Formato «quiz_abc»: una domanda breve (≤ 90 caratteri) e ESATTAMENTE 3 opzioni (≤ 28 caratteri), una sola giusta (indice correct 0-2). "
        "I distrattori devono essere errori plausibili che fanno davvero gli stranieri, non assurdi. La domanda è in italiano o in inglese (question_lang it/en), le "
        "opzioni in italiano (o en se si chiede il significato)."
    ),
    "fill_blank": (
        "Formato «fill_blank»: una frase naturale con UN solo vuoto scritto «___», 2-4 opzioni brevi, una giusta (correct). "
        "Ideale per preposizioni e articoli. translation: traduzione inglese della frase completa."
    ),
    "spot_the_error": (
        "Formato «spot_the_error»: una frase con UN SOLO errore tipico di uno straniero (articoli, preposizioni, ausiliare essere/avere nel passato prossimo, "
        "accordo, congiuntivo), NON un refuso. wrong = il frammento sbagliato ESATTAMENTE come appare nella frase, right = la correzione. "
        "La frase corretta (sentence con wrong→right) deve essere perfetta. explanation in inglese, ≤ 90 caratteri."
    ),
    "false_friends": (
        "Formato «false_friends»: 3-6 falsi amici veri e verificati. it = parola italiana, looks_like = parola INGLESE simile (lang = en), "
        "it_means = cosa significa davvero la parola italiana (nella lingua lang), say_instead = come si dice in italiano looks_like. "
        "L'ultimo viene nascosto dal video: scrivilo comunque per intero, mai «???»."
    ),
    "emoji_vocab": (
        "Formato «emoji_vocab»: 4-9 coppie emoji → parola italiana con articolo corretto (il, lo, la, l', i, gli, le) o null per aggettivi. "
        "Un'emoji standard e inequivocabile per ogni parola. L'ultima parola viene nascosta dal video: scrivila comunque per intero, mai «???»."
    ),
    "level_ladder": (
        "Formato «level_ladder»: un concetto e 4-6 modi di dirlo dal più semplice (A1) al più ricercato/idiomatico (C1-C2), livelli in ordine crescente "
        "senza ripetizioni. Ogni gradino deve essere davvero usato dagli italiani. concept_translation in inglese."
    ),
    "tongue_twister": (
        "Formato «tongue_twister»: uno scioglilingua italiano TRADIZIONALE e realmente esistente (4-22 parole), testo esatto della versione più diffusa. "
        "Non inventarne di nuovi. translation in inglese opzionale."
    ),
    "idiom": (
        "Formato «idiom»: un modo di dire italiano reale e comune. literal = traduzione letterale in inglese, meaning = significato reale in inglese, "
        "example = frase d'esempio naturale. question/answer solo se esiste una risposta fissa (es. «In bocca al lupo» → «Crepi!»)."
    ),
    "conjugation_challenge": (
        "Formato «conjugation_challenge»: verbo + tempo e le 6 forme nell'ordine io, tu, lui/lei, noi, voi, loro (solo la forma verbale, senza pronome; "
        "nei tempi composti includi l'ausiliare, es. «ho fatto»). hidden: 1-2 indici da nascondere, preferibilmente le forme irregolari."
    ),
    "daily_word": (
        "Formato «daily_word»: una parola o espressione italiana utile e frequente nel parlato. syllables con la sillaba tonica in MAIUSCOLO (es. «ma-GA-ri»), "
        "translation e example_translation in inglese, example = frase naturale che contiene la parola."
    ),
}

SYSTEM_TEACHER = (
    f"Sei un insegnante madrelingua di italiano e autore del canale YouTube «{get_settings().channel_name}» ({get_settings().channel_handle}): "
    "lezioni e Shorts didattici per chi impara l'italiano partendo dall'INGLESE. Tutto ciò che non è italiano (traduzioni, spiegazioni, domande) va scritto in inglese; mai in russo o altre lingue. "
    "Scrivi contenuti corretti al 100%: ortografia, accenti (è, perché, più, città), apostrofi (l'acqua, dell'anno), articoli, generi e coniugazioni. "
    "Niente regionalismi, niente forme rare spacciate per standard. Se una forma ha varianti accettate, scegli quella più comune."
)

SYSTEM_VERIFIER = (
    "Sei un severo revisore di italiano (professore universitario, madrelingua). Controlli uno script per uno Short didattico. "
    "Verifica OGNI fatto: traduzioni, forme verbali, articoli, generi, plurali, accenti, apostrofi, maiuscole, e che lo schema della lista sia coerente. "
    "Segnala solo errori reali, non preferenze di stile. "
    "Se trovi errori, restituisci il body corretto in fixed_body_json; se è tutto giusto, ok=true e fixed_body_json vuoto. "
    "I messaggi delle issues scrivili in russo, brevi e concreti (il proprietario del canale legge in russo)."
)

IDEAS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "ideas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Titolo breve in italiano, ≤ 40 caratteri"},
                    "topic": {"type": "string", "description": "Argomento in 2-4 parole"},
                    "angle": {"type": "string", "description": "Cosa rende interessante l'ultima riga nascosta (in russo, 1 frase)"},
                    "level": {"type": "string", "enum": ["A1", "A2", "B1", "B2", "C1"]},
                },
            },
        }
    },
}

VERIFY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "issues": {"type": "array", "items": {"type": "object", "properties": {"field": {"type": "string"}, "message": {"type": "string"}}}},
        "fixed_body_json": {"type": "string", "description": "Il body corretto serializzato come JSON"},
    },
}

META_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title_a": {"type": "string"},
        "title_b": {"type": "string"},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "pinned_comment": {"type": "string"},
    },
}

HOOKS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"hooks": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "spoken": {"type": "string"}}}}},
}


async def llm_settings(s: AsyncSession) -> dict[str, Any]:
    st = get_settings()
    row = await s.get(Setting, "llm")
    base = {"provider": st.llm_provider, "anthropic_model": st.anthropic_model, "openai_base_url": st.openai_base_url, "openai_model": st.openai_model,
            "ollama_url": st.ollama_url, "ollama_model": st.ollama_model}
    return {**base, **(row.value if row else {})}


async def get_provider(s: AsyncSession) -> LLMProvider:
    st = get_settings()
    cfg = await llm_settings(s)
    p = cfg["provider"]
    if p == "anthropic":
        if not st.anthropic_api_key:
            raise LLMError("Не задан ANTHROPIC_API_KEY в .env — генерация через LLM недоступна (банк уроков работает без ключа)")
        return AnthropicProvider(st.anthropic_api_key, cfg["anthropic_model"])
    if p == "openai":
        if not cfg["openai_base_url"]:
            raise LLMError("Не задан OPENAI_BASE_URL для OpenAI-совместимого провайдера")
        return OpenAICompatProvider(cfg["openai_base_url"], st.openai_api_key, cfg["openai_model"])
    if p == "ollama":
        return OllamaProvider(cfg["ollama_url"], cfg["ollama_model"])
    raise LLMError(f"Неизвестный провайдер LLM: {p}")


def _schema(name: str) -> dict[str, Any]:
    d = get_settings().schemas_dir
    return json.loads((d / "formats" / f"{name}.schema.json").read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def normalize_body(body: dict[str, Any]) -> dict[str, Any]:
    """Мелкая чистка ответа модели: пробелы вокруг «/», двойные пробелы, типографский апостроф."""
    def fix(v: Any) -> Any:
        if isinstance(v, str):
            v = v.replace("’", "'").strip()
            v = re.sub(r"\s*/\s*", "/", v)
            return re.sub(r"\s{2,}", " ", v)
        if isinstance(v, list):
            return [fix(x) for x in v]
        if isinstance(v, dict):
            return {k: fix(x) for k, x in v.items()}
        return v

    return fix(body)  # type: ignore[no-any-return]


async def done_titles(s: AsyncSession, series_id: str, limit: int = 200) -> list[str]:
    lessons = (await s.scalars(select(Lesson.title).where(Lesson.series_id == series_id).limit(limit))).all()
    vids = (await s.scalars(select(Video.title).where(Video.series_id == series_id).order_by(Video.created_at.desc()).limit(limit))).all()
    return sorted(set(lessons) | set(vids))


async def generate_ideas(s: AsyncSession, series: Series | None, n: int, free_topic: str = "") -> list[dict[str, Any]]:
    prov = await get_provider(s)
    fmt = series.format if series else "list_mystery"
    done = await done_titles(s, series.id) if series else []
    recent_hooks = (await s.scalars(select(HookPattern.text).where(HookPattern.kind == "hook").order_by(HookPattern.last_used_at.desc().nulls_last()).limit(15))).all()
    user = (
        f"{FORMAT_GUIDES.get(fmt, '')}\n\n"
        f"Serie: «{series.name if series else 'Tema libero'}», livello {series.level if series else 'A1-B1'}, argomenti: {series.topic if series else free_topic or 'libero'}.\n"
        f"{('Tema richiesto: ' + free_topic) if free_topic else ''}\n"
        f"Proponi {n} idee NUOVE e varie per questa serie. NON ripetere questi titoli già fatti: {json.dumps(done, ensure_ascii=False)}.\n"
        f"Hook usati di recente (evita idee che li renderebbero ripetitivi): {json.dumps(list(recent_hooks), ensure_ascii=False)}.\n"
        "Ogni idea deve insegnare qualcosa di concreto e utile a uno straniero."
    )
    r = await prov.complete_json(SYSTEM_TEACHER, user, IDEAS_SCHEMA, purpose="ideas", max_tokens=6000, effort="medium")
    return list(r.data.get("ideas", []))[:n]


async def generate_script(s: AsyncSession, series: Series, idea: dict[str, Any], video_id: str | None = None) -> dict[str, Any]:
    """Идея → Script. Structured output по схеме формата + валидация Pydantic, до 3 попыток с ошибкой в промпте."""
    prov = await get_provider(s)
    spec = get_format(series.format)
    body_schema = _schema(series.format)
    envelope = {
        "type": "object",
        "properties": {"title": {"type": "string", "description": "≤ 40 caratteri"}, "topic": {"type": "string"},
                       "level": {"type": "string", "enum": ["A1", "A2", "B1", "B2", "C1"]}, "body": body_schema},
        "$defs": body_schema.get("$defs", {}),
    }
    base = (f"{FORMAT_GUIDES.get(series.format, '')}\n\nSerie: «{series.name}», livello {series.level}.\n"
            f"Idea: {json.dumps(idea, ensure_ascii=False)}\nScrivi lo script completo.")
    err = ""
    for _ in range(3):
        user = base + (f"\n\nIl tentativo precedente NON è valido: {err}\nCorreggi e riprova." if err else "")
        r = await prov.complete_json(SYSTEM_TEACHER, user, envelope, purpose="script", video_id=video_id, max_tokens=6000, effort="medium")
        data = r.data
        body = normalize_body(data.get("body", {}))
        title = str(data.get("title") or idea.get("title") or "").strip()[:60]
        script = {"format": series.format, "title": title, "topic": data.get("topic", ""),
                  "level": data.get("level", series.level), "body": body}
        if not title:
            err = "title пустой: нужен короткий заголовок на итальянском"
            continue
        try:
            spec.body_model.model_validate(body)
        except ValidationError as e:
            err = "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors())[:800]
            continue
        hard = [i for i in spec.rules(script) if i.severity == "error"]
        if hard:
            err = "; ".join(f"{i.field}: {i.message}" for i in hard)
            continue
        return script
    raise LLMError(f"Модель трижды вернула невалидный скрипт: {err}")


async def verify_script(s: AsyncSession, script: dict[str, Any], video_id: str | None = None) -> dict[str, Any]:
    """LLM-верификатор: {ok, issues[], fixed_script}."""
    prov = await get_provider(s)
    spec = get_format(script["format"])
    user = (f"{FORMAT_GUIDES.get(script['format'], '')}\n\nScript da verificare (JSON):\n{json.dumps(script, ensure_ascii=False)}\n\n"
            "Indica i campi con errori usando percorsi come body.items.3.right.")
    r = await prov.complete_json(SYSTEM_VERIFIER, user, VERIFY_SCHEMA, purpose="verify", video_id=video_id, max_tokens=6000, effort="high")
    fixed = script
    try:
        fb = json.loads(r.data.get("fixed_body_json") or "{}")
        if fb:
            fb = normalize_body(fb)
            spec.body_model.model_validate(fb)
            fixed = {**script, "body": fb}
    except (json.JSONDecodeError, ValidationError):
        pass
    issues = [{"field": str(i.get("field", "body")), "message": str(i.get("message", "")), "severity": "error", "source": "llm"} for i in r.data.get("issues", [])]
    return {"ok": bool(r.data.get("ok")) and not issues, "issues": issues, "fixed_script": fixed}


async def generate_metadata(s: AsyncSession, script: dict[str, Any], answer: str, series_name: str, hook_text: str, answer_mode: str,
                            video_id: str | None = None) -> dict[str, Any]:
    prov = await get_provider(s)
    reveal = {"hide": "la risposta NON è nel video: invita a scriverla nei commenti",
              "reveal": "la risposta viene mostrata alla fine",
              "answer_tomorrow": "la risposta arriva domani nel commento fissato"}[answer_mode]
    user = (
        f"Script: {json.dumps(script, ensure_ascii=False)}\nRisposta nascosta: {answer}\nSerie: {series_name}\nHook sullo schermo: {hook_text}\nModalità: {reveal}\n\n"
        "Scrivi i metadati YouTube Shorts per un pubblico anglofono che impara l'italiano: title_a e title_b (due varianti A/B, ≤ 70 caratteri, misto inglese + la "
        "parola/frase italiana, hook + tema + 1-2 emoji, senza clickbait "
        "e senza promettere cose che non ci sono), description (2-3 righe in inglese con gli esempi italiani, invito a commentare, poi hashtag), tags (8-12), hashtags "
        "(3-5, con #), "
        "pinned_comment (viene pubblicato più tardi come commento fissato: DEVE contenere la risposta esatta «" + answer + "» e una domanda di continuazione, in inglese)."
    )
    r = await prov.complete_json(SYSTEM_TEACHER, user, META_SCHEMA, purpose="metadata", video_id=video_id, max_tokens=3000, effort="low")
    return dict(r.data)


async def generate_hooks(s: AsyncSession, n: int) -> list[dict[str, str]]:
    prov = await get_provider(s)
    have = (await s.scalars(select(HookPattern.text).where(HookPattern.kind == "hook"))).all()
    user = (f"Inventa {n} nuovi hook (2-6 parole) da mettere sopra il titolo di uno Short didattico con l'ultima riga nascosta. "
            f"Devono far restare lo spettatore nei primi 2 secondi, senza clickbait falso. Non ripetere: {json.dumps(list(have), ensure_ascii=False)}. "
            "spoken = come lo dice la voce (numeri scritti in lettere).")
    r = await prov.complete_json(SYSTEM_TEACHER, user, HOOKS_SCHEMA, purpose="hooks", max_tokens=3000, effort="low")
    return [h for h in r.data.get("hooks", []) if 2 <= len(str(h.get("text", "")).split()) <= 7][:n]
