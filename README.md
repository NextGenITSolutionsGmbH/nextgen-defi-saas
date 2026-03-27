# DeFi Tracker SaaS

**On-Chain Tax Intelligence for Flare Network DeFi Users**

Automated, BMF-2025-compliant DeFi transaction tracking with CoinTracking CSV export, FIFO/LIFO tax lot matching, and real-time EUR pricing via Flare's FTSO oracle.

Built by [NextGen IT Solutions GmbH](https://nextgenitsolutions.de), Stuttgart.

**Live:** [app.defi.nextgenitsolutions.de](https://app.defi.nextgenitsolutions.de)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Core Modules](#core-modules)
- [Supported Protocols](#supported-protocols)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Test Users](#test-users)
- [Scripts](#scripts)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Infrastructure](#infrastructure)
- [Tax Compliance](#tax-compliance)
- [Flare Network](#flare-network)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

DeFi Tracker SaaS solves the tax reporting problem for Flare Network DeFi users in Germany. On-chain transactions across SparkDEX, Enosys, Kinetic Market, and native staking are automatically indexed, classified, priced in EUR, and exported as CoinTracking-compatible CSV files.

**Key capabilities:**

- Automated wallet syncing via Flare RPC (chain ID 14)
- 5-layer transaction classification with Ampel system (GREEN/YELLOW/RED/GRAY)
- 4-tier EUR price engine: FTSO on-chain oracle > CoinGecko > CoinMarketCap > Manual
- FIFO/LIFO/HIFO tax lot matching with Haltefrist (365-day holding period) tracking
- BMF-2025-compliant CoinTracking 15-column CSV export
- GoBD audit trail with SHA-256 hash chain
- Dual-scenario modeling (Model A/B) for LP providing and CDP positions

---

## Architecture

```
                                +---------------------------+
                                |      Next.js 15 App       |
                                |    (React 19 + Tailwind)  |
                                +------------+--------------+
                                             |
                                       tRPC v11
                                             |
                        +--------------------+--------------------+
                        |                                         |
               +--------v--------+                      +---------v--------+
               |  PostgreSQL 16  |                      |     Redis 7      |
               |   (Prisma v6)   |                      |    (BullMQ v5)   |
               |   12 models     |                      |    3 workers     |
               +--------+--------+                      +---------+--------+
                        |                                         |
                        |                    +--------------------+--------------------+
                        |                    |                    |                    |
                        |           +--------v------+   +--------v------+   +---------v-----+
                        |           | wallet-sync   |   | price-fetch   |   | export-gen    |
                        |           | (Flare RPC)   |   | (FTSO/CG/CMC) |   | (CSV/PDF)     |
                        |           +---------------+   +---------------+   +---------------+
                        |
           +------------+------------+
           |            |            |
    +------v---+ +-----v----+ +-----v------+
    | Indexer   | | Pricing  | | Classifier |
    | (RPC +   | | (4-tier  | | (5-layer   |
    |  ABI     | |  EUR)    | |  Ampel)    |
    |  decode) | +----------+ +------------+
    +----------+
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS + PostCSS, shadcn/ui |
| **API** | tRPC 11 + Zod validation (end-to-end type safety) |
| **Database** | PostgreSQL 16 + Prisma ORM v6 |
| **Queue** | Redis 7 + BullMQ v5 (wallet-sync, price-fetch, export-gen) |
| **Auth** | NextAuth.js v5 + TOTP 2FA + bcryptjs password hashing |
| **Monorepo** | pnpm 9.15.4 workspaces + Turborepo |
| **Language** | TypeScript 5.7+ (strict mode) |
| **Testing** | Playwright (E2E + a11y), Vitest (unit + integration), k6 (perf) |
| **CI/CD** | GitHub Actions (4 self-hosted runners) + Docker + Coolify |
| **Hosting** | Hetzner dedicated server via Coolify PaaS |
| **Runtime** | Node.js 24.14.1 (Alpine) |

---

## Monorepo Structure

```
nextgen-defi-saas/
├── apps/
│   └── web/                          # Next.js 15 frontend + tRPC API
│       └── src/
│           ├── app/
│           │   ├── (auth)/           # Login, Register pages
│           │   ├── (dashboard)/      # Overview, Transactions, Wallets, Exports, Settings
│           │   └── api/              # tRPC, health endpoint, NextAuth, export download
│           ├── components/           # Dashboard widgets, TX list, layout
│           ├── lib/                  # tRPC client, auth, storage
│           └── server/
│               ├── routers/          # tRPC routers (dashboard, tx, wallet, export, user)
│               └── queue/            # BullMQ connection + workers
├── packages/
│   ├── db/                           # Prisma schema, migrations, seed
│   ├── shared/                       # Core business logic
│   │   └── src/
│   │       ├── abis/                 # Smart contract ABIs
│   │       ├── classifier/           # 5-layer TX classification engine
│   │       ├── constants/            # Flare chain constants, token addresses
│   │       ├── export/               # CoinTracking CSV + PDF + audit log
│   │       ├── indexer/              # Flare RPC client, event decoder, wallet sync
│   │       ├── pricing/              # FTSO, CoinGecko, CMC price engine
│   │       ├── queue/                # BullMQ job definitions
│   │       ├── tax/                  # FIFO/LIFO lot matcher, Freigrenze, Haltefrist
│   │       └── types/                # Shared TypeScript types
│   ├── ui/                           # shadcn/ui component library
│   └── config/                       # Shared TypeScript config
├── docker/
│   ├── Dockerfile                    # Multi-stage production (Node 24.14.1 Alpine)
│   ├── Dockerfile.dev                # Development with hot-reload
│   ├── docker-compose.yml            # Full dev stack (PostgreSQL + Redis + app)
│   └── docker-compose.test.yml       # Ephemeral test databases (tmpfs)
├── tests/
│   ├── e2e/                          # Playwright E2E + a11y specs
│   ├── helpers/                      # Auth + DB test helpers
│   ├── fixtures/                     # Test data (transactions.json)
│   ├── k6/                           # Performance test scripts
│   └── setup.ts                      # Vitest global setup
├── scripts/
│   └── test-e2e.sh                   # Local E2E convenience script
├── .github/workflows/
│   ├── ci.yml                        # Lint, type-check, unit + integration tests
│   ├── deploy.yml                    # Docker build > GHCR > Coolify > health check
│   ├── e2e.yml                       # Playwright E2E + accessibility tests
│   └── performance.yml               # k6 load tests (weekly)
└── turbo.json                        # Turborepo task pipeline
```

---

## Core Modules

### 1. Blockchain Indexer (`packages/shared/src/indexer/`)

- Flare RPC client with automatic retry and rate limiting
- ABI event decoder for SparkDEX V3/V4, Enosys DEX + CDP, Kinetic Market
- BullMQ wallet-sync job orchestrator with incremental block scanning

### 2. EUR Price Engine (`packages/shared/src/pricing/`)

| Priority | Source | Type |
|----------|--------|------|
| 1 | FTSO | On-chain Flare Time Series Oracle |
| 2 | CoinGecko | REST API |
| 3 | CoinMarketCap | REST API |
| 4 | Manual | User-provided fallback |

- Every price logged to `price_audit_logs` (GoBD compliance)
- Z-Score anomaly detection (>3 sigma = warning)

### 3. TX Classification Engine (`packages/shared/src/classifier/`)

| Layer | Method |
|-------|--------|
| 1 | Protocol ABI match (exact contract + event) |
| 2 | Event pattern matching (Transfer, Swap, Deposit) |
| 3 | Heuristic rules (value patterns, address roles) |
| 4 | ML fallback (future) |
| 5 | Manual override |

**Ampel Status:** GREEN (auto-classified) / YELLOW (ambiguous) / RED (unknown) / GRAY (irrelevant)

### 4. Tax Calculation Engine (`packages/shared/src/tax/`)

- FIFO (default), LIFO, HIFO lot matching
- Haltefrist — 365-day holding period tracker per lot
- Freigrenze monitoring: §23 EStG (1,000/year), §22 Nr. 3 EStG (256/year)
- Gain/loss computation per disposal with EUR cost basis

### 5. CoinTracking Export Engine (`packages/shared/src/export/`)

- 15-column CSV matching CoinTracking import spec
- German format: DD.MM.YYYY HH:MM:SS (UTC), comma decimal separator
- SHA-256 hash chain on `audit_logs`, versioned exports
- PDF reports for tax advisor handoff

---

## Supported Protocols

| Protocol | Type | Events Decoded |
|----------|------|---------------|
| **SparkDEX V3** | DEX (Uniswap V3 fork) | Swap, Mint, Burn, Collect, Flash |
| **SparkDEX V4** | DEX (concentrated liquidity) | Swap, ModifyLiquidity |
| **Enosys DEX** | DEX | Swap, AddLiquidity, RemoveLiquidity |
| **Enosys CDP** | Lending/Borrowing | Deposit, Withdraw, Borrow, Repay, Liquidate |
| **Kinetic Market** | Lending | Supply, Redeem, Borrow, RepayBorrow |
| **FLR Staking** | Native staking | Delegate, Undelegate, ClaimReward |
| **WFLR Wrapping** | Token wrap/unwrap | Deposit, Withdrawal |

---

## Database Schema

12 models, 12 enums — PostgreSQL 16 via Prisma v6:

```
User ──< Wallet ──< Transaction ──< TxLeg
  │                      │              └──< TxClassification
  │                      └──< TokenPrice
  ├──< TaxLot ──< TaxEvent
  ├──< Export
  ├──< Subscription
  └──< AuditLog

PriceAuditLog (standalone — GoBD compliance)
```

**Key Enums:** `PlanTier` (STARTER/PRO/BUSINESS/KANZLEI), `TxStatus` (GREEN/YELLOW/RED/GRAY), `PriceSource` (FTSO/COINGECKO/CMC/MANUAL), `TaxMethod` (FIFO/LIFO/HIFO)

---

## Getting Started

### Prerequisites

- **Node.js** >= 24 (24.14.1 recommended — see `.nvmrc`)
- **pnpm** >= 9.15
- **PostgreSQL** 16
- **Redis** 7
- **Docker** (for containerized dev/test)

### Quick Start

```bash
# Clone
git clone https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas.git
cd nextgen-defi-saas

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Start dev databases
docker compose -f docker/docker-compose.yml up -d db redis

# Initialize database
pnpm --filter @defi-tracker/db exec prisma generate
pnpm --filter @defi-tracker/db exec prisma migrate dev

# Seed test data (optional)
pnpm --filter @defi-tracker/db db:seed

# Start development server
pnpm dev
```

App available at http://localhost:3000.

### Docker Development

Full stack (PostgreSQL + Redis + Next.js with hot-reload):

```bash
docker compose -f docker/docker-compose.yml up
```

---

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `NEXTAUTH_SECRET` | Session secret (`openssl rand -base64 32`) | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `FLARE_RPC_URL` | Flare Network RPC endpoint | Yes |
| `FLARE_CHAIN_ID` | Chain ID (default: 14) | No |
| `COINGECKO_API_KEY` | CoinGecko API (tier 2 pricing) | No |
| `CMC_API_KEY` | CoinMarketCap API (tier 3 pricing) | No |
| `STRIPE_SECRET_KEY` | Stripe payment key | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing | No |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side) | No |
| `COOLIFY_API_URL` | Coolify instance URL (deploy only) | No |
| `COOLIFY_API_TOKEN` | Coolify API token (deploy only) | No |

---

## Test Users

The production seed (`packages/db/prisma/seed.sql`) creates three test accounts. The seed is idempotent and runs automatically on container startup via the Dockerfile.

| Email | Password | Plan Tier |
|-------|----------|-----------|
| `alice@example.com` | `SeedP@ssw0rd!` | STARTER |
| `bob@example.com` | `SeedP@ssw0rd!` | PRO |
| `carol@example.com` | `SeedP@ssw0rd!` | BUSINESS |

All test users have TOTP 2FA disabled. Passwords are hashed with bcrypt. The seed uses `ON CONFLICT (email) DO NOTHING` so it is safe to run repeatedly.

To seed manually:

```bash
pnpm --filter @defi-tracker/db db:seed
```

---

## Scripts

### Root (Turborepo)

```bash
pnpm dev                  # Start all packages in dev mode
pnpm build                # Production build
pnpm lint                 # ESLint across all packages
pnpm type-check           # TypeScript type checking
pnpm test:unit            # Unit tests (Vitest)
pnpm test:integration     # Integration tests (real DB/Redis)
pnpm test:e2e             # E2E tests via Turborepo
pnpm test:e2e:local       # E2E with auto Docker setup (recommended)
pnpm test:a11y            # Accessibility tests (axe-core)
pnpm test:perf            # k6 performance tests
pnpm clean                # Remove all build artifacts
```

### Database

```bash
pnpm --filter @defi-tracker/db exec prisma generate      # Generate client
pnpm --filter @defi-tracker/db exec prisma migrate dev    # Create + run migration
pnpm --filter @defi-tracker/db exec prisma migrate deploy # Run migrations (prod)
pnpm --filter @defi-tracker/db exec prisma studio         # Visual DB editor
pnpm --filter @defi-tracker/db db:seed                    # Seed test data
pnpm --filter @defi-tracker/db db:reset                   # Drop + recreate
```

---

## Testing

### Unit & Integration Tests (Vitest)

```bash
pnpm test:unit                # Run unit tests
pnpm test:integration         # Integration tests (needs PostgreSQL + Redis)
```

Coverage thresholds: 80% (statements, branches, functions, lines).

### E2E Tests (Playwright)

10 specs across 2 browser projects (chromium + mobile-chrome = 20 test runs):

| Suite | Tests | Description |
|-------|-------|-------------|
| `health.spec.ts` | 2 | Health endpoint status + timestamp |
| `auth.spec.ts` | 5 | Register, login, invalid credentials, protected routes |
| `a11y.spec.ts` | 3 | WCAG 2.1 AA compliance (login, register, wallets) |

**Run locally** (recommended — starts Docker, migrates DB, seeds, runs tests):

```bash
pnpm test:e2e:local
```

Options:

```bash
pnpm test:e2e:local --headed          # Watch tests in browser
pnpm test:e2e:local --grep "health"   # Filter by test name
pnpm test:e2e:local --cleanup         # Tear down containers after
```

The E2E suite uses port 3008 to avoid conflicts with the dev server on 3000.

Test infrastructure: `docker/docker-compose.test.yml` (ephemeral PostgreSQL + Redis with tmpfs).

### Performance Tests (k6)

```bash
pnpm test:perf
```

Smoke + load tests. Runs weekly in CI (Monday 3am UTC).

---

## CI/CD Pipeline

All workflows run on **4 self-hosted GitHub Actions runners** (Hetzner via Coolify).

### CI (`ci.yml`)

Triggers on push to `main`/`develop` and pull requests:

1. Start PostgreSQL 16 + Redis 7 service containers
2. Install dependencies (`pnpm install --frozen-lockfile`)
3. Generate Prisma client
4. Lint (ESLint) + Type check (`tsc --noEmit`)
5. Unit tests (Vitest with coverage)
6. Integration tests (real DB/Redis)
7. Security audit (`audit-ci --high`)

### E2E (`e2e.yml`)

Triggers on push to `main`:

1. Start PostgreSQL + Redis containers
2. Build web app + install Playwright browsers
3. Run Playwright E2E + accessibility tests
4. Upload test reports as artifacts (14-day retention)

### Deploy (`deploy.yml`)

Triggers on push to `main` or manual dispatch:

1. Wait for CI to pass
2. Build multi-stage Docker image (Node 24.14.1 Alpine)
3. Push to GitHub Container Registry (`ghcr.io`)
4. Trigger Coolify deployment via webhook
5. Health check validation (`GET /api/health`, 20 retries)
6. Post deployment summary

### Performance (`performance.yml`)

Triggers weekly (Monday 3am UTC) or manual dispatch:

1. Install k6
2. Run smoke tests against target URL
3. Upload results as artifacts (30-day retention)

---

## Deployment

### Production Stack

```
GitHub (push to main)
    > GitHub Actions (self-hosted)
        > Docker build (Node 24.14.1 Alpine, multi-stage)
            > Push to ghcr.io
                > Coolify deploy webhook
                    > Auto-migrate DB (prisma migrate deploy)
                        > Auto-seed DB (prisma db execute seed.sql)
                            > Start app (node apps/web/server.js)
                                > Health check (/api/health)
                                    > Live at app.defi.nextgenitsolutions.de
```

### Docker Image

Production Dockerfile (`docker/Dockerfile`):

1. **Build stage:** Node 24.14.1 Alpine, pnpm install, Prisma generate, Turbo build (standalone)
2. **Run stage:** Copy standalone + static + Prisma migrations, run as non-root (UID 1001)
3. **Startup:** `prisma migrate deploy`, then `prisma db execute seed.sql`, then `node apps/web/server.js`

### Health Check

```
GET /api/health  =>  200 OK

{
  "status": "ok",
  "timestamp": "2026-03-27T06:30:00.000Z",
  "version": "0.1.0",
  "db": "connected",
  "redis": "not_configured"
}
```

---

## Infrastructure

| Component | Details |
|-----------|---------|
| **Hosting** | Hetzner dedicated server (195.201.217.132) |
| **PaaS** | Coolify (self-hosted at app.coolify.nextgenitsolutions.de) |
| **Domain** | app.defi.nextgenitsolutions.de (GoDaddy DNS) |
| **Registry** | GitHub Container Registry (ghcr.io) |
| **CI Runners** | 4x self-hosted GitHub Actions runners via Coolify |
| **Database** | PostgreSQL 16 Alpine (Coolify managed) |
| **Cache/Queue** | Redis 7 Alpine (Coolify managed) |
| **SSL** | Automatic via Coolify (Let's Encrypt) |

---

## Tax Compliance

### German Tax Law (BMF-2025)

| Rule | Implementation |
|------|---------------|
| **FIFO/LIFO/HIFO** | Configurable lot matching per user |
| **Haltefrist** (365 days) | Per-lot countdown, auto-detected tax-free disposals |
| **§23 EStG Freigrenze** | Private sales exemption (1,000/year) |
| **§22 Nr. 3 EStG** | Other income exemption (256/year) for staking/lending |
| **GoBD** | SHA-256 hash chain on audit logs, immutable export history |
| **DSGVO/GDPR** | No PII in logs, AES-256-GCM wallet encryption at rest |

### CoinTracking CSV Format

```
"Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date","Tx-ID","Buy Value in EUR","Sell Value in EUR"
"Trade","1,5","FLR","0,03","USDT","0,001","FLR","SparkDEX","","Swap","26.03.2026 14:30:00","0xabc...","0,04","0,04"
```

---

## Flare Network

| Constant | Value |
|----------|-------|
| Chain ID | 14 (mainnet), 114 (Coston2 testnet) |
| RPC | `https://flare-api.flare.network/ext/C/rpc` |
| Block Explorer | [flarescan.com](https://flarescan.com) |
| FTSO | On-chain price oracle (primary EUR source) |
| Key Tokens | FLR, WFLR, FXRP, USDT, SPRK, kFLR, kUSDT, APS, HLN, rFLR |

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | Done | Project setup, monorepo, CI/CD, infrastructure |
| **Phase 1** | Done | Core pipeline (indexer, pricing, classifier, tax engine, export, dashboard) |
| **Phase 2** | Next | Beta testing, wallet connect, real-time sync, notifications |
| **Phase 3** | Planned | Multi-chain support, ML classification, Steuerberater portal |
| **Phase 4** | Planned | SaaS launch, Stripe billing, onboarding flow |

---

## License

Proprietary. Copyright 2025-2026 NextGen IT Solutions GmbH. All rights reserved.
