#!/bin/sh
set -e

PRISMA_CLI="node node_modules/prisma/build/index.js"
SCHEMA="packages/db/prisma/schema.prisma"

echo "=== DeFi Tracker SaaS — Production Startup ==="

# Step 1: Run database migrations
echo "[1/3] Running database migrations..."
if $PRISMA_CLI migrate deploy --schema "$SCHEMA"; then
  echo "[1/3] Migrations applied successfully."
else
  echo "[1/3] WARNING: Migration failed — tables may not exist!"
fi

# Step 2: Seed database (idempotent — ON CONFLICT DO NOTHING)
echo "[2/3] Seeding database..."
if $PRISMA_CLI db execute --file packages/db/prisma/seed.sql --schema "$SCHEMA"; then
  echo "[2/3] Seed completed."
else
  echo "[2/3] WARNING: Seed failed — test users may not exist."
fi

# Step 3: Start the application
echo "[3/3] Starting Next.js application..."
exec node apps/web/server.js
