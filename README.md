# DeFi Tracker SaaS

**On-Chain Tax Intelligence for Flare Network DeFi Users**

Fully automated, BMF-2025-compliant DeFi transaction tracking with CoinTracking CSV export, FIFO/LIFO tax lot matching, and real-time EUR pricing via Flare's FTSO oracle.

Built by [NextGen IT Solutions GmbH](https://nextgenitsolutions.de), Stuttgart.

**Live:** [app.defi.nextgenitsolutions.de](https://app.defi.nextgenitsolutions.de)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Core Business Modules](#core-business-modules)
- [Supported Protocols](#supported-protocols)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development Scripts](#development-scripts)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Infrastructure](#infrastructure)
- [Tax Compliance](#tax-compliance)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

DeFi Tracker SaaS solves the tax reporting problem for Flare Network DeFi users in Germany. On-chain transactions across SparkDEX, Enosys, Kinetic Market, and native staking are automatically indexed, classified, priced in EUR, and exported as CoinTracking-compatible CSV files.

**Key capabilities:**

- Automated wallet syncing via Flare RPC (chain ID 14)
- 5-layer transaction classification with Ampel system (GREEN/YELLOW/RED/GRAY)
- 4-tier EUR price engine: FTSO on-chain oracle, CoinGecko, CoinMarketCap, Manual
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
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS 3.4, shadcn/ui |
| **API** | tRPC 11 + Zod validation (end-to-end type safety) |
| **Database** | PostgreSQL 16 + Prisma ORM v6 (12 models, 12 enums) |
| **Queue** | Redis 7 + BullMQ v5 (wallet-sync, price-fetch, export-gen) |
| **Auth** | NextAuth.js v5 + TOTP 2FA + Argon2id password hashing |
| **Monorepo** | pnpm 9.15 workspaces + Turborepo 2.3 |
| **Language** | TypeScript 5.7+ (strict mode, 106 source files) |
| **Testing** | Vitest 3.0 + @vitest/coverage-v8 |
| **CI/CD** | GitHub Actions (4 self-hosted runners) + Docker + Coolify |
| **Hosting** | Hetzner dedicated server via Coolify PaaS |

---

## Monorepo Structure

```
nextgen-defi-saas/
├── apps/
│   └── web/                          # Next.js 15 frontend + tRPC API
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/           # Login, Register pages
│       │   │   ├── (dashboard)/      # Dashboard, Transactions, Wallets, Exports, Settings
│       │   │   └── api/              # tRPC routes, health endpoint, NextAuth, export download
│       │   ├── components/           # Dashboard widgets, TX components, layout
│       │   ├── lib/                  # tRPC client, auth, storage, wallet-connect
│       │   └── server/
│       │       ├── routers/          # 6 tRPC routers (dashboard, tx, wallet, export, user, app)
│       │       └── queue/            # BullMQ connection + 3 workers
│       └── package.json
├── packages/
│   ├── db/                           # Prisma schema, migrations, seed
│   │   └── prisma/
│   │       ├── schema.prisma         # 347 lines, 12 models, 12 enums
│   │       └── migrations/
│   ├── shared/                       # Core business logic
│   │   └── src/
│   │       ├── abis/                 # Smart contract ABIs (SparkDEX, Enosys, Kinetic)
│   │       ├── classifier/           # 5-layer TX classification engine + tests
│   │       ├── constants/            # Flare chain constants, token addresses
│   │       ├── export/               # CoinTracking CSV + PDF report + audit log + tests
│   │       ├── indexer/              # Flare RPC client, event decoder, wallet sync
│   │       ├── pricing/              # FTSO, CoinGecko, CMC, price engine + tests
│   │       ├── queue/                # BullMQ job definitions
│   │       ├── tax/                  # FIFO/LIFO lot matcher, Freigrenze, Haltefrist + tests
│   │       └── types/                # Shared TypeScript types
│   ├── ui/                           # shadcn/ui component library (Button, Card, Badge, KpiCard)
│   └── config/                       # Shared TypeScript configuration
├── docker/
│   ├── Dockerfile                    # Multi-stage production build (Node 20 Alpine)
│   ├── Dockerfile.dev                # Development build with hot-reload
│   ├── docker-compose.yml            # Full dev stack (PostgreSQL + Redis + app)
│   └── docker-compose.test.yml       # Ephemeral test databases
├── .github/workflows/
│   ├── ci.yml                        # Lint, type-check, unit tests, integration tests
│   ├── deploy.yml                    # Docker build → GHCR → Coolify → health check
│   ├── e2e.yml                       # Playwright E2E + accessibility tests
│   └── performance.yml               # k6 load tests (weekly)
├── turbo.json                        # Turborepo task pipeline
├── .eslintrc.cjs                     # ESLint 9 config (legacy mode)
└── package.json                      # Root workspace config (pnpm 9.15)
```

---

## Core Business Modules

### 1. Blockchain Indexer (`packages/shared/src/indexer/`)

Fetches and decodes on-chain transactions from Flare Network via JSON-RPC.

- **Flare RPC client** with automatic retry and rate limiting
- **ABI event decoder** for SparkDEX V3/V4, Enosys DEX + CDP, Kinetic Market
- **Wallet sync** orchestrator — BullMQ job triggers incremental block scanning
- Fallback to The Graph subgraph for historical data

### 2. EUR Price Engine (`packages/shared/src/pricing/`)

4-tier price resolution with full audit trail for GoBD compliance.

| Priority | Source | Type |
|----------|--------|------|
| 1 | FTSO | On-chain Flare Time Series Oracle |
| 2 | CoinGecko | REST API |
| 3 | CoinMarketCap | REST API |
| 4 | Manual | User-provided fallback |

- Every price logged to `price_audit_logs` table
- Z-Score anomaly detection (>3 sigma = warning)
- EUR-denominated (primary currency for German tax reporting)

### 3. TX Classification Engine (`packages/shared/src/classifier/`)

5-layer rule engine mapping raw transactions to CoinTracking types.

| Layer | Method |
|-------|--------|
| 1 | Protocol ABI match (exact contract + event) |
| 2 | Event pattern matching (Transfer, Swap, Deposit) |
| 3 | Heuristic rules (value patterns, address roles) |
| 4 | ML fallback (future) |
| 5 | Manual override |

**Ampel Status System:**
- **GREEN** — Auto-classified with high confidence
- **YELLOW** — Graubereich (ambiguous, needs review)
- **RED** — Unknown (unrecognized protocol/event)
- **GRAY** — Irrelevant (dust, failed TX, internal transfers)

**Dual-Scenario Modeling:** LP providing and CDP positions generate both Model A and Model B classifications for tax advisor review.

### 4. Tax Calculation Engine (`packages/shared/src/tax/`)

German tax law compliance for crypto disposals.

- **FIFO** (default), **LIFO**, **HIFO** lot matching
- **Haltefrist** — 365-day holding period tracker per lot
- **Freigrenze monitoring:**
  - 23 EStG: Private sales exemption limit (1,000/year)
  - 22 Nr. 3 EStG: Other income exemption limit (256/year)
- Gain/loss computation per disposal with EUR cost basis

### 5. CoinTracking Export Engine (`packages/shared/src/export/`)

Generates CoinTracking-compatible CSV files with GoBD compliance.

- **15-column CSV:** Type, Buy Amount, Buy Currency, Sell Amount, Sell Currency, Fee, Fee Currency, Exchange, Trade-Group, Comment, Date, Tx-ID, Buy Value EUR, Sell Value EUR
- **German format:** DD.MM.YYYY HH:MM:SS (UTC), comma as decimal separator
- **Audit integrity:** SHA-256 hash chain on `audit_logs`, versioned exports
- **PDF reports** for tax advisor handoff

---

## Supported Protocols

| Protocol | Type | Events Decoded |
|----------|------|---------------|
| **SparkDEX V3** | DEX (Uniswap V3 fork) | Swap, Mint, Burn, Collect, Flash |
| **SparkDEX V4** | DEX (concentrated liquidity) | Swap, ModifyLiquidity |
| **Enosys DEX** | DEX | Swap, AddLiquidity, RemoveLiquidity |
| **Enosys CDP** | Lending/Borrowing | Deposit, Withdraw, Borrow, Repay, Liquidate |
| **Kinetic Market** | Lending | Supply, Redeem, Borrow, RepayBorrow, LiquidateBorrow |
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

**Key Enums:** `PlanTier` (STARTER/PRO/BUSINESS/KANZLEI), `TxStatus` (GREEN/YELLOW/RED/GRAY), `PriceSource` (FTSO/COINGECKO/CMC/MANUAL), `TaxMethod` (FIFO/LIFO/HIFO), `ModelChoice` (MODEL_A/MODEL_B)

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9.15
- **PostgreSQL** 16
- **Redis** 7
- **Docker** (optional, for containerized dev)

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

# Start dev databases (Docker)
docker compose -f docker/docker-compose.yml up -d postgres redis

# Generate Prisma client + run migrations
pnpm --filter @defi-tracker/db exec prisma generate
pnpm --filter @defi-tracker/db exec prisma migrate dev

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Docker Development

```bash
docker compose -f docker/docker-compose.yml up
```

This starts PostgreSQL 16, Redis 7, and the Next.js app with hot-reload.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `NEXTAUTH_SECRET` | NextAuth.js session secret | Yes |
| `NEXTAUTH_URL` | Application URL (e.g., `http://localhost:3000`) | Yes |
| `FLARE_RPC_URL` | Flare Network RPC endpoint | Yes |
| `FLARE_CHAIN_ID` | Chain ID (14 for mainnet, 114 for Coston2) | No (default: 14) |
| `COINGECKO_API_KEY` | CoinGecko API key (tier 2 pricing) | No |
| `CMC_API_KEY` | CoinMarketCap API key (tier 3 pricing) | No |
| `STRIPE_SECRET_KEY` | Stripe payment secret key | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | No |
| `COOLIFY_API_URL` | Coolify instance URL (deployment) | No |
| `COOLIFY_API_TOKEN` | Coolify API token (deployment) | No |

---

## Development Scripts

### Root (Turborepo)

```bash
pnpm dev              # Start all packages in dev mode
pnpm build            # Production build
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript type checking
pnpm test:unit        # Unit tests (Vitest)
pnpm test:integration # Integration tests
pnpm test:e2e         # E2E tests (Playwright)
pnpm clean            # Clean all build artifacts
```

### Database (packages/db)

```bash
pnpm --filter @defi-tracker/db exec prisma generate    # Generate client
pnpm --filter @defi-tracker/db exec prisma migrate dev  # Run migrations (dev)
pnpm --filter @defi-tracker/db exec prisma migrate deploy # Run migrations (prod)
pnpm --filter @defi-tracker/db exec prisma studio       # Visual DB editor
pnpm --filter @defi-tracker/db db:seed                  # Seed database
```

---

## CI/CD Pipeline

All pipelines run on **4 self-hosted GitHub Actions runners** (Hetzner via Coolify).

### CI Workflow (`ci.yml`)

Triggers on push to `main`/`develop` and pull requests.

1. Start PostgreSQL 16 + Redis 7 service containers
2. `pnpm install --frozen-lockfile`
3. Generate Prisma client
4. **Lint** — ESLint across all packages
5. **Type check** — `tsc --noEmit` across all packages
6. **Unit tests** — Vitest with coverage
7. **Integration tests** — Against real PostgreSQL/Redis
8. **Security audit** — `audit-ci --high`

### Deploy Workflow (`deploy.yml`)

Triggers on push to `main` or manual dispatch.

1. Wait for CI to pass
2. Build multi-stage Docker image (Node 20 Alpine)
3. Push to GitHub Container Registry (`ghcr.io`)
4. Trigger Coolify application restart via API
5. Health check validation (`/api/health`, 20 retries)
6. Post deployment summary

### E2E Workflow (`e2e.yml`)

Triggers on push to `main`.

- Playwright browser tests + accessibility checks
- Uploads test reports as artifacts

---

## Deployment

### Production Stack

```
GitHub (push to main)
    → GitHub Actions (4 self-hosted runners)
        → Docker build (multi-stage, Node 20 Alpine)
            → Push to ghcr.io
                → Coolify API restart
                    → Health check (/api/health)
                        → Live at app.defi.nextgenitsolutions.de
```

### Docker Image

The production Dockerfile (`docker/Dockerfile`) performs:

1. **Build stage:** Install deps → Prisma generate → Turbo build (standalone output)
2. **Run stage:** Copy standalone + static + Prisma migrations → Run as non-root user
3. **Startup:** `prisma migrate deploy` (auto-migrate) → `node apps/web/server.js`

### Health Check

```
GET /api/health

{
  "status": "ok",
  "timestamp": "2026-03-26T18:53:57.586Z",
  "version": "0.1.0",
  "db": "connected",
  "redis": "not_configured"
}
```

Returns HTTP 200 when healthy, 503 when degraded.

---

## Infrastructure

| Component | Details |
|-----------|---------|
| **Hosting** | Hetzner dedicated server (195.201.217.132) |
| **PaaS** | Coolify v4.0.0-beta.460 (self-hosted) |
| **Domain** | app.defi.nextgenitsolutions.de (GoDaddy DNS) |
| **Container Registry** | GitHub Container Registry (ghcr.io) |
| **CI Runners** | 4x `myoung34/github-runner` via Coolify |
| **Database** | PostgreSQL 16 Alpine (Coolify managed) |
| **Cache/Queue** | Redis 7.2 (Coolify managed) |
| **SSL** | Automatic via Coolify (Let's Encrypt) |

---

## Tax Compliance

### German Tax Law (BMF-2025)

| Rule | Implementation |
|------|---------------|
| **FIFO/LIFO** | Configurable lot matching method per user |
| **Haltefrist** (365 days) | Per-lot countdown, auto-detected tax-free disposals |
| **23 EStG Freigrenze** | Private sales exemption (1,000/year) with real-time monitor |
| **22 Nr. 3 EStG Freigrenze** | Other income exemption (256/year) for staking/lending |
| **GoBD Compliance** | SHA-256 hash chain on audit logs, immutable export history |
| **DSGVO/GDPR** | No PII in logs, AES-256-GCM wallet encryption at rest |

### CoinTracking CSV Format

15-column export matching CoinTracking's import specification:

```
"Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date","Tx-ID","Buy Value in EUR","Sell Value in EUR"
"Trade","1,5","FLR","0,03","USDT","0,001","FLR","SparkDEX","","Swap via SparkDEX V3","26.03.2026 14:30:00","0xabc...","0,04","0,04"
```

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | Done | Project setup, monorepo, CI/CD, infrastructure |
| **Phase 1** | Done | Core pipeline (indexer, pricing, classifier, tax engine, export, dashboard) |
| **Phase 2** | Next | Beta testing, wallet connect (MetaMask), real-time sync, notifications |
| **Phase 3** | Planned | Multi-chain support, ML classification, Steuerberater portal |
| **Phase 4** | Planned | SaaS launch, Stripe billing, onboarding flow |

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

## License

Proprietary. Copyright 2025-2026 NextGen IT Solutions GmbH. All rights reserved.
