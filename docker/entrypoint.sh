#!/bin/sh
set -e

# Use absolute paths — CWD may vary depending on container runtime
APP_ROOT="/app"
PRISMA_CLI="node ${APP_ROOT}/node_modules/prisma/build/index.js"
SCHEMA="${APP_ROOT}/packages/db/prisma/schema.prisma"
SEED_FILE="${APP_ROOT}/packages/db/prisma/seed.sql"

echo "=== DeFi Tracker SaaS — Production Startup ==="
echo "Working directory: $(pwd)"
echo "APP_ROOT: ${APP_ROOT}"

# Step 1: Run database migrations
echo "[1/3] Running database migrations..."
if $PRISMA_CLI migrate deploy --schema "$SCHEMA"; then
  echo "[1/3] Migrations applied successfully."
else
  echo "[1/3] WARNING: Migration failed — some features may not work correctly."
  echo "[1/3] Check DATABASE_URL and ensure the database is accessible."
fi

# Step 2: Seed database (idempotent — ON CONFLICT DO NOTHING)
echo "[2/3] Seeding database..."
if $PRISMA_CLI db execute --file "$SEED_FILE" --schema "$SCHEMA"; then
  echo "[2/3] Seed completed."
else
  echo "[2/3] WARNING: Seed failed — test users may not exist."
fi

# Step 3: Start the application
echo "[3/3] Starting Next.js application..."
exec node "${APP_ROOT}/apps/web/server.js"
