# CLAUDE.md — DeFi Tracker SaaS

## Project Overview
DeFi Tracker SaaS — On-Chain Tax Intelligence for Flare Network DeFi users.
BMF-2025-compliant, automated CoinTracking CSV export.
Built by NextGen IT Solutions GmbH, Stuttgart.

## Architecture & Stack
- **Runtime**: Node.js >= 24 (24.14.1 LTS)
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 App Router + React 19 + Tailwind CSS + shadcn/ui
- **Backend API**: tRPC 11 (RC) + Zod validation (type-safe end-to-end)
- **Database**: PostgreSQL 16 + Prisma ORM v6
- **Queue**: Redis 7 + BullMQ v5 (async indexing, export jobs, sync workers)
- **Auth**: NextAuth.js v5 (beta) + TOTP 2FA (otplib)
- **Billing**: Stripe (STARTER / PRO / BUSINESS / KANZLEI plans)
- **Email**: Resend (transactional email delivery)
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
docker/                 — Dockerfile, docker-compose (dev + test)
tests/e2e/              — Playwright E2E specs (7 specs × 2 browsers)
tests/k6/               — k6 performance tests
tests/mcp/              — MCP interactive test playbook
scripts/                — test-e2e.sh, check-spec-refs.sh
.github/workflows/      — CI, E2E, Deploy, Performance, Spec Coverage
docs/                   — Traceability matrix
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

## Key Subsystems

| Subsystem | Location | Notes |
|-----------|----------|-------|
| Blockchain Indexer | `packages/shared/src/indexer/` | Flare RPC chain 14, BullMQ `wallet-sync` job |
| EUR Price Engine | `packages/shared/src/pricing/` | 4-tier: FTSO → CoinGecko → CMC → Manual |
| TX Classification | `packages/shared/src/classifier/` | 5-layer rules, Ampel GREEN/YELLOW/RED/GRAY |
| Tax Engine | `packages/shared/src/tax/` | FIFO (default) + LIFO + HIFO lot matching |
| Export Engine | `packages/shared/src/export/` | CSV, XLSX, PDF — all three formats |
| Stripe Billing | `apps/web/src/app/api/webhooks/stripe/` | STARTER/PRO/BUSINESS/KANZLEI plans |
| Notifications | `apps/web/src/server/queue/workers/` | BullMQ email-send worker, Resend integration |
| Rate Limiting | `apps/web/src/lib/rate-limit.ts` | Redis sliding window, per-endpoint + per-user |
| Auth & 2FA | `apps/web/src/lib/auth-utils.ts` | NextAuth v5 beta, TOTP via otplib, bcryptjs |
| tRPC API | `apps/web/src/server/routers/` | 6 routers: user, wallet, transaction, export, dashboard, notification |

## Testing Infrastructure

| Layer | Tool | Trigger | Location |
|-------|------|---------|----------|
| Unit | Vitest | `ci.yml` (push/PR) | `packages/*/src/**/__tests__/` |
| Integration | Vitest + real DB | `ci.yml` (push/PR) | `apps/web/src/server/**/__tests__/` |
| E2E | Playwright (Chromium + Pixel 5) | `e2e.yml` (push main + PRs) | `tests/e2e/*.spec.ts` |
| Accessibility | axe-core + Playwright | `e2e.yml` | `tests/e2e/a11y.spec.ts` |
| Performance | k6 | `performance.yml` (weekly) | `tests/k6/` |
| Interactive | Playwright MCP Server | Manual via Claude Code | `tests/mcp/run-mcp-tests.md` |

- **Coverage target**: 80% (statements, branches, functions, lines)
- **Spec-driven**: `@spec` JSDoc tags link code to PRD requirement IDs (see `CONTRIBUTING.md`)

## MCP Servers

Configured in `.mcp.json` (git-ignored, developer-local):
- **Playwright**: `@playwright/mcp` — headless Chromium, 1280x720 viewport
- **Postgres**: `@modelcontextprotocol/server-postgres` — direct DB queries via `DATABASE_URL`

Claude Code agents **MUST** run Playwright MCP smoke tests before requesting deployment:
1. Follow Quick Smoke Test in `tests/mcp/run-mcp-tests.md` (5 min)
2. For major features, run full 8-phase MCP test suite (15-20 min)

## CI/CD Pipeline

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push main/develop + PRs | Lint, type-check, unit + integration tests, security audit |
| `e2e.yml` | push main + PRs (path-filtered) | Playwright E2E + accessibility tests |
| `deploy.yml` | push main | Docker → GHCR → Coolify (gates on CI + E2E pass) |
| `performance.yml` | weekly Mon 3am | k6 smoke/load/DB perf tests |
| `spec-coverage.yml` | PRs | @spec tag coverage report (80% target) |

## Quick Reference

```bash
pnpm dev                            # Start dev server (Turbopack)
pnpm build                          # Production build
pnpm turbo lint                     # ESLint
pnpm turbo type-check               # TypeScript check
pnpm turbo test:unit                # Unit tests (Vitest)
pnpm turbo test:integration         # Integration tests (needs DB + Redis)
pnpm test:e2e:local                 # Playwright E2E with Docker setup
pnpm --filter @defi-tracker/db exec prisma studio   # DB browser
pnpm --filter @defi-tracker/db exec prisma migrate dev  # New migration
```

## Development Conventions
- **Language**: Code, commits, PRs, and documentation in English
- **Date/Time**: German timezone (Europe/Berlin), format DD.MM.YYYY
- **GitHub**: Use `gh` CLI as the preferred tool for all GitHub operations
- **Commits**: Conventional commits (feat:, fix:, chore:, docs:, ci:, refactor:)
- **Branching**: GitFlow — main, develop, feature/*, hotfix/*, release/*
- **Chain**: Flare Network (chain ID 14) is the primary and only MVP chain
- **Wallet addresses**: Always lowercase, 0x-prefixed, 42 chars
- **Spec tags**: Use `@spec FR-xx-xx` / `US-xxx` / `NFR-xxx` JSDoc tags in tests (see `CONTRIBUTING.md`)
- **Coverage**: Minimum 80% (statements, branches, functions, lines)
- **Node.js**: Requires Node >= 24 (see `.nvmrc`)

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
- [README.md](README.md) — Full project documentation, getting started, env vars
- [CONTRIBUTING.md](CONTRIBUTING.md) — Spec-driven development workflow
- [docs/traceability-matrix.md](docs/traceability-matrix.md) — Requirement-to-code mapping
