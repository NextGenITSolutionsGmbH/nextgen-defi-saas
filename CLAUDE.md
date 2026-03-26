# CLAUDE.md — DeFi Tracker SaaS

## Project Overview
DeFi Tracker SaaS — On-Chain Tax Intelligence for Flare Network DeFi users.
BMF-2025-compliant, automated CoinTracking CSV export.
Built by NextGen IT Solutions GmbH, Stuttgart.

## Architecture & Stack
- **Target**: Full-stack SaaS (Next.js / React frontend, Node.js backend, PostgreSQL)
- **Hosting**: Hetzner self-hosted runners (4x) via Coolify
- **CI/CD**: GitHub Actions → Coolify deployment
- **Domain**: app.defi.nextgenitsolutions.de (GoDaddy DNS → Hetzner)

## Agent Orchestration Strategy
Claude Code should maximize parallel sub-agent spawning for code delivery performance:
- Use `subagent_type: "Explore"` for codebase research tasks
- Use `subagent_type: "Plan"` for architecture/design decisions
- Use `subagent_type: "general-purpose"` for implementation, testing, and multi-step tasks
- Launch **independent agents in parallel** whenever tasks don't depend on each other
- Use `isolation: "worktree"` for parallel code changes that touch different areas
- Use `run_in_background: true` for long-running tasks (builds, tests, deployments)

### Parallel Work Patterns
- **Feature implementation**: Spawn separate agents per module/component
- **Testing**: Run test agents in parallel per test suite
- **Code review**: Spawn explore agents to analyze different areas concurrently
- **Deployment**: Background agents for build + deploy while continuing development

## Development Conventions
- **Language**: Code, commits, PRs, and documentation in English
- **Date/Time**: German timezone (Europe/Berlin), format DD.MM.YYYY
- **GitHub**: Use `gh` CLI as the preferred tool for all GitHub operations
- **Commits**: Conventional commits (feat:, fix:, chore:, docs:, ci:, refactor:)
- **Branching**: GitFlow — main, develop, feature/*, hotfix/*, release/*

## Infrastructure
- **Coolify**: https://app.coolify.nextgenitsolutions.de (API managed via .env)
- **Hetzner**: 4 self-hosted GitHub Actions runners
- **DNS**: GoDaddy A/AAAA records → 195.201.217.132 / 2a01:4f8:1c1a:d596::1

## Security
- **NEVER** commit `.env`, credentials, API tokens, or secrets to Git
- All secrets stored in `.env` (excluded via `.gitignore`)
- Use GitHub Secrets for CI/CD pipelines
- DSGVO/GDPR compliant — no PII in logs or commits

## Key Documentation
- [DeFiTracker_PRD_v2.md](DeFiTracker_PRD_v2.md) — Product Requirements Document
- [DeFi_Tracker_Komplett_v10_NextGen.md](DeFi_Tracker_Komplett_v10_NextGen.md) — Full Technical Analysis
- [DeFiTracker_BrandBook_KOMPLETT_v1.md](DeFiTracker_BrandBook_KOMPLETT_v1.md) — Brand Guidelines
