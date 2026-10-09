# На Windows: make есть в Git Bash (через `winget install GnuWin32.Make`) или используй команды из README напрямую.
COMPOSE ?= docker compose

.PHONY: up down logs build smoke test test-api test-tts test-ts test-golden fixtures codegen lint ps

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

# шаблоны и рендерер — в образе рендерера; веб — локально (в образе рендерера зависимостей веба нет)
test-ts:
	$(COMPOSE) run --rm --no-deps -T --entrypoint sh renderer -c "cd /repo && pnpm --filter '!@ipt/web' -r run typecheck && pnpm --filter '!@ipt/web' -r run test && pnpm codegen --check"
	cd apps/web && npx tsc -p tsconfig.json --noEmit && npx vitest run

test-golden:
	$(COMPOSE) run --rm --no-deps -T --entrypoint sh renderer -c "cd /repo/apps/renderer && GOLDEN=1 UPDATE_GOLDEN=$${UPDATE_GOLDEN:-0} npx vitest run test/golden.test.ts"

fixtures:
	$(COMPOSE) run --rm --no-deps -T -v ./apps/renderer/test/fixtures:/out api python -m scripts.sample_props /out

codegen:
	pnpm codegen
	$(COMPOSE) run --rm --no-deps -T -v ./services/api/app/schemas_gen:/srv/api/app/schemas_gen api python scripts/codegen.py
