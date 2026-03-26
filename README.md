# DeFi Tracker SaaS

**On-Chain Tax Intelligence for Flare Network DeFi Users**

Fully automated, BMF-2025-compliant DeFi transaction tracking and CoinTracking CSV export — built by [NextGen IT Solutions GmbH](https://nextgenitsolutions.de), Stuttgart.

---

## Overview

DeFi Tracker indexes, classifies, and exports DeFi transactions from the **Flare Network** ecosystem for German tax compliance. Users connect their wallet, and the platform automatically:

1. **Syncs** on-chain transactions via Flare JSON-RPC
2. **Decodes** event logs (Swap, Mint, Burn, Borrow, Liquidation, etc.)
3. **Classifies** each TX into CoinTracking-compatible tax categories
4. **Prices** every token movement in EUR (FTSO oracle, CoinGecko, CMC fallback)
5. **Computes** FIFO/LIFO tax lots, holding periods, and Freigrenze thresholds
6. **Exports** a 15-column CoinTracking CSV — zero manual editing required

## Architecture

```
                    +-----------------+
                    |   Next.js 15    |
                    |   App Router    |
                    |  (React 19 UI) |
                    +--------+--------+
                             |
                        tRPC v11 + Zod
                             |
           +-----------------+-----------------+
           |                                   |
    +------+------+                    +-------+-------+
    | PostgreSQL  |                    |  Redis 7 +    |
    |  16 + Prisma|                    |  BullMQ v5    |
    +------+------+                    +-------+-------+
           |                                   |
           |                    +--------------+--------------+
           |                    |              |              |
           |              wallet-sync    price-fetch    export-gen
           |               worker          worker        worker
           |                    |              |              |
           +--------------------+--------------+--------------+
                                |
                    +-----------+-----------+
                    |  @defi-tracker/shared |
                    |  (Business Engines)   |
                    +-----------------------+
                    | Indexer  | Pricing    |
                    | Classifier | Tax     |
                    | Export   | Audit Log  |
                    +-----------------------+
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| **API** | tRPC 11 + Zod (end-to-end type safety) |
| **Database** | PostgreSQL 16 + Prisma ORM v6 (12 models, 12 enums) |
| **Queue** | Redis 7 + BullMQ v5 (wallet sync, price fetch, export gen) |
| **Auth** | NextAuth.js v5 + TOTP 2FA |
| **Hosting** | Hetzner self-hosted via Coolify |
| **CI/CD** | GitHub Actions (4 Hetzner runners) |
| **Testing** | Vitest (124 unit tests) |

## Monorepo Structure

```
apps/
  web/                      Next.js frontend + tRPC API routes
    src/
      app/(auth)/            Login, Register
      app/(dashboard)/       Dashboard, Wallets, Transactions, Exports, Settings
      app/api/               Auth, tRPC, Health, Export download
      components/            Ampel badge, Freigrenze bar, Haltefrist tracker,
                             Classify modal, Dual-scenario modal, Layout
      server/routers/        user, wallet, transaction, export, dashboard
      server/queue/workers/  wallet-sync, price-fetch, export-gen
      lib/                   Auth, tRPC client, MetaMask, storage
packages/
  shared/                   Business logic engines (~6.5K lines)
    src/indexer/              Flare RPC client, event decoder, wallet sync
    src/pricing/             FTSO, CoinGecko, CMC, 4-tier price engine
    src/classifier/          5-layer classification + protocol rules
    src/tax/                 FIFO/LIFO lot matcher, Freigrenze, Haltefrist
    src/export/              CoinTracking CSV, PDF report, GoBD audit log
    src/abis/                SparkDEX, Enosys, Kinetic, Flare event ABIs
  db/                       Prisma schema, migrations, seed
  ui/                       Button, Card, Badge, Input, KpiCard
  config/                   Shared TypeScript config
```

## Supported Protocols (MVP)

| Protocol | Type | TX Types |
|----------|------|----------|
| **SparkDEX V3/V4** | AMM / DEX | Swap, Add/Remove Liquidity, Farming |
| **Enosys DEX + CDP** | DEX + Stablecoin | Swap, CDP Open/Close, Liquidation |
| **Kinetic Market** | Lending/Borrowing | Supply, Borrow, Repay, Liquidation |
| **FLR Staking** | Native | Delegation Rewards, FlareDrops |

## Key Features

### Blockchain Indexer
- Flare JSON-RPC (chain ID 14) with 2048-block chunking
- ERC20 Transfer event scanning + full receipt decoding
- 20+ event signatures (V3 Swap/Mint/Burn, Compound, CDP, Staking)

### EUR Price Engine (4-Tier Fallback)
1. **FTSO** — Flare Time Series Oracle (on-chain, primary)
2. **CoinGecko** — Free API (30 req/min rate limit)
3. **CoinMarketCap** — Paid API (requires API key)
4. **Manual** — Flagged for user review

### TX Classification (Ampel System)
- **GREEN** — Auto-classified (high confidence)
- **YELLOW** — Graubereich (dual-scenario: Model A trade vs Model B usage)
- **RED** — Unknown (requires manual classification)
- **GRAY** — Irrelevant / non-taxable

### German Tax Compliance (BMF 2025)
- FIFO (default) + LIFO lot matching
- Section 23 EStG: EUR 1,000 Freigrenze for private disposals
- Section 22 Nr. 3 EStG: EUR 256 Freigrenze for staking/lending income
- 365-day Haltefrist (holding period) tracker
- GoBD-compliant SHA-256 hash chain audit log

### CoinTracking CSV Export
- 15-column standard format
- UTF-8 with BOM, German decimal format (comma separator)
- Date format: DD.MM.YYYY HH:MM:SS (UTC)
- SHA-256 file integrity hash

### Dashboard
- Portfolio P&L (realized gains/losses, taxable vs tax-free)
- Freigrenze progress bars (Section 23 + Section 22 Nr. 3)
- Ampel distribution donut chart
- Monthly activity timeline
- Haltefrist countdown tracker
- Classification progress by protocol

### Wallet Connection
- MetaMask with automatic Flare Network chain switch
- Manual address entry
- WalletConnect (coming soon)
- Real-time sync status polling (3s interval)

## Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9.15
- PostgreSQL 16
- Redis 7 (for BullMQ workers)

### Setup

```bash
# Clone
git clone https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas.git
cd nextgen-defi-saas

# Environment
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, FLARE_RPC_URL

# Install
pnpm install

# Database
pnpm --filter @defi-tracker/db db:generate
pnpm --filter @defi-tracker/db db:migrate

# Seed (optional)
pnpm --filter @defi-tracker/db db:seed

# Development
pnpm dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode |
| `pnpm build` | Production build (Turbo) |
| `pnpm type-check` | TypeScript strict check |
| `pnpm lint` | ESLint across all packages |
| `pnpm --filter @defi-tracker/shared test:unit` | Run 124 unit tests |
| `pnpm --filter @defi-tracker/db db:studio` | Open Prisma Studio |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection for BullMQ |
| `NEXTAUTH_SECRET` | Yes | NextAuth.js JWT secret |
| `NEXTAUTH_URL` | Yes | App base URL (http://localhost:3000) |
| `FLARE_RPC_URL` | No | Flare RPC (default: public endpoint) |
| `COINGECKO_API_KEY` | No | CoinGecko API key (optional) |
| `CMC_API_KEY` | No | CoinMarketCap API key (tier 3 pricing) |
| `STRIPE_SECRET_KEY` | No | Stripe billing (Phase 3) |
| `EXPORT_STORAGE_PATH` | No | Export file storage (default: ./data/exports) |

## Deployment

Automated via GitHub Actions to Coolify on Hetzner infrastructure.

| Environment | URL | Branch |
|-------------|-----|--------|
| Production | https://app.defi.nextgenitsolutions.de | `main` |
| Staging | — | `develop` |

### Docker

```bash
docker build -t defi-tracker .
docker run -p 3000:3000 --env-file .env defi-tracker
```

## Project Roadmap

| Phase | Timeline | Status |
|-------|----------|--------|
| **P0** Discovery | April 2026 | Complete |
| **P1** MVP Build | May–July 2026 | Complete |
| **P2** Beta | August 2026 | **Next** |
| **P3** Launch | September 2026 | Planned |
| **P4** Scale | Q4 2026–Q1 2027 | Roadmap |

### Codebase Stats
- ~17,900 lines of TypeScript/React
- 12 Prisma models, 12 enums
- 6,500 lines of business logic (shared engines)
- 124 unit tests (Vitest)
- 3 BullMQ workers
- 5 tRPC routers, 25+ procedures

## Documentation

- [Product Requirements (PRD v2)](datasource/DeFiTracker_PRD_v2.md)
- [Technical Analysis v10](datasource/DeFi_Tracker_Komplett_v10_NextGen.md)
- [Brand Guidelines](datasource/DeFiTracker_BrandBook_KOMPLETT_v1.md)

## License

Proprietary — NextGen IT Solutions GmbH. All rights reserved.
