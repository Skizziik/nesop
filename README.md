# ItalianoPerTe · ферма шортсов

Локальная фабрика вертикальных обучающих роликов для канала **@ItalianoPerTe**: открыл дашборд → выбрал серию → «Сгенерировать» → через несколько минут пачка готовых mp4 с названиями, описаниями и закреплённым комментом.

Всё работает в Docker на Windows (WSL2), Mac и Linux. GPU не обязателен.

- План по этапам: [PLAN.md](PLAN.md)
- Принятые решения и проверка лицензий: [DECISIONS.md](DECISIONS.md)
- Исходное ТЗ: [ITALIANOPERTE_FARM_SPEC.md](ITALIANOPERTE_FARM_SPEC.md)

## Установка на Windows

1. Поставь **Docker Desktop** (WSL2 backend включён по умолчанию). В настройках Docker → Resources дай минимум 4 CPU и 8 GB RAM.
2. Поставь **Git** (`winget install Git.Git`).
3. В PowerShell:
   ```powershell
   git clone https://github.com/Skizziik/nesop.git italianoperte
   cd italianoperte
   copy .env.example .env
   docker compose up -d --build
   ```
4. Открой **http://localhost:3000**.

Первый запуск собирает образы (~10–15 минут) и скачивает голос по умолчанию (~60 MB). Статус сервисов виден на главной странице.

### GPU (необязательно)

Для GPU-моделей озвучки (этап 5) нужна NVIDIA-карта и свежий драйвер Windows: WSL2 пробрасывает GPU в Docker Desktop автоматически. Проверка:
```powershell
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```
Если карта видна, поменяй в `.env` строку `COMPOSE_PROFILES=cpu` на `COMPOSE_PROFILES=gpu` и перезапусти `docker compose up -d`. На Linux дополнительно нужен NVIDIA Container Toolkit.

## Первая генерация

1. На главной выбери серию (или «Микс серий») и количество.
2. Нажми **«Сгенерировать»**. В блоке «Очередь» видно, на каком этапе каждый ролик: озвучка → таймлайн → рендер → метаданные.
3. Готовые ролики появляются в **Библиотеке**: там можно посмотреть ролик, скопировать название/описание/хештеги/закреплённый коммент, скачать mp4 или zip всей пачки, отметить «опубликовано вручную».

Без ключа LLM ролики делаются из банка уроков (`content/bank/*.yaml`, 109 выверенных уроков в 7 сериях). Каждый ролик пачки получает свою палитру, раскладку, наклейки, хук и фразу-призыв; подряд не повторяются.

## Команды

| Команда | Что делает |
|---|---|
| `docker compose up -d --build` | поднять всё (`make up`) |
| `docker compose down` | остановить (`make down`), данные сохраняются в volumes |
| `docker compose logs -f` | логи (`make logs`), формат JSON |
| `make smoke` | e2e: 3 ролика через API, проверка mp4/обложки/метаданных |
| `make test` | pytest + ruff + mypy (api, tts), tsc + vitest (TS), проверка актуальности кодогена |
| `make codegen` | перегенерировать TS-типы и Pydantic-модели из `schemas/` |

Без `make` (Windows): смотри соответствующие строки в [Makefile](Makefile) и запускай их напрямую.

## Как устроено

```
web (Next.js, :3000) ──/api, /media──▶ api (FastAPI, :8000) ──▶ postgres
                                          │  └─ очередь arq ──▶ redis ◀── worker
                                          │                         │
                                          └── /data (volume) ◀──────┼── tts (Piper/…, плагины)
                                                                    └── renderer (Remotion + Chromium)
```

- `schemas/` — JSON Schema, источник правды. Из них генерируются TS-типы (`packages/templates/src/generated`) и Pydantic-модели (`services/api/app/schemas_gen`).
- `packages/templates` — Remotion-композиции; одни и те же компоненты рендерит renderer и (на этапе 2) показывает живое превью в дашборде.
- Пайплайн ролика: каждая строка озвучивается отдельно (кеш по `sha1(model|voice|speed|text)`), тишина обрезается, строки раскладываются по таймлайну с паузами — подсветка совпадает с голосом без forced alignment. Финальный звук нормализуется до −14 LUFS.

## Как добавить серию

1. Добавь запись в `content/series.yaml` (slug, название, формат, уровень, палитры).
2. Создай `content/bank/<slug>.yaml` с уроками (формат записи — в шапке любого существующего файла).
3. Перезапусти api: `docker compose restart api`. Сиды идемпотентны: новые серии и уроки добавятся, существующие не тронутся.

С этапа 2 серии создаются и редактируются прямо в дашборде.

## Как добавить голос

Сейчас доступен Piper: голос `it_IT-serena-medium` ставится автоматически. Другие голоса Piper (`serena-high`, `paola`, `riccardo`) ставятся через API tts (`POST /models/piper/install {"voice": "..."}`), с этапа 5 — кнопкой на странице «Голоса». Новая модель = плагин в `services/tts/app/plugins/` (интерфейс `TTSPlugin` в `base.py`).

## Как добавить формат (для разработчика)

1. `schemas/formats/<format>.schema.json` — схема поля `body`; затем `make codegen`.
2. `packages/templates/src/formats/<Format>.tsx` — React-компонент, получает `RenderProps`; зарегистрировать в `registry.ts`.
3. `services/api/app/formats/<format>.py` — план озвучки (`segments`), таймлайн, SFX, правила проверки, ответ; зарегистрировать в `formats/__init__.py`.
4. Тесты: валидация сидов схемой, детерминированный таймлайн, раскладка в безопасных зонах.

## Политика YouTube (памятка)

С 15.07.2025 правило «repetitious content» называется **inauthentic content** ([support.google.com/youtube/answer/1311392](https://support.google.com/youtube/answer/1311392)). YouTube не монетизирует массово производимый контент по шаблону с минимальными отличиями, включая AI-ролики на типовых шаблонах. Санкция может снять монетизацию со всего канала. Одинаковые интро/аутро и серии с разным содержанием разрешены.

Что делает ферма, чтобы ролики оставались авторскими:
- каждый ролик несёт отдельный урок, корректность итальянского проверяется (правила сейчас, LanguageTool и LLM-верификатор на этапе 3);
- внутри пачки меняются палитры, раскладки, наклейки, хуки и фразы-призывы; «индекс похожести» пачки виден в очереди;
- для новых серий по умолчанию включён ручной аппрув (у сидов он выключен, чтобы первая генерация работала одной кнопкой);
- рекомендуется фирменный голос (клон владельца или voice design, этап 5), а не стоковый;
- в календаре (этап 7) будет лимит публикаций в день (`MAX_PUBLISH_PER_DAY`, по умолчанию 3).

## Лицензии ассетов и моделей

- Шрифты Montserrat, Fredoka, Nunito — SIL OFL 1.1.
- SFX генерируются процедурно (`services/api/app/pipeline/sfx.py`), CC0.
- Наклейки — собственные SVG.
- Голос `it_IT-serena-*` (Piper) — CC-BY-4.0: в описании канала или ролика нужна атрибуция («Voice: Piper it_IT-serena, CC-BY-4.0»).
- Remotion бесплатен для частных лиц и компаний до 3 сотрудников.
- Полная таблица моделей TTS с лицензиями — в [DECISIONS.md](DECISIONS.md).
