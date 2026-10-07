# DECISIONS

Решения, принятые без вопроса владельцу. Формат: что решили → почему.

## Окружение
- **Железо владельца**: NVIDIA RTX 4060, 8 GB VRAM, Windows 11 + Docker Desktop 29 (WSL2). Определено автоматически (`nvidia-smi`), вопрос не задавался. GPU-модели выбираются под 8 GB.
- **Node 22 LTS вместо Node 20** в образах: Node 20 закончил поддержку в апреле 2026, Next 16 требует ≥ 20.9. Remotion 4 поддерживает 22.
- **pnpm через corepack** внутри Docker; локально pnpm не нужен.
- **Python 3.12** для api/worker/tts.

## Архитектура
- **Один образ для api и worker** (`services/api`), разные команды запуска. Очередь — **arq** (async, поверх Redis), т.к. весь api async (FastAPI + SQLAlchemy async + asyncpg).
- **Хранилище — shared volume `/data`**, без MinIO. api раздаёт `/media/*` из `/data`; web проксирует `/api/*` и `/media/*` на api через Next rewrites (один origin, без CORS).
- **Пути ассетов в RenderProps относительные** (`/media/...`). Композиция подставляет `asset_base` (renderer передаёт `http://api:8000`, браузер — пусто). Один и тот же JSON рендерится и в Player, и в renderer.
- **Тайминг**: каждую строку синтезируем отдельно, обрезаем тишину, собираем таймлайн с паузами в worker (numpy), пишем один `voice.wav`. Таймлайн (секунды) кладётся в RenderProps, композиция переводит в кадры. Forced alignment не нужен для list-форматов.
- **Нормализация громкости**: финальный проход в renderer через ffmpeg `loudnorm=I=-14:TP=-1.5:LRA=11` + `-movflags +faststart`, т.к. музыка/SFX микшируются внутри Remotion.
- **cover.png** = `renderStill` кадра 0 (на нём уже весь список — «контракт времени»).
- **JSON Schema — источник правды** в `/schemas`. TS-типы (json-schema-to-typescript) и Pydantic-модели (datamodel-code-generator) генерируются `make codegen` и коммитятся; тест падает, если сгенерированное устарело. Так сборка Docker не зависит от кодогенераторов.
- **Схема БД полная с первой миграции**: таблицы для публикаций, аналитики, A/B, хуков, голосов созданы сразу, фичи за флагами.
- **Шрифты** через `@fontsource/*` (OFL), вшиваются в бандл — рендер работает офлайн.

## Лицензии и модели (проверено 2026-10-07, источники: [docs/research-2026-10.md](docs/research-2026-10.md))

### TTS
| Модель | Лицензия весов | Коммерция | Итальянский | Железо | Клон / design | Решение |
|---|---|---|---|---|---|---|
| Piper `it_IT-serena-medium/high` | CC-BY-4.0 (синт. датасет) | ✅ с атрибуцией | ✅ | CPU | — | **Голос по умолчанию** (medium ставится автоматически) |
| Piper `it_IT-paola-medium` | датасет CC0, но fine-tune с lessac (research-only) | ⚠️ риск | ✅ | CPU | — | доступна, жёлтый бейдж «риск» |
| Piper `it_IT-riccardo-x_low` | M-AILABS (LibriVox), лицензия не подтверждена | ⚠️ не подтверждено | ✅ | CPU | — | доступна, жёлтый бейдж |
| Kokoro-82M (`if_sara`, `im_nicola`) | Apache-2.0 | ✅ | ✅ (grade C) | CPU | — | этап 5, CPU |
| Qwen3-TTS 0.6B/1.7B | Apache-2.0 | ✅ | ✅ | GPU (8 GB ок) | ✅ / ✅ VoiceDesign | этап 5, **кандидат №1 для фирменного голоса** |
| Chatterbox Multilingual v3 | MIT | ✅ (watermark Perth) | ✅ | GPU ~3.5 GB | ✅ | этап 5 |
| Fun-CosyVoice3-0.5B | Apache-2.0 | ✅ | ✅ | GPU | ✅ | этап 5, опционально |
| MOSS-TTS-Nano-100M | Apache-2.0 | ✅ | заявлен, качество не проверено | CPU | ✅ | этап 5, опционально |
| Kyutai Pocket TTS | CC-BY-4.0, gated | ✅ с атрибуцией | ✅ | CPU | ✅ (с согласием) | этап 5, опционально |
| Voxtral-4B-TTS | CC BY-NC 4.0 | ❌ | ✅ | ≥16 GB | — | не предлагаем (non-commercial + не влезает) |
| XTTS-v2 | Coqui CPML | ❌ | ✅ | GPU | ✅ | красный бейдж «non-commercial», скрыта по умолчанию |

Код `piper-tts` — GPL-3.0: это влияет только на распространение софта, не на сгенерированное аудио. tts-сервис — отдельный контейнер, наш код не линкуется с GPL-кодом за пределами этого сервиса.

### Прочее
- **Remotion 4**: бесплатно для частных лиц и компаний до 3 сотрудников, включая коммерческие ролики. Канал владельца подходит. При росте команды >3 — нужна Company License.
- **Aligner (этап 5)**: `ctc-forced-aligner` (BSD-2) с моделью `jonatasgrosman/wav2vec2-large-xlsr-53-italian` (Apache-2.0). Дефолтная MMS-модель — CC-BY-NC, не используем. faster-whisper (MIT) — только как QA-проверка «сказано то, что написано».
- **Эмодзи**: Twemoji (форк jdecked), графика CC-BY 4.0 → строка атрибуции в описании ролика формата emoji_vocab. OpenMoji (CC BY-SA) не берём из-за share-alike.
- **Lip-sync (этап 6)**: MuseTalk 1.5 (MIT, 4–8 GB). LatentSync 1.5 — запасной (8 GB впритык).
- **LanguageTool**: образ `erikvl87/languagetool` (порт 8010), heap 1 GB. Hunspell: `hunspell-it` + `spylls` (чистый Python, работает на 3.12).
- **YouTube API**: закрепить коммент через API нельзя → публикуем обычный коммент + напоминание «закрепи руками». Загрузка: отдельный бакет 100 `videos.insert`/сутки.
- **LLM по умолчанию**: `claude-sonnet-5-5` (подтверждена в каталоге моделей, $2/$10 за 1M токенов).
