# PLAN — ItalianoPerTe Shorts Farm

Источник требований: [ITALIANOPERTE_FARM_SPEC.md](ITALIANOPERTE_FARM_SPEC.md). Решения: [DECISIONS.md](DECISIONS.md).
Правило: этап закрыт, только когда `docker compose up` работает end-to-end и тесты зелёные.

Легенда: `[x]` сделано, `[~]` в работе, `[ ]` не начато.

## Этап 1. Скелет и один формат end-to-end (CPU) — ✅
- [x] Монорепо: pnpm workspaces (`apps/web`, `apps/renderer`, `packages/templates`), `services/api`, `services/tts`, `schemas/`, `content/`
- [x] JSON Schema: RenderProps, Script, list_mystery; кодоген TS + Pydantic, проверка актуальности (`--check`)
- [x] docker-compose: web, api, worker, tts-cpu/tts-gpu, renderer, postgres, redis; профили cpu/gpu; healthchecks; volumes
- [x] .env.example, Makefile (`up`, `down`, `smoke`, `logs`, `test`, `codegen`)
- [x] api: FastAPI, SQLAlchemy 2 async, Alembic (полная схема БД), идемпотентные сиды (7 серий, 109 уроков, 25 хуков, 23 CTA, 12 палитр)
- [x] worker (arq): tts → timeline → render → metadata, trace по этапам (job_events) + Redis pub/sub
- [x] tts: плагинная архитектура, Piper (serena-medium ставится сам), кеш sha1, дубли строк
- [x] renderer: Remotion, очередь с параллелизмом, loudnorm −14 LUFS (ffmpeg из @remotion/compositor), faststart, cover.png
- [x] templates: list_mystery + Pill, TitleChip, HookText, ProgressBar, Bookmark, Sticker, Watermark, CtaBubble, YtOverlay
- [x] web: главная (генерация, сервисы, очередь, статистика), библиотека
- [x] `make smoke`: 3 ролика за 155 с на CPU, 0 ошибок (2026-10-07)
- [x] README (Windows, политика YouTube, лицензии)

## Этап 2. Серии, канбан, редактор с живым превью — 🟡 код готов, финальная e2e-проверка
- [x] CRUD серий + настройки (палитры, ответ, тип призыва, 2-й язык, скорость голоса, плейлист, авто-аппрув)
- [x] Банк уроков в серии (просмотр, удаление)
- [x] Канбан: колонки по статусам, drag&drop, массовые действия, фильтры серия/уровень, «взять из банка»
- [x] Редактор: форма по JSON Schema с подсветкой ошибок, Remotion Player, оверлей YouTube, дубль строки озвучки, палитра/шрифт/раскладка/закладка, 🎲 оформление
- [x] SSE-прогресс (Redis pub/sub → /api/events → инвалидация кеша в web)
- [x] Golden-кадры (SSIM) для renderer: `make test-golden`
- [ ] Прогон в браузере после пересборки образов

## Этап 3. LLM: идеи, скрипты, проверка — 🟡 код готов, финальная e2e-проверка
- [x] LLMProvider: Anthropic (claude-sonnet-5-5, structured output, серверный fallback), OpenAI-совместимый, Ollama; лог токенов/стоимости
- [x] Идеи (дедуп по сделанным темам), скрипты (3 ретрая с ошибкой валидации), метаданные A/B (с откатом на правила)
- [x] Проверки: правила, LanguageTool (контейнер), Hunspell it_IT (spylls), LLM-верификатор с fixed_body, дедуп (хеш + fuzzy заголовков)
- [x] Авто-аппрув серии; «сделать похожие»; «наполнить банк»
- [x] Настройки LLM в UI, тест связи, расход
- [ ] Выборка 20 LLM-роликов: 0 орфографических ошибок по LanguageTool (отчёт)

## Этап 4. Все форматы и хуки
- [ ] quiz_abc, spot_the_error, false_friends, fill_blank, level_ladder, tongue_twister, idiom, emoji_vocab, conjugation_challenge, daily_word
- [ ] Библиотека хуков в UI (CRUD, генерация LLM, частота)
- [ ] Музыка (ассеты с лицензией), answer_tomorrow «Risposta di ieri»
- [x] Процедурные SFX (pop/tick/ding/whoosh/buzz/confetti), вариативность по сиду, бесшовная петля (CTA гаснет к концу), индекс похожести пачки

## Этап 5. Менеджер голосов
- [ ] Плагины Kokoro, Qwen3-TTS, Chatterbox, образ tts-gpu (CUDA)
- [ ] Страница «Голоса»: скачивание с прогрессом, A/B, слепое голосование, voice design, клон с согласием
- [ ] Aligner (ctc-forced-aligner + wav2vec2-italian)

## Этап 6. Ведущая
- [ ] loop (chromakey/alpha), mascot (SVG, рот по RMS — огибающая уже считается), lipsync MuseTalk (GPU)

## Этап 7. Автозагрузка (по команде владельца)
- [x] Таблицы publications, флаг YOUTUBE_UPLOAD_ENABLED
## Этап 8. Обратная связь (по команде владельца)
- [x] Таблицы analytics_snapshots, channel_titles (дедуп уже учитывает channel_titles)
