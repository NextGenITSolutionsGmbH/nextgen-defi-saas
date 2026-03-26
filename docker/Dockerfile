# ── Stage 1: Install and Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy all workspace files
COPY . .

# Install ALL dependencies (dev + prod) — needed for turbo, typescript, etc.
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Generate Prisma client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build the web app
RUN pnpm turbo build --filter=@defi-tracker/web

# ── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output from Next.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
