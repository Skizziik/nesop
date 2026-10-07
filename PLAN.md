# PLAN — ItalianoPerTe Shorts Farm

Источник требований: [ITALIANOPERTE_FARM_SPEC.md](ITALIANOPERTE_FARM_SPEC.md). Решения: [DECISIONS.md](DECISIONS.md).
Правило: этап закрыт, только когда `docker compose up` работает end-to-end и тесты зелёные.

Легенда: `[x]` сделано, `[~]` в работе, `[ ]` не начато.

## Этап 1. Скелет и один формат end-to-end (CPU)
- [ ] Монорепо: pnpm workspaces (`apps/web`, `apps/renderer`, `packages/templates`), `services/api`, `services/tts`, `schemas/`, `assets/`, `content/`
- [ ] JSON Schema (`schemas/`): RenderProps, script list_mystery; кодоген TS (json-schema-to-typescript) и Python (datamodel-code-generator), тест «сгенерированное актуально»
- [ ] docker-compose.yml: web, api, worker, tts-cpu, renderer, postgres, redis; профили cpu/gpu; healthchecks; volumes models/data/pgdata
- [ ] .env.example, Makefile (`up`, `down`, `smoke`, `logs`, `test`, `codegen`)
- [ ] api: FastAPI, SQLAlchemy 2, Alembic (полная схема БД, включая таблицы для поздних этапов), сиды серий и банка уроков из `content/`
- [ ] worker (arq): пайплайн script → tts → timeline → render → metadata, trace по этапам
- [ ] tts: FastAPI + плагинная архитектура, плагин Piper (автоустановка it_IT-paola-medium), кеш sha1
- [ ] renderer: Node + Remotion, `POST /render` → job, mp4 + cover.png, loudnorm -14 LUFS, faststart
- [ ] templates: list_mystery + общие компоненты (Pill, TitleChip, ProgressBar, Bookmark, Sticker, Watermark)
- [ ] web: главная (кнопка «Сгенерировать», статус сервисов, очередь), библиотека (сетка, скачать, метаданные)
- [ ] `make smoke` рендерит 3 ролика; pytest + vitest зелёные
- [ ] README (установка на Windows)

## Этап 2. Серии, канбан, редактор с живым превью
- [ ] CRUD серий + настройки
- [ ] Канбан идей (статусы, массовые действия, фильтры)
- [ ] Редактор: форма по JSON Schema + @remotion/player, оверлей интерфейса YouTube, перегенерация строки озвучки
- [ ] SSE-прогресс задач (Redis pub/sub → api → web)

## Этап 3. LLM: идеи, скрипты, проверка
- [ ] LLMProvider: Anthropic (по умолчанию), Ollama, OpenAI-совместимый; учёт токенов/стоимости
- [ ] Генерация идей / скриптов (structured output, 3 ретрая) / метаданных
- [ ] Проверки: правила, LanguageTool (контейнер), Hunspell it_IT, LLM-верификатор, дедуп → needs_review
- [ ] Авто-аппрув серии

## Этап 4. Все форматы и хуки
- [ ] quiz_abc, spot_the_error, false_friends, fill_blank, level_ladder, tongue_twister, idiom, emoji_vocab, conjugation_challenge, daily_word
- [ ] Библиотека хуков (БД, UI, антиповтор), CTA-типы, A/B варианты
- [ ] SFX (процедурные), музыка, вариативность (сид), бесшовная петля, answer_tomorrow
- [ ] Индекс похожести пачки

## Этап 5. Менеджер голосов
- [ ] Плагины Kokoro, Qwen3-TTS, Chatterbox (+ по результатам проверки), образ tts-gpu
- [ ] Скачивание с прогрессом, автоопределение железа, A/B и слепое голосование
- [ ] Voice design, клонирование (с согласием), aligner пословного тайминга

## Этап 6. Ведущая
- [ ] loop (chromakey/alpha), mascot (SVG-спрайты, рот по RMS), lipsync на GPU (опц.)

## Этап 7. Автозагрузка (по команде владельца)
## Этап 8. Обратная связь (по команде владельца)
