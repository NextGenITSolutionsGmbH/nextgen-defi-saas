# DeFi Tracker SaaS

**On-Chain Tax Intelligence for Flare Network DeFi Users**

Automated, BMF-2025-compliant DeFi transaction tracking with CoinTracking CSV export, FIFO/LIFO/HIFO tax lot matching, and real-time EUR pricing via Flare's FTSO on-chain oracle. Built for German tax law -- Haltefrist (365-day holding period), Freigrenze thresholds, and GoBD-compliant audit trails.

[![CI](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/e2e.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/e2e.yml)
[![Deploy](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/deploy.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/deploy.yml)
[![Performance Tests](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/performance.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/performance.yml)
[![Spec Coverage](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/spec-coverage.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/spec-coverage.yml)

Built by [NextGen IT Solutions GmbH](https://nextgenitsolutions.de), Stuttgart.

**Live:** [app.defi.nextgenitsolutions.de](https://app.defi.nextgenitsolutions.de)

---

## Features at a Glance

- **Automated Wallet Sync** -- Real-time Flare RPC indexing with incremental block scanning and BullMQ job orchestration
- **7 Supported Protocols** -- SparkDEX V3, SparkDEX V4, Enosys DEX, Enosys CDP, Kinetic Market, FLR Staking/Delegation, WFLR Wrap/Unwrap
- **5-Layer Classification Engine** -- Protocol ABI match, event pattern matching, heuristic rules, ML fallback (future), manual override
- **Ampel Traffic Light System** -- GREEN (auto-classified), YELLOW (ambiguous, needs review), RED (unknown, manual required), GRAY (no tax relevance)
- **4-Tier EUR Price Engine** -- FTSO on-chain oracle, CoinGecko API, CoinMarketCap API, manual fallback with Z-Score anomaly detection
- **Tax Lot Matching** -- FIFO (default), LIFO, and HIFO methods with per-lot Haltefrist (365-day) countdown tracking
- **BMF-2025 Compliant Export** -- CoinTracking 15-column CSV, XLSX, and PDF formats with SHA-256 hash chain (GoBD audit trail)
- **4 Plan Tiers** -- STARTER (free), PRO, BUSINESS, KANZLEI with Stripe subscription billing
- **TOTP Two-Factor Authentication** -- RFC 6238 TOTP via otplib with AES-256-GCM encrypted secret storage
- **Stripe Billing Integration** -- Checkout sessions, billing portal, webhook lifecycle management, plan-based feature enforcement
- **GoBD Audit Trail** -- Immutable hash-chained audit logs, versioned exports, SHA-256 integrity verification
- **Dual-Scenario Tax Modeling** -- Model A (Tauschmodell) and Model B (Nutzungsueberlassung) for LP/CDP Graubereich transactions
- **DSGVO/GDPR Compliance** -- Art. 15 data export, Art. 17 account deletion, no PII in logs, AES-256-GCM encryption at rest

---

## Table of Contents

- [Features at a Glance](#features-at-a-glance)
- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Core Modules](#core-modules)
- [Supported Protocols](#supported-protocols)
- [Plan Tiers](#plan-tiers)
- [Database Schema](#database-schema)
- [API Routes and tRPC Routers](#api-routes-and-trpc-routers)
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
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## Overview

German DeFi users face a significant tax reporting burden. Every on-chain swap, LP provision, staking reward, and lending interaction is a taxable event under German tax law (BMF-Schreiben 2025). Manual tracking across multiple protocols is error-prone and time-consuming, and existing tools lack Flare Network support entirely.

DeFi Tracker SaaS solves this by automatically indexing on-chain transactions across all major Flare Network protocols, classifying them according to German tax categories, pricing them in EUR via Flare's native FTSO oracle, and exporting them in CoinTracking-compatible formats ready for tax filing.

**Key capabilities:**

- Automated wallet syncing via Flare RPC (chain ID 14) with incremental block scanning
- 5-layer transaction classification with the Ampel traffic light system (GREEN/YELLOW/RED/GRAY)
- 4-tier EUR price engine: FTSO on-chain oracle > CoinGecko > CoinMarketCap > Manual
- FIFO/LIFO/HIFO tax lot matching with Haltefrist (365-day holding period) tracking
- BMF-2025-compliant CoinTracking 15-column CSV export
- GoBD audit trail with SHA-256 hash chain for tamper-proof record keeping
- Dual-scenario modeling (Model A/B) for LP providing and CDP positions in legal gray areas
- Freigrenze monitoring for both private sales (1,000 EUR/year) and other income (256 EUR/year)
- DSGVO/GDPR-compliant data handling with full Art. 15 export and Art. 17 deletion support

**Target user personas:**

| Persona | Role | Key Need |
|---------|------|----------|
| **Kai** | DeFi Expert | Advanced classification, dual-scenario modeling, multi-wallet management |
| **Lena** | DeFi Beginner | Simple one-click export, clear Ampel status, guided classification |
| **Marcus** | Institutional Trader | API access, bulk operations, KANZLEI-tier limits, XLSX export |
| **Andrea** | Tax Accountant (Steuerberater) | Multi-client management, GoBD-compliant PDF reports, audit trails |

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
               |   13 models     |                      |    4 workers     |
               +--------+--------+                      +---------+--------+
                        |                                         |
                        |                    +--------------------+--------------------+--------------------+
                        |                    |                    |                    |                    |
                        |           +--------v------+   +--------v------+   +---------v-----+   +--------v-------+
                        |           | wallet-sync   |   | price-fetch   |   | export-gen    |   | email-send     |
                        |           | (Flare RPC)   |   | (FTSO/CG/CMC) |   | (CSV/XLSX/PDF)|   | (Resend)       |
                        |           +---------------+   +---------------+   +---------------+   +----------------+
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

**BullMQ Workers:**

| Worker | Queue | Purpose |
|--------|-------|---------|
| **wallet-sync** | `wallet-sync` | Indexes Flare RPC blocks for a given wallet, decodes ABI events, stores transactions and legs |
| **price-fetch** | `price-fetch` | Resolves EUR prices through the 4-tier cascade (FTSO > CoinGecko > CMC > Manual) with anomaly detection |
| **export-gen** | `export-gen` | Generates CoinTracking CSV, XLSX, or PDF files with SHA-256 hash chain and GoBD audit logging |
| **email-send** | `email-send` | Delivers transactional emails via Resend (export complete, sync errors, tax reminders) |

**Data flow:** Wallet added > wallet-sync job queued > RPC blocks fetched > ABI events decoded > transactions + legs stored > price-fetch resolves EUR values > classifier assigns Ampel status > dashboard updated > export-gen produces tax report on demand.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js (Alpine) | 24.14.1 |
| **Language** | TypeScript (strict mode) | 5.7+ |
| **Frontend** | Next.js (App Router) | 15 |
| **UI Framework** | React | 19 |
| **Styling** | Tailwind CSS + PostCSS | 4 |
| **Component Library** | shadcn/ui | Latest |
| **API Layer** | tRPC | 11 (RC) |
| **Validation** | Zod | Latest |
| **Database** | PostgreSQL | 16 |
| **ORM** | Prisma | 6 |
| **Cache / Queue** | Redis | 7 |
| **Job Queue** | BullMQ | 5 |
| **Authentication** | NextAuth.js (Auth.js) | v5 (beta) |
| **2FA** | otplib (TOTP RFC 6238) | Latest |
| **Payments** | Stripe (subscriptions) | Latest |
| **Email** | Resend | Latest |
| **Export (XLSX)** | ExcelJS | Latest |
| **Export (PDF)** | jsPDF | Latest |
| **Monorepo** | pnpm workspaces + Turborepo | pnpm 9.15.4 / Turbo 2.3+ |
| **Containerization** | Docker (multi-stage) | Latest |
| **E2E Testing** | Playwright (Chromium + Pixel 5) | 1.51+ |
| **Unit/Integration Testing** | Vitest | Latest |
| **Performance Testing** | k6 | Latest |
| **Accessibility Testing** | axe-core (via Playwright) | 4.10+ |
| **CI/CD** | GitHub Actions (self-hosted) | Latest |
| **PaaS** | Coolify | Latest |
| **Hosting** | Hetzner dedicated server | -- |

---

## Monorepo Structure

```
nextgen-defi-saas/
├── apps/
│   └── web/                              # Next.js 15 frontend + tRPC API
│       └── src/
│           ├── app/
│           │   ├── (auth)/               # Login, Register pages
│           │   ├── (dashboard)/          # Overview, Transactions, Wallets, Exports, Settings
│           │   └── api/
│           │       ├── auth/             # NextAuth.js API routes
│           │       ├── health/           # Health check endpoint
│           │       ├── exports/          # Export file download
│           │       ├── trpc/             # tRPC HTTP handler
│           │       └── webhooks/
│           │           └── stripe/       # Stripe webhook handler
│           ├── components/               # Dashboard widgets, TX list, layout
│           ├── lib/
│           │   ├── auth.ts               # NextAuth configuration
│           │   ├── auth-utils.ts         # Password hashing, TOTP generation/verification
│           │   ├── crypto.ts             # AES-256-GCM encryption for TOTP secrets
│           │   ├── rate-limit.ts         # Redis sliding window rate limiter
│           │   ├── stripe.ts             # Stripe client and price ID configuration
│           │   └── trpc.ts               # tRPC client setup
│           └── server/
│               ├── trpc.ts               # tRPC context, middleware, procedures
│               ├── lib/
│               │   ├── cache.ts          # Redis-backed response caching
│               │   └── plan-limits.ts    # Plan tier enforcement (wallets, TX, formats)
│               ├── routers/
│               │   ├── _app.ts           # Root router (6 sub-routers)
│               │   ├── user.ts           # Profile, 2FA, password, Stripe, DSGVO
│               │   ├── wallet.ts         # Add, remove, sync, status
│               │   ├── transaction.ts    # List, detail, classify, bulk, dual-scenario
│               │   ├── export.ts         # Create, list, download, preview, regenerate
│               │   ├── dashboard.ts      # Summary, KPIs, Ampel, portfolio, Haltefrist
│               │   └── notification.ts   # Preferences get/update
│               └── queue/                # BullMQ connection + worker definitions
├── packages/
│   ├── db/                               # Prisma schema, migrations, seed
│   │   └── prisma/
│   │       ├── schema.prisma             # 13 models, 12 enums
│   │       ├── seed.sql                  # Idempotent test user seed
│   │       ├── migrations/              # Versioned SQL migrations
│   │       └── migration_lock.toml       # Migration provider lock
│   ├── shared/                           # Core business logic
│   │   └── src/
│   │       ├── abis/                     # Smart contract ABIs (SparkDEX, Enosys, Kinetic, WFLR)
│   │       ├── classifier/               # 5-layer TX classification engine
│   │       ├── constants/                # Flare chain constants, token addresses, contract addresses
│   │       ├── export/                   # CoinTracking CSV + XLSX + PDF generation + audit log
│   │       ├── indexer/                  # Flare RPC client, event decoder, wallet sync orchestrator
│   │       ├── pricing/                  # FTSO, CoinGecko, CMC price engine with anomaly detection
│   │       ├── queue/                    # BullMQ job definitions and queue constants
│   │       ├── tax/                      # FIFO/LIFO/HIFO lot matcher, Freigrenze, Haltefrist
│   │       └── types/                    # Shared TypeScript type definitions
│   ├── ui/                               # shadcn/ui component library
│   └── config/                           # Shared TypeScript configuration
├── docker/
│   ├── Dockerfile                        # Multi-stage production (Node 24.14.1 Alpine)
│   ├── Dockerfile.dev                    # Development with hot-reload + volume mounts
│   ├── docker-compose.yml                # Full dev stack (PostgreSQL + Redis + app)
│   ├── docker-compose.test.yml           # Ephemeral test databases (tmpfs)
│   └── entrypoint.sh                     # Production startup: migrate > seed > start
├── tests/
│   ├── e2e/                              # Playwright E2E + accessibility specs
│   ├── helpers/                          # Auth + DB test helpers
│   ├── fixtures/                         # Test data (transactions.json)
│   ├── k6/                               # k6 performance test scripts (smoke, load, db-perf, api-scenarios)
│   ├── mcp/                              # MCP interactive test playbook
│   └── setup.ts                          # Vitest global setup
├── scripts/
│   ├── test-e2e.sh                       # Local E2E convenience script (Docker setup + test + teardown)
│   ├── check-spec-refs.sh                # Spec reference coverage checker
│   └── migrate-totp-secrets.ts           # TOTP secret encryption migration utility
├── datasource/
│   ├── DeFiTracker_PRD_v2.md             # Product Requirements Document
│   ├── DeFi_Tracker_Komplett_v10_NextGen.md  # Full Technical Analysis
│   └── DeFiTracker_BrandBook_KOMPLETT_v1.md  # Brand Guidelines
├── docs/
│   └── traceability-matrix.md            # Requirement-to-code mapping
├── .github/workflows/
│   ├── ci.yml                            # Lint, type-check, unit + integration tests
│   ├── e2e.yml                           # Playwright E2E + accessibility tests
│   ├── deploy.yml                        # Docker build > GHCR > Coolify > health check
│   ├── performance.yml                   # k6 load tests (weekly)
│   └── spec-coverage.yml                 # @spec tag coverage report on PRs
├── turbo.json                            # Turborepo task pipeline
├── package.json                          # Root workspace scripts
├── pnpm-workspace.yaml                   # pnpm workspace definition
├── .nvmrc                                # Node.js version (24.14.1)
├── CLAUDE.md                             # AI agent development instructions
└── CONTRIBUTING.md                       # Spec-driven development workflow
```

---

## Core Modules

### 1. Blockchain Indexer

**Location:** `packages/shared/src/indexer/`

- Flare RPC client with automatic retry and configurable rate limiting
- ABI event decoder for SparkDEX V3/V4, Enosys DEX + CDP, Kinetic Market, FLR staking, WFLR wrapping
- BullMQ `wallet-sync` job orchestrator with incremental block scanning (resumes from `lastSyncBlock`)
- Stores decoded transactions and individual transaction legs (token movements) with direction (IN/OUT)

### 2. EUR Price Engine

**Location:** `packages/shared/src/pricing/`

4-tier waterfall with automatic fallback:

| Priority | Source | Type | Notes |
|----------|--------|------|-------|
| 1 | FTSO | On-chain Flare Time Series Oracle | Primary source, decentralized, no API key needed |
| 2 | CoinGecko | REST API | Requires `COINGECKO_API_KEY` for higher rate limits |
| 3 | CoinMarketCap | REST API | Requires `CMC_API_KEY` |
| 4 | Manual | User-provided fallback | Last resort for unlisted tokens |

- Every price lookup is logged to `price_audit_logs` for GoBD compliance
- Z-Score anomaly detection flags prices deviating more than 3 standard deviations
- Fallback reasons are recorded when a higher-priority source fails

### 3. TX Classification Engine

**Location:** `packages/shared/src/classifier/`

5-layer classification pipeline:

| Layer | Method | Description |
|-------|--------|-------------|
| 1 | Protocol ABI match | Exact contract address + event signature match |
| 2 | Event pattern matching | Generic Transfer, Swap, Deposit, Withdrawal patterns |
| 3 | Heuristic rules | Value patterns, address roles, gas analysis |
| 4 | ML fallback | Planned for future release |
| 5 | Manual override | User or tax advisor manually sets the classification |

Each transaction receives a CoinTracking-compatible type (Trade, Staking, LP Rewards, Lending Einnahme, etc.) and is assigned an Ampel status.

### 4. Ampel Traffic Light System

The Ampel system provides a clear, at-a-glance classification confidence indicator for every transaction:

| Status | Meaning | When Assigned |
|--------|---------|---------------|
| **GREEN** | Fully classified | ABI + event match succeeded; classification is reliable and ready for export |
| **YELLOW** | Ambiguous / Graubereich | Multiple valid interpretations exist (e.g., LP providing could be Model A or Model B); requires user review with dual-scenario selection |
| **RED** | Unknown / unclassified | No classifier layer could determine the type; manual classification required before export |
| **GRAY** | No tax relevance | Transaction has no tax implications (e.g., failed transactions, contract deployments, zero-value transfers) |

The dashboard provides an Ampel breakdown showing the distribution across all four statuses, enabling users to quickly identify transactions that need attention before generating a tax export.

### 5. Tax Calculation Engine

**Location:** `packages/shared/src/tax/`

- **FIFO** (First In, First Out) -- default method, recommended by BMF
- **LIFO** (Last In, First Out) -- alternative method, configurable per export
- **HIFO** (Highest In, First Out) -- for tax optimization scenarios
- **Haltefrist** -- 365-day holding period tracker per tax lot; disposals after the holding period are tax-free under Paragraph 23 EStG
- **Freigrenze monitoring:**
  - Paragraph 23 EStG: Private sales exemption of 1,000 EUR/year
  - Paragraph 22 Nr. 3 EStG: Other income exemption of 256 EUR/year (staking, lending rewards)
- **Gain/loss computation** per disposal with EUR cost basis from the matched tax lot
- **Dual-scenario modeling:** Model A (Tauschmodell / Paragraph 23 EStG) and Model B (Nutzungsueberlassung / Paragraph 22 Nr. 3 EStG) for LP providing and CDP positions where tax treatment is legally ambiguous

### 6. CoinTracking Export Engine

**Location:** `packages/shared/src/export/`

- **CSV** -- 15-column format matching the CoinTracking import specification exactly
- **XLSX** -- Multi-sheet Excel workbook with summary page, transaction detail, and tax lot inventory (PRO+)
- **PDF** -- Formatted tax report suitable for Steuerberater (tax advisor) handoff (PRO+)
- German date/number format: DD.MM.YYYY HH:MM:SS (UTC), comma decimal separator
- SHA-256 hash chain on `audit_logs` for tamper detection (GoBD compliance)
- Each export is versioned and stores a file hash for integrity verification
- BullMQ `export-gen` worker handles asynchronous generation with status tracking (PENDING > GENERATING > COMPLETED / FAILED)

### 7. Payment and Billing

**Location:** `apps/web/src/app/api/webhooks/stripe/`

- Stripe subscription management with 4 plan tiers (STARTER / PRO / BUSINESS / KANZLEI)
- Stripe Checkout Session creation for plan upgrades
- Stripe Billing Portal for subscription management (cancel, change card, view invoices)
- Webhook handler for subscription lifecycle events (created, updated, deleted, payment failed)
- Plan-based feature enforcement: wallet limits, export format restrictions, API access gating

### 8. Notification System

**Location:** `apps/web/src/server/routers/notification.ts` and `apps/web/src/server/queue/workers/`

- User-configurable notification preferences:
  - Export complete -- notified when an export finishes generating
  - Sync error -- notified when a wallet sync encounters an error
  - Tax reminder -- periodic reminders for tax filing deadlines
- Email delivery via Resend with branded HTML templates
- BullMQ `email-send` worker for reliable async delivery with retry logic

### 9. Rate Limiting

**Location:** `apps/web/src/lib/rate-limit.ts`

- Redis-backed sliding window rate limiter
- Per-endpoint rate limit configuration (e.g., wallet sync: 5 requests per 60 seconds)
- Per-user rate limits tied to the authenticated session
- Applied via tRPC middleware using `createRateLimitedProcedure`

### 10. Auth and 2FA

**Location:** `apps/web/src/lib/auth.ts` and `apps/web/src/lib/auth-utils.ts`

- NextAuth.js v5 (beta) with credentials provider (email + password)
- bcryptjs password hashing with salt rounds
- TOTP two-factor authentication via otplib (RFC 6238):
  - Setup flow: generate secret > display QR code > verify token > enable
  - TOTP secrets encrypted at rest with AES-256-GCM via `TOTP_ENCRYPTION_KEY`
  - Disable flow requires a valid TOTP token for security
- Session management via JWT tokens with user ID, email, and plan tier in the payload

---

## Supported Protocols

| Protocol | Type | Contract Category | Events Decoded |
|----------|------|-------------------|---------------|
| **SparkDEX V3** | DEX (Uniswap V3 fork) | Concentrated liquidity AMM | Swap, Mint, Burn, Collect, Flash |
| **SparkDEX V4** | DEX (next-gen) | Concentrated liquidity AMM | Swap, ModifyLiquidity |
| **Enosys DEX** | DEX | Standard AMM | Swap, AddLiquidity, RemoveLiquidity |
| **Enosys CDP** | Lending / Borrowing | Collateralized Debt Position | Deposit, Withdraw, Borrow, Repay, Liquidate |
| **Kinetic Market** | Lending | Compound-style market | Supply, Redeem, Borrow, RepayBorrow |
| **FLR Staking** | Native staking | Flare delegation system | Delegate, Undelegate, ClaimReward |
| **WFLR Wrapping** | Token wrap/unwrap | Wrapped FLR contract | Deposit, Withdrawal |

---

## Plan Tiers

Feature availability by subscription tier, as defined in `apps/web/src/server/lib/plan-limits.ts`:

| Feature | STARTER | PRO | BUSINESS | KANZLEI |
|---------|---------|-----|----------|---------|
| **Max Wallets** | 1 | 5 | 20 | 100 |
| **TX per Month** | 100 | Unlimited | Unlimited | Unlimited |
| **Export: CSV** | Yes | Yes | Yes | Yes |
| **Export: PDF** | -- | Yes | Yes | Yes |
| **Export: XLSX** | -- | -- | Yes | Yes |
| **API Access** | -- | -- | Yes | Yes |
| **Price** | Free | Paid | Paid | Paid |

Plan limits are enforced server-side via `enforceWalletLimit`, `enforceMonthlyTxLimit`, and `enforceExportFormat` middleware functions. Attempting to exceed a plan limit returns a `FORBIDDEN` tRPC error with a descriptive upgrade message.

---

## Database Schema

13 models and 12 enums, PostgreSQL 16 via Prisma ORM v6.

### Entity Relationship Overview

```
User ──< Wallet ──< Transaction ──< TxLeg
  │                      │              └──< TxClassification
  │                      └──< TokenPrice
  ├──< TaxLot ──< TaxEvent
  ├──< Export
  ├──< Subscription
  ├──< NotificationPreference
  └──< AuditLog

PriceAuditLog (standalone -- GoBD compliance)
```

### Models

| Model | Table | Description |
|-------|-------|-------------|
| **User** | `users` | User account with email, password hash, plan tier, Stripe customer ID, TOTP 2FA fields |
| **Wallet** | `wallets` | Blockchain wallet with address, chain ID, sync status, last synced block number |
| **Transaction** | `transactions` | On-chain transaction with hash, block number/timestamp, protocol, Ampel status, raw data |
| **TxLeg** | `tx_legs` | Individual token movement within a transaction (direction IN/OUT, amount, EUR value) |
| **TxClassification** | `tx_classifications` | CoinTracking-compatible classification with buy/sell/fee amounts, price source, model choice |
| **TokenPrice** | `token_prices` | Historical EUR price for a token at a specific timestamp, sourced from FTSO/CoinGecko/CMC/Manual |
| **TaxLot** | `tax_lots` | Tax lot with acquisition cost, date, remaining amount, FIFO/LIFO/HIFO method, lot status (OPEN/CLOSED/PARTIAL) |
| **TaxEvent** | `tax_events` | Realized gain/loss event linked to a classification and tax lot, with holding period and tax year |
| **AuditLog** | `audit_logs` | GoBD-compliant immutable audit trail with SHA-256 hash chain and previous hash reference |
| **Export** | `exports` | Generated export file metadata with format, status (PENDING/GENERATING/COMPLETED/FAILED), file hash |
| **PriceAuditLog** | `price_audit_logs` | Standalone pricing audit trail logging attempted source, result source, fallback reason |
| **NotificationPreference** | `notification_preferences` | Per-user notification settings (export complete, sync error, tax reminder) |
| **Subscription** | `subscriptions` | Stripe subscription record with plan, status (ACTIVE/CANCELED/PAST_DUE/TRIALING), period dates |

### Enums

| Enum | Values | Used By |
|------|--------|---------|
| **PlanTier** | STARTER, PRO, BUSINESS, KANZLEI | User, Subscription |
| **SyncStatus** | IDLE, SYNCING, COMPLETED, ERROR | Wallet |
| **TxStatus** | GREEN, YELLOW, RED, GRAY | Transaction |
| **Direction** | IN, OUT | TxLeg |
| **PriceSource** | FTSO, COINGECKO, CMC, MANUAL | TxClassification, TokenPrice |
| **ModelChoice** | MODEL_A, MODEL_B | TxClassification |
| **TaxMethod** | FIFO, LIFO, HIFO | TaxLot, Export |
| **TaxEventType** | PARAGRAPH_23, PARAGRAPH_22_NR3 | TaxEvent |
| **LotStatus** | OPEN, CLOSED, PARTIAL | TaxLot |
| **ExportFormat** | CSV, XLSX, PDF | Export |
| **ExportStatus** | PENDING, GENERATING, COMPLETED, FAILED | Export |
| **SubStatus** | ACTIVE, CANCELED, PAST_DUE, TRIALING | Subscription |

### Key Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `uq_wallet_address_chain` | `(address, chainId)` | Prevent duplicate wallets per chain |
| `idx_tx_wallet_timestamp` | `(walletId, blockTimestamp)` | Fast transaction listing with date filters |
| `idx_tx_wallet_protocol` | `(walletId, protocol)` | Protocol-based transaction queries |
| `idx_tax_lot_user_symbol_date` | `(userId, tokenSymbol, acquisitionDate)` | FIFO/LIFO lot matching lookup |
| `idx_tax_event_user_year` | `(userId, taxYear)` | Tax year aggregation |
| `idx_export_user_year` | `(userId, taxYear)` | Export listing by tax year |
| `idx_audit_entity` | `(entityType, entityId)` | Audit log lookup by entity |
| `idx_price_audit_symbol_ts` | `(tokenSymbol, timestampUnix)` | Price audit trail queries |
| `uq_token_price_symbol_chain_ts` | `(tokenSymbol, chainId, timestampUnix)` | Prevent duplicate price entries |

---

## API Routes and tRPC Routers

### Next.js App Router Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth.js authentication endpoints (sign in, sign out, session) |
| `/api/trpc/[trpc]` | GET, POST | tRPC HTTP handler for all typed API procedures |
| `/api/health` | GET | Health check returning status, timestamp, version, DB/Redis connectivity |
| `/api/exports/[id]` | GET | Export file download (authenticated, ownership verified) |
| `/api/webhooks/stripe` | POST | Stripe webhook receiver for subscription lifecycle events |

### tRPC Routers

The API is composed of 6 tRPC routers registered in `apps/web/src/server/routers/_app.ts`:

#### `user` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `user.me` | Query | Current user profile with wallet/export/TX counts |
| `user.updatePlan` | Mutation | Update subscription plan tier |
| `user.updateTaxMethod` | Mutation | Validate and return tax method preference |
| `user.changePassword` | Mutation | Change password (requires current password) |
| `user.setup2fa` | Mutation | Generate TOTP secret and otpauth URI for QR code |
| `user.verify2fa` | Mutation | Verify TOTP token and enable 2FA |
| `user.disable2fa` | Mutation | Disable 2FA (requires valid TOTP token) |
| `user.exportPersonalData` | Query | DSGVO Art. 15 -- export all personal data as JSON |
| `user.deleteAccount` | Mutation | DSGVO Art. 17 -- delete account and all data (requires password + "DELETE" confirmation) |
| `user.createCheckoutSession` | Mutation | Create Stripe Checkout Session for plan upgrade |
| `user.createBillingPortalSession` | Mutation | Create Stripe Billing Portal session |

#### `wallet` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `wallet.list` | Query | List all wallets with TX counts and sync status |
| `wallet.add` | Mutation | Add wallet (enforces plan wallet limit) |
| `wallet.remove` | Mutation | Remove wallet and cascade-delete transactions |
| `wallet.sync` | Mutation | Trigger wallet sync via BullMQ (rate limited: 5/min) |
| `wallet.syncStatus` | Query | Check current sync status and last synced block |

#### `transaction` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `transaction.list` | Query | Paginated, filterable TX list (wallet, status, protocol, date range, search) |
| `transaction.detail` | Query | Full TX detail with legs and classification history |
| `transaction.classify` | Mutation | Manual classification with CoinTracking type (rate limited: 30/min) |
| `transaction.setDualScenario` | Mutation | Set Model A/B for YELLOW Graubereich transactions |
| `transaction.bulkClassify` | Mutation | Bulk classify up to 100 transactions (rate limited: 5/min) |
| `transaction.stats` | Query | TX counts grouped by status and protocol |

#### `export` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `export.create` | Mutation | Create export job (enforces plan format limits, rate limited: 3/min) |
| `export.list` | Query | List all exports with metadata (last 50) |
| `export.download` | Query | Get download URL for completed export |
| `export.previewCount` | Query | Preview TX count for a given tax year and wallet selection |
| `export.regenerate` | Mutation | Re-generate a previous export with same parameters (rate limited: 3/min) |

#### `dashboard` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `dashboard.summary` | Query | Overview counts: wallets, TX, classified, pending exports, syncing (cached 30s) |
| `dashboard.kpis` | Query | KPIs: classified %, Freigrenze usage, recent TX count (cached 60s) |
| `dashboard.ampelBreakdown` | Query | Ampel status distribution with counts and percentages (cached 60s) |
| `dashboard.recentTransactions` | Query | Last 10 transactions with classification type (cached 15s) |
| `dashboard.monthlyActivity` | Query | TX count per month for last 12 months (cached 300s) |
| `dashboard.portfolioSummary` | Query | Realized gains/losses, tax-free gains, open positions by token (cached 60s) |
| `dashboard.classificationProgress` | Query | Classification completion by protocol (cached 60s) |
| `dashboard.haltefristUpcoming` | Query | Tax lots approaching 365-day holding period within 30 days (cached 300s) |

#### `notification` Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `notification.getPreferences` | Query | Get or create notification preferences (upsert with defaults) |
| `notification.updatePreferences` | Mutation | Update notification preferences (export complete, sync error, tax reminder) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 24 (24.14.1 recommended -- see `.nvmrc`)
- **pnpm** >= 9.15 (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **PostgreSQL** 16
- **Redis** 7
- **Docker** (for containerized development and testing)

### Path A: Local Development

```bash
# Clone the repository
git clone https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas.git
cd nextgen-defi-saas

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and configuration

# Start development databases (PostgreSQL + Redis)
docker compose -f docker/docker-compose.yml up -d db redis

# Generate Prisma client
pnpm --filter @defi-tracker/db exec prisma generate

# Run database migrations
pnpm --filter @defi-tracker/db exec prisma migrate dev

# Seed test data (optional -- creates 3 test users)
pnpm --filter @defi-tracker/db db:seed

# Start development server with Turbopack
pnpm dev
```

The application will be available at http://localhost:3000.

### Path B: Docker Development

Full stack with PostgreSQL, Redis, and Next.js with hot-reload:

```bash
# Start all services
docker compose -f docker/docker-compose.yml up

# Or run in detached mode
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f app
```

The Docker Compose configuration automatically:
- Starts PostgreSQL 16 Alpine on port 5432
- Starts Redis 7 Alpine on port 6379
- Builds the dev image with hot-reload volume mounts
- Configures service health checks and dependency ordering

The application will be available at http://localhost:3000.

### Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"...","version":"0.1.0","db":"connected","redis":"not_configured"}
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure the values for your environment.

### Coolify / Deployment

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `COOLIFY_API_URL` | Coolify instance URL | Deploy only | `https://your-coolify-instance.example.com` |
| `COOLIFY_API_TOKEN` | Coolify API authentication token | Deploy only | (secret) |

### GitHub

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `GITHUB_PAT` | GitHub Personal Access Token | Deploy only | (secret) |
| `GITHUB_REPO` | GitHub repository identifier | Deploy only | `your-org/your-repo` |

### DNS

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `DOMAIN` | Application domain name | Deploy only | `app.defi.yourdomain.de` |
| `SERVER_IPV4` | Server IPv4 address | Deploy only | `0.0.0.0` |
| `SERVER_IPV6` | Server IPv6 address | Deploy only | `::1` |

### Database and Session

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://defitracker:defitracker_dev@localhost:5432/defitracker` |
| `REDIS_URL` | Redis connection string | Yes | `redis://localhost:6379` |
| `NEXTAUTH_SECRET` | NextAuth session signing secret (generate with `openssl rand -base64 32`) | Yes | `change-me-in-production` |
| `NEXTAUTH_URL` | Application base URL | Yes | `http://localhost:3000` |

### Flare Network RPC

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `FLARE_RPC_URL` | Flare Network RPC endpoint | Yes | `https://flare-api.flare.network/ext/C/rpc` |
| `FLARE_CHAIN_ID` | Flare chain ID | No | `14` |

### Price APIs

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `COINGECKO_API_KEY` | CoinGecko API key (tier 2 pricing source) | No | (empty = tier 1 public) |
| `CMC_API_KEY` | CoinMarketCap API key (tier 3 pricing source) | No | (empty = skipped) |

### Stripe (Payment)

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `STRIPE_SECRET_KEY` | Stripe secret API key | No | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | No | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side) | No | `pk_test_...` |
| `STRIPE_PRICE_PRO` | Stripe Price ID for PRO plan | No | `price_...` |
| `STRIPE_PRICE_BUSINESS` | Stripe Price ID for BUSINESS plan | No | `price_...` |
| `STRIPE_PRICE_KANZLEI` | Stripe Price ID for KANZLEI plan | No | `price_...` |

### Email (Resend)

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `RESEND_API_KEY` | Resend email service API key | No | `re_...` |
| `EMAIL_FROM` | Sender email address with display name | No | `DeFi Tracker <noreply@defi.nextgenitsolutions.de>` |

### Security

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `TOTP_ENCRYPTION_KEY` | AES-256-GCM encryption key for TOTP secrets (32 bytes, hex-encoded; generate with `openssl rand -hex 32`) | No | (64-character hex string) |

### WalletConnect

| Variable | Description | Required | Example / Default |
|----------|-------------|----------|-------------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 project ID | No | (from cloud.walletconnect.com) |

---

## Test Users

The production seed (`packages/db/prisma/seed.sql`) creates three test accounts. The seed is idempotent (`ON CONFLICT (email) DO NOTHING`) and runs automatically on container startup via the Docker entrypoint.

| Email | Password | Plan Tier | TOTP 2FA |
|-------|----------|-----------|----------|
| `alice@example.com` | `SeedP@ssw0rd!` | STARTER | Disabled |
| `bob@example.com` | `SeedP@ssw0rd!` | PRO | Disabled |
| `carol@example.com` | `SeedP@ssw0rd!` | BUSINESS | Disabled |

Passwords are hashed with bcrypt. The seed is safe to run repeatedly.

To seed manually:

```bash
pnpm --filter @defi-tracker/db db:seed
```

---

## Scripts

### Root Scripts (Turborepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode (Turbopack) |
| `pnpm build` | Production build across all packages |
| `pnpm lint` | ESLint across all packages |
| `pnpm type-check` | TypeScript type checking across all packages |
| `pnpm test:unit` | Unit tests via Vitest |
| `pnpm test:integration` | Integration tests (requires PostgreSQL + Redis) |
| `pnpm test:e2e` | E2E tests via Turborepo |
| `pnpm test:e2e:local` | E2E with auto Docker setup (recommended for local dev) |
| `pnpm test:a11y` | Accessibility tests via axe-core + Playwright |
| `pnpm test:perf` | k6 performance tests |
| `pnpm test:mcp` | MCP interactive test instructions |
| `pnpm clean` | Remove all build artifacts, node_modules, and Turbo cache |

### Database Scripts

| Command | Description |
|---------|-------------|
| `pnpm --filter @defi-tracker/db exec prisma generate` | Generate Prisma client from schema |
| `pnpm --filter @defi-tracker/db exec prisma migrate dev` | Create and run a new migration |
| `pnpm --filter @defi-tracker/db exec prisma migrate deploy` | Apply pending migrations (production) |
| `pnpm --filter @defi-tracker/db exec prisma studio` | Open visual database editor (localhost:5555) |
| `pnpm --filter @defi-tracker/db db:seed` | Seed test user data |
| `pnpm --filter @defi-tracker/db db:reset` | Drop and recreate the entire database |

---

## Testing

### Testing Layers

| Layer | Tool | Trigger | Location | Purpose |
|-------|------|---------|----------|---------|
| **Unit** | Vitest | `ci.yml` (push/PR) | `packages/*/src/**/__tests__/` | Isolated function and module tests |
| **Integration** | Vitest + real DB/Redis | `ci.yml` (push/PR) | `apps/web/src/server/**/__tests__/` | tRPC router tests with real database |
| **E2E** | Playwright (Chromium + Pixel 5) | `e2e.yml` (push main + PRs) | `tests/e2e/*.spec.ts` | Full browser-based user flow testing |
| **Accessibility** | axe-core + Playwright | `e2e.yml` (push main + PRs) | `tests/e2e/a11y.spec.ts` | WCAG 2.1 AA compliance |
| **Performance** | k6 | `performance.yml` (weekly) | `tests/k6/` | Smoke, load, and DB performance testing |

**Coverage target:** 80% minimum (statements, branches, functions, lines).

**Spec-driven testing:** Test files use `@spec` JSDoc tags to link to PRD requirement IDs (FR-xx-xx, US-xxx, NFR-xxx, EP-xx). The `spec-coverage.yml` workflow reports coverage on every PR.

### Unit and Integration Tests

```bash
# Run unit tests
pnpm test:unit

# Run unit tests with coverage report
pnpm turbo test:unit -- --coverage

# Run integration tests (requires PostgreSQL + Redis)
pnpm test:integration
```

### E2E Tests (Playwright)

27 specs across 2 browser projects (Chromium desktop + Pixel 5 mobile = 54 test runs):

| Spec File | Tests | Description |
|-----------|-------|-------------|
| `health.spec.ts` | 2 | Health endpoint status and timestamp validation |
| `auth.spec.ts` | 5 | Register, login, invalid credentials, protected routes |
| `exports.spec.ts` | 4 | CSV/XLSX export generation and download |
| `settings.spec.ts` | 5 | User settings, notification preferences, plan management |
| `transactions.spec.ts` | 4 | Transaction list, filtering, classification display |
| `wallets.spec.ts` | 4 | Wallet add/remove, sync status, WalletConnect |
| `a11y.spec.ts` | 3 | WCAG 2.1 AA compliance (login, register, wallets) |
| `dashboard.spec.ts` | -- | Dashboard overview and widget tests |

**Run locally** (recommended -- starts Docker, migrates DB, seeds, runs tests):

```bash
pnpm test:e2e:local
```

Options:

```bash
pnpm test:e2e:local --headed          # Watch tests in browser
pnpm test:e2e:local --grep "health"   # Filter by test name
pnpm test:e2e:local --cleanup         # Tear down containers after
```

The E2E suite uses port 3008 to avoid conflicts with the dev server on port 3000.

Test infrastructure: `docker/docker-compose.test.yml` (ephemeral PostgreSQL + Redis with tmpfs for fast teardown).

### Performance Tests (k6)

```bash
pnpm test:perf
```

| Test Type | Script | Description |
|-----------|--------|-------------|
| **Smoke** | `tests/k6/smoke.js` | Basic endpoint availability and response time validation |
| **Load** | `tests/k6/load.js` | Sustained load testing with concurrent virtual users |
| **DB Performance** | `tests/k6/db-perf.js` | Authenticated API scenarios testing database query performance |
| **API Scenarios** | `tests/k6/api-scenarios.js` | Full user journey simulations (manual dispatch only) |

Runs weekly in CI (Monday 3:00 AM UTC) and can be manually dispatched.

---

## CI/CD Pipeline

All workflows run on 4 self-hosted GitHub Actions runners (Hetzner via Coolify).

### CI

[![CI](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/ci.yml)

| Property | Value |
|----------|-------|
| **Workflow** | `ci.yml` |
| **Job Name** | `Lint & Test` |
| **Triggers** | Push to `main`/`develop`, pull requests to `main`/`develop`, manual dispatch |
| **Timeout** | 20 minutes |

Steps:
1. Start PostgreSQL 16 + Redis 7 service containers (Docker, shared network namespace)
2. Install dependencies (`pnpm install --frozen-lockfile`)
3. Generate Prisma client
4. Lint (ESLint)
5. Type check (`tsc --noEmit`)
6. Unit tests (Vitest with coverage)
7. Integration tests (real DB and Redis)
8. Security audit (`audit-ci --high`)

### E2E Tests

[![E2E Tests](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/e2e.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/e2e.yml)

| Property | Value |
|----------|-------|
| **Workflow** | `e2e.yml` |
| **Job Name** | `E2E & Accessibility` |
| **Triggers** | Push to `main`, pull requests to `main`/`develop` (path-filtered) |
| **Timeout** | 45 minutes |

Steps:
1. Start PostgreSQL + Redis containers
2. Build web application
3. Install Playwright system dependencies and Chromium browser
4. Run Playwright E2E + accessibility tests
5. Upload test reports as artifacts (14-day retention)

Path filter: Only runs when changes affect `apps/web/`, `packages/ui/`, `packages/shared/`, `packages/db/prisma/`, `tests/e2e/`, `tests/helpers/`, or `pnpm-lock.yaml`.

### Deploy

[![Deploy](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/deploy.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/deploy.yml)

| Property | Value |
|----------|-------|
| **Workflow** | `deploy.yml` |
| **Job Name** | `Deploy to Production` |
| **Triggers** | Push to `main`, manual dispatch |
| **Timeout** | 20 minutes (deploy) + 15 minutes (CI gate) + 50 minutes (E2E gate) |

Steps:
1. Wait for CI workflow to pass (`Lint & Test` check)
2. Wait for E2E workflow to pass (`E2E & Accessibility` check)
3. Build multi-stage Docker image (Node 24.14.1 Alpine)
4. Push to GitHub Container Registry (`ghcr.io`)
5. Trigger Coolify deployment via webhook
6. Health check validation (`GET /api/health`, 20 retries at 15-second intervals)
7. Post deployment summary to GitHub Actions

### Performance Tests

[![Performance Tests](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/performance.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/performance.yml)

| Property | Value |
|----------|-------|
| **Workflow** | `performance.yml` |
| **Job Names** | `k6 Load Tests`, `k6 API Scenario Tests` |
| **Triggers** | Weekly (Monday 3:00 AM UTC), manual dispatch |
| **Timeout** | 30 minutes |

Steps:
1. Install k6
2. Run smoke tests
3. Run load tests
4. Run DB performance tests
5. Upload results as artifacts (30-day retention)
6. Post summary with p95/median/avg/max response times and error rates

The API Scenario Tests job only runs on manual dispatch with `run_api_scenarios: true`.

### Spec Coverage

[![Spec Coverage](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/spec-coverage.yml/badge.svg)](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/actions/workflows/spec-coverage.yml)

| Property | Value |
|----------|-------|
| **Workflow** | `spec-coverage.yml` |
| **Job Name** | `Spec Reference Check` |
| **Triggers** | Pull requests to `main`/`develop` |
| **Timeout** | 5 minutes |

Steps:
1. Run `scripts/check-spec-refs.sh` to scan test files for `@spec` tags
2. Post spec coverage report as PR comment (informational, does not block merge)
3. Target: 80%+ of test files reference requirement IDs

---

## Deployment

### Production Flow

```
GitHub (push to main)
    > GitHub Actions CI (Lint & Test)
        > GitHub Actions E2E (E2E & Accessibility)
            > Docker multi-stage build (Node 24.14.1 Alpine)
                > Push to ghcr.io/nextgenitsolutionsgmbh/nextgen-defi-saas
                    > Coolify deploy webhook (force rebuild)
                        > Container startup (entrypoint.sh)
                            > [1/3] prisma migrate deploy
                                > [2/3] prisma db execute seed.sql
                                    > [3/3] node apps/web/server.js
                                        > Health check (GET /api/health)
                                            > Live at app.defi.nextgenitsolutions.de
```

### Docker Multi-Stage Build

The production Dockerfile (`docker/Dockerfile`) uses a two-stage build:

**Stage 1: Builder**
- Base: `node:24.14.1-alpine`
- Installs all dependencies (dev + prod) with `pnpm install --frozen-lockfile`
- Generates Prisma client from schema
- Runs `pnpm turbo build --filter=@defi-tracker/web` producing Next.js standalone output

**Stage 2: Runner**
- Base: `node:24.14.1-alpine` (clean, minimal)
- Copies standalone output, static assets, and Prisma migrations from builder
- Copies Prisma CLI and engine binaries for runtime migrations
- Runs as non-root user `nextjs` (UID 1001)
- Exposes port 3000

### Entrypoint Steps

The `docker/entrypoint.sh` script runs three steps on every container start:

1. **Migrate** -- `prisma migrate deploy` applies any pending migrations
2. **Seed** -- `prisma db execute seed.sql` runs the idempotent seed (ON CONFLICT DO NOTHING)
3. **Start** -- `node apps/web/server.js` launches the Next.js standalone server

### Health Check

```
GET /api/health  =>  200 OK

{
  "status": "ok",
  "timestamp": "2026-03-28T06:30:00.000Z",
  "version": "0.1.0",
  "db": "connected",
  "redis": "not_configured"
}
```

---

## Infrastructure

| Component | Details |
|-----------|---------|
| **Hosting** | Hetzner dedicated server |
| **IPv4** | 195.201.217.132 |
| **IPv6** | 2a01:4f8:1c1a:d596::1 |
| **PaaS** | Coolify (self-hosted at app.coolify.nextgenitsolutions.de) |
| **Container Registry** | GitHub Container Registry (ghcr.io) |
| **DNS Provider** | GoDaddy |
| **Domain** | app.defi.nextgenitsolutions.de |
| **CI Runners** | 4x self-hosted GitHub Actions runners (Hetzner via Coolify) |
| **Database** | PostgreSQL 16 Alpine (Coolify managed) |
| **Cache / Queue** | Redis 7 Alpine (Coolify managed) |
| **SSL/TLS** | Automatic via Coolify (Let's Encrypt) |

---

## Tax Compliance

### German Tax Law (BMF-2025)

DeFi Tracker SaaS implements the BMF-Schreiben 2025 guidelines for cryptocurrency taxation in Germany.

| Rule | Implementation | Details |
|------|---------------|---------|
| **FIFO / LIFO / HIFO** | Configurable lot matching per export | User selects method when creating an export; lots matched accordingly |
| **Haltefrist** (365 days) | Per-lot countdown timer | Disposals after 365 days are tax-free under Paragraph 23 EStG; dashboard shows upcoming tax-free dates |
| **Paragraph 23 EStG Freigrenze** | Private sales exemption: 1,000 EUR/year | Dashboard KPI tracks cumulative gains against the threshold |
| **Paragraph 22 Nr. 3 EStG** | Other income exemption: 256 EUR/year | Applied to staking rewards, lending interest, airdrops |
| **GoBD Audit Trail** | SHA-256 hash chain on `audit_logs` | Each log entry references the previous hash, creating a tamper-evident chain |
| **DSGVO / GDPR** | No PII in application logs | AES-256-GCM encryption for wallet data at rest; Art. 15 data export; Art. 17 account deletion |
| **Dual-Scenario Modeling** | Model A / Model B for Graubereich | Model A: Tauschmodell (Paragraph 23 EStG); Model B: Nutzungsueberlassung (Paragraph 22 Nr. 3 EStG) |

### CoinTracking CSV Format

The export produces a 15-column CSV file matching the CoinTracking import specification:

```
"Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date","Tx-ID","Buy Value in EUR","Sell Value in EUR"
"Trade","1,5","FLR","0,03","USDT","0,001","FLR","SparkDEX","","Swap","26.03.2026 14:30:00","0xabc...","0,04","0,04"
```

- Date format: DD.MM.YYYY HH:MM:SS (UTC)
- Decimal separator: comma (German locale)
- Text encoding: UTF-8 with BOM

---

## Flare Network

| Constant | Value |
|----------|-------|
| **Chain ID (Mainnet)** | 14 |
| **Chain ID (Coston2 Testnet)** | 114 |
| **RPC Endpoint** | `https://flare-api.flare.network/ext/C/rpc` |
| **Block Explorer** | [flarescan.com](https://flarescan.com) |
| **FTSO** | Flare Time Series Oracle -- on-chain price oracle, primary EUR source |
| **Consensus** | Federated Byzantine Agreement |

### Key Tokens

| Token | Description |
|-------|-------------|
| **FLR** | Native Flare token |
| **WFLR** | Wrapped FLR (ERC-20) |
| **FXRP** | Flare-wrapped XRP |
| **USDT** | Tether USD (bridged) |
| **SPRK** | SparkDEX governance token |
| **kFLR** | Kinetic FLR (lending receipt) |
| **kUSDT** | Kinetic USDT (lending receipt) |
| **APS** | Apsis token |
| **HLN** | Helianthus token |
| **rFLR** | Reward FLR (staking delegation receipt) |

---

## Troubleshooting

### Database connection refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:** Ensure PostgreSQL is running and the `DATABASE_URL` is correct.

```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Start dev databases if not running
docker compose -f docker/docker-compose.yml up -d db redis

# Verify connection
pnpm --filter @defi-tracker/db exec prisma db pull
```

### Redis connection error

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:** Start Redis and verify `REDIS_URL` in `.env`.

```bash
docker compose -f docker/docker-compose.yml up -d redis
docker exec $(docker ps -q --filter ancestor=redis:7-alpine) redis-cli ping
```

### Prisma client not generated

**Symptom:** `Cannot find module '.prisma/client'` or type errors referencing Prisma models

**Solution:** Generate the Prisma client from the schema.

```bash
pnpm --filter @defi-tracker/db exec prisma generate
```

### Migration failed

**Symptom:** `prisma migrate deploy` or `prisma migrate dev` fails with schema drift errors

**Solution:**

```bash
# For development -- reset and re-apply all migrations
pnpm --filter @defi-tracker/db db:reset

# For production -- apply pending migrations only
pnpm --filter @defi-tracker/db exec prisma migrate deploy

# If schema is out of sync, re-create migration history
pnpm --filter @defi-tracker/db exec prisma migrate dev --name fix_drift
```

### E2E tests fail locally

**Symptom:** Tests fail with connection errors or port conflicts

**Solution:** Use the `test:e2e:local` script which handles Docker setup, migration, seeding, and uses port 3008.

```bash
# Recommended approach (handles everything)
pnpm test:e2e:local

# If port 3008 is occupied
lsof -i :3008
kill -9 <PID>
```

### Node.js version mismatch

**Symptom:** Engine compatibility errors or unexpected runtime behavior

**Solution:** Use nvm to switch to the correct Node.js version.

```bash
nvm install 24.14.1
nvm use
# Or check .nvmrc
cat .nvmrc
```

### Stripe webhook not received

**Symptom:** Subscription status not updating after Stripe Checkout completion

**Solution:** Forward Stripe webhooks to your local server using the Stripe CLI.

```bash
# Install Stripe CLI and login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret (whsec_...) to .env as STRIPE_WEBHOOK_SECRET
```

### TOTP 2FA locked out

**Symptom:** Cannot log in because TOTP verification fails

**Solution:** Verify the `TOTP_ENCRYPTION_KEY` environment variable is set correctly. If the key was changed or lost, TOTP secrets encrypted with the old key cannot be decrypted.

```bash
# Check if TOTP_ENCRYPTION_KEY is set
grep TOTP_ENCRYPTION_KEY .env

# Generate a new key if needed (will invalidate all existing TOTP secrets)
openssl rand -hex 32

# For existing users locked out, a database admin can disable 2FA:
# UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE email = 'user@example.com';
```

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | Complete | Project setup, monorepo structure, CI/CD pipeline, infrastructure provisioning |
| **Phase 1** | Complete | Core pipeline: blockchain indexer, EUR pricing engine, TX classifier, tax engine, CoinTracking CSV export, dashboard |
| **Phase 2** | Current (Beta) | Stripe billing, WalletConnect integration, email notifications, Redis rate limiting, XLSX/PDF export, plan-based feature limits, comprehensive test suite (unit + integration + E2E + a11y + perf), spec-driven development workflow |
| **Phase 3** | Planned | Multi-chain support, ML-based classification (Layer 4), Steuerberater (tax advisor) portal with multi-client management, advanced analytics |
| **Phase 4** | Planned | Public SaaS launch, onboarding flow, marketing site, API documentation, partner integrations |

---

## Contributing

DeFi Tracker SaaS follows a spec-driven development workflow. Every feature, test, and code change traces back to a requirement in the PRD (`datasource/DeFiTracker_PRD_v2.md`). Test files use `@spec` JSDoc tags to link to requirement IDs (FR-xx-xx, US-xxx, NFR-xxx, EP-xx), and a CI workflow reports coverage on every PR.

For full details on the development workflow, coding conventions, branching strategy, and spec reference format, see [CONTRIBUTING.md](CONTRIBUTING.md).

For the complete mapping of requirements to source files and tests, see [docs/traceability-matrix.md](docs/traceability-matrix.md).

---

## Support

- **Issues:** [GitHub Issues](https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas/issues)
- **Product Requirements:** [datasource/DeFiTracker_PRD_v2.md](datasource/DeFiTracker_PRD_v2.md)
- **Technical Analysis:** [datasource/DeFi_Tracker_Komplett_v10_NextGen.md](datasource/DeFi_Tracker_Komplett_v10_NextGen.md)
- **Brand Guidelines:** [datasource/DeFiTracker_BrandBook_KOMPLETT_v1.md](datasource/DeFiTracker_BrandBook_KOMPLETT_v1.md)
- **Company:** [NextGen IT Solutions GmbH](https://nextgenitsolutions.de), Stuttgart, Germany
- **Contact:** info@nextgenitsolutions.de

---

## License

Proprietary. Copyright 2025-2026 NextGen IT Solutions GmbH. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without prior written permission from NextGen IT Solutions GmbH.
