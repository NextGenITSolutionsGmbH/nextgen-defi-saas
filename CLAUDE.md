# CLAUDE.md — DeFi Tracker SaaS

## Project Overview
DeFi Tracker SaaS — On-Chain Tax Intelligence for Flare Network DeFi users.
BMF-2025-compliant, automated CoinTracking CSV export.
Built by NextGen IT Solutions GmbH, Stuttgart.

## Architecture & Stack
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 App Router + React 19 + Tailwind CSS + shadcn/ui
- **Backend API**: tRPC 11 + Zod validation (type-safe end-to-end)
- **Database**: PostgreSQL 16 + Prisma ORM v6
- **Queue**: Redis 7 + BullMQ v5 (async indexing, export jobs, sync workers)
- **Auth**: NextAuth.js v5 + TOTP 2FA
- **Hosting**: Hetzner self-hosted runners (4x) via Coolify
- **CI/CD**: GitHub Actions → Coolify deployment
- **Domain**: app.defi.nextgenitsolutions.de (GoDaddy DNS → Hetzner)

## Monorepo Structure
```
apps/web/               — Next.js frontend + tRPC API routes
packages/db/            — Prisma schema, client, seed
packages/shared/        — Types, constants, ABIs, tax rules
packages/ui/            — shadcn/ui component library
packages/config/        — Shared TS config
```

## Agent Orchestration Strategy — Maximum Parallelism

Claude Code MUST maximize parallel sub-agent spawning for peak code delivery:

### Agent Type Selection
| Task Type | Agent | Options |
|-----------|-------|---------|
| Codebase research / file search | `subagent_type: "Explore"` | Quick for focused, thorough for broad |
| Architecture / design decisions | `subagent_type: "Plan"` | Always before major features |
| Implementation (write code) | `subagent_type: "general-purpose"` | With `isolation: "worktree"` for parallel writes |
| Build / test / deploy | `subagent_type: "general-purpose"` | With `run_in_background: true` |

### Parallel Execution Rules
1. **Always batch independent work**: If 3+ tasks have no data dependencies, launch ALL as parallel agents in a single message
2. **Use worktree isolation** for agents writing to different directories (e.g., `packages/shared/` vs `apps/web/src/server/`)
3. **Background long-running tasks**: Builds (`npm run build`), test suites, deployments → `run_in_background: true`
4. **Wave-based execution**: Group work into waves; within each wave, maximize parallelism; between waves, merge results

### Parallel Work Patterns
- **Feature implementation**: Spawn separate agents per module — one for backend service, one for frontend component, one for tests
- **Multi-service builds**: Backend indexer + price engine + classification engine = 3 parallel agents
- **Testing**: Run unit/integration/e2e test agents in parallel per package
- **Code review**: Spawn explore agents to analyze different areas concurrently
- **Deployment**: Background agents for build + deploy while continuing development

### Wave Execution Example
```
Wave 1 (Foundation):  shared types + queue infra + DB migrations    → 3 parallel agents
Wave 2 (Services):    indexer + price engine + classifier + tax calc → 4 parallel agents
Wave 3 (Integration): tRPC routers + export engine + audit service  → 3 parallel agents
Wave 4 (Frontend):    dashboard + TX list + wallet UI + settings    → 4 parallel agents
Wave 5 (Polish):      tests + CI/CD + Docker + build verification   → 3 parallel agents
```

## Core Business Modules

### 1. Blockchain Indexer (`packages/shared/src/indexer/`)
- Flare RPC (chain ID 14) via JSON-RPC + The Graph subgraph fallback
- ABI event decoding: SparkDEX V3/V4, Ēnosys DEX+CDP, Kinetic Market
- BullMQ job: `sync-wallet` → fetch TX logs → decode → store

### 2. EUR Price Engine (`packages/shared/src/pricing/`)
- 4-tier priority: FTSO (on-chain) → CoinGecko → CMC → Manual
- Every price logged to `price_audit_logs` (GoBD compliance)
- Z-Score anomaly detection (>3σ = warning)

### 3. TX Classification Engine (`packages/shared/src/classifier/`)
- 5-layer rules: Protocol ABI match → Event pattern → Heuristic → ML fallback → Manual
- Maps to CoinTracking types: Trade, Staking, LP Rewards, Lending Einnahme, etc.
- Ampel system: GREEN (auto-classified) / YELLOW (Graubereich) / RED (unknown) / GRAY (irrelevant)
- Dual-scenario (Model A/B) for LP providing and CDP

### 4. Tax Calculation Engine (`packages/shared/src/tax/`)
- FIFO (default) + LIFO lot matching
- § 23 EStG Freigrenze monitor (€1,000/year)
- § 22 Nr. 3 EStG Freigrenze monitor (€256/year)
- Haltefrist tracker (1-year countdown per lot)
- Gain/Loss computation per disposal

### 5. CoinTracking Export Engine (`packages/shared/src/export/`)
- 15-column CSV: Type, Buy/Sell Amount/Currency, Fee, Exchange, Date, Tx-ID, EUR values
- Date format: DD.MM.YYYY HH:MM:SS (UTC)
- Decimal separator: comma (DE format)
- GoBD: SHA-256 hash chain on audit_logs, versioned exports

## Development Conventions
- **Language**: Code, commits, PRs, and documentation in English
- **Date/Time**: German timezone (Europe/Berlin), format DD.MM.YYYY
- **GitHub**: Use `gh` CLI as the preferred tool for all GitHub operations
- **Commits**: Conventional commits (feat:, fix:, chore:, docs:, ci:, refactor:)
- **Branching**: GitFlow — main, develop, feature/*, hotfix/*, release/*
- **Chain**: Flare Network (chain ID 14) is the primary and only MVP chain
- **Wallet addresses**: Always lowercase, 0x-prefixed, 42 chars

## Flare Network Constants
- **Chain ID**: 14 (mainnet), 114 (Coston2 testnet)
- **RPC**: https://flare-api.flare.network/ext/C/rpc
- **Block Explorer**: https://flarescan.com
- **FTSO**: On-chain price oracle — primary EUR price source
- **Key Tokens**: FLR, WFLR, FXRP, USDT, SPRK, kFLR, kUSDT, APS, HLN, rFLR

## Infrastructure
- **Coolify**: https://app.coolify.nextgenitsolutions.de (API managed via .env)
- **Hetzner**: 4 self-hosted GitHub Actions runners
- **DNS**: GoDaddy A/AAAA records → 195.201.217.132 / 2a01:4f8:1c1a:d596::1

## Security
- **NEVER** commit `.env`, credentials, API tokens, or secrets to Git
- All secrets stored in `.env` (excluded via `.gitignore`)
- Use GitHub Secrets for CI/CD pipelines
- DSGVO/GDPR compliant — no PII in logs or commits
- Read-only wallet access — NEVER store private keys
- Argon2id for password hashing, AES-256-GCM for wallet data at rest

## Key Documentation
- [datasource/DeFiTracker_PRD_v2.md](datasource/DeFiTracker_PRD_v2.md) — Product Requirements Document
- [datasource/DeFi_Tracker_Komplett_v10_NextGen.md](datasource/DeFi_Tracker_Komplett_v10_NextGen.md) — Full Technical Analysis
- [datasource/DeFiTracker_BrandBook_KOMPLETT_v1.md](datasource/DeFiTracker_BrandBook_KOMPLETT_v1.md) — Brand Guidelines
