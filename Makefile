# На Windows: make есть в Git Bash (через `winget install GnuWin32.Make`) или используй команды из README напрямую.
COMPOSE ?= docker compose

.PHONY: up down logs build smoke test test-api test-tts test-ts codegen codegen-check lint ps

up:
	$(COMPOSE) up -d --build
	@echo "Дашборд: http://localhost:$${WEB_PORT:-3000}"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

# 3 ролика через API на поднятом стеке, ждёт готовности и проверяет mp4
smoke:
	$(COMPOSE) exec -T api python -m scripts.smoke --count 3

test: test-api test-tts test-ts

test-api:
	$(COMPOSE) exec -T api sh -c "pytest -q && ruff check app tests scripts && mypy app && python scripts/codegen.py --check"

test-tts:
	$(COMPOSE) exec -T tts-$${COMPOSE_PROFILES:-cpu} sh -c "pytest -q && ruff check app tests && mypy app"

test-ts:
	$(COMPOSE) run --rm --no-deps -T --entrypoint sh renderer -c "cd /repo && pnpm -r run typecheck && pnpm -r run test && pnpm codegen --check"

codegen:
	pnpm codegen
	$(COMPOSE) run --rm --no-deps -T -v ./services/api/app/schemas_gen:/srv/api/app/schemas_gen api python scripts/codegen.py
