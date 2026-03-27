#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Load .env.test ---
if [ -f "$PROJECT_ROOT/.env.test" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.test"
  set +a
fi
export NODE_ENV=test

# --- Parse flags ---
CLEANUP=false
PLAYWRIGHT_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--cleanup" ]; then
    CLEANUP=true
  else
    PLAYWRIGHT_ARGS+=("$arg")
  fi
done

# --- Start test containers ---
echo "[test-e2e] Starting test containers..."
docker compose -f "$PROJECT_ROOT/docker/docker-compose.test.yml" up -d

echo "[test-e2e] Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose -f "$PROJECT_ROOT/docker/docker-compose.test.yml" exec -T db \
    pg_isready -U defitracker -d defitracker_test > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose -f "$PROJECT_ROOT/docker/docker-compose.test.yml" exec -T db \
  pg_isready -U defitracker -d defitracker_test

echo "[test-e2e] Waiting for Redis..."
for i in $(seq 1 15); do
  if docker compose -f "$PROJECT_ROOT/docker/docker-compose.test.yml" exec -T redis \
    redis-cli ping > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# --- Prisma generate + migrate ---
echo "[test-e2e] Generating Prisma client..."
pnpm --filter @defi-tracker/db exec prisma generate

echo "[test-e2e] Running migrations..."
pnpm --filter @defi-tracker/db exec prisma migrate deploy

# --- Install Playwright browsers if needed ---
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
  echo "[test-e2e] Installing Playwright browsers..."
  npx playwright install chromium
fi

# --- Run tests ---
echo "[test-e2e] Running Playwright E2E tests..."
EXIT_CODE=0
npx playwright test --config "$PROJECT_ROOT/tests/e2e/playwright.config.ts" "${PLAYWRIGHT_ARGS[@]}" || EXIT_CODE=$?

# --- Cleanup ---
if [ "$CLEANUP" = true ]; then
  echo "[test-e2e] Stopping test containers..."
  docker compose -f "$PROJECT_ROOT/docker/docker-compose.test.yml" down -v
fi

exit $EXIT_CODE
