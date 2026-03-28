# Contributing to DeFi Tracker SaaS

## Spec-Driven Development

This project follows a spec-driven development workflow. The PRD at `datasource/DeFiTracker_PRD_v2.md` is the authoritative source for requirements.

### Before Writing Code

1. Identify the requirement IDs (FR-xx-xx, US-xxx, NFR-xxx, EP-xx) your work implements
2. Review the relevant PRD sections for acceptance criteria
3. Check the traceability matrix at `docs/traceability-matrix.md` for existing mappings

### Code Conventions

- Add `@spec` JSDoc comments to source files linking to requirement IDs:
  ```typescript
  /**
   * @spec FR-05-01, EP-05 — FTSO on-chain price oracle
   */
  ```
- Add `@spec` comments to test files and include IDs in describe() blocks:
  ```typescript
  /**
   * @spec EP-08 — Haltefrist tracking
   */
  describe('Haltefrist [EP-08]', () => { ... });
  ```

### Pull Requests

- Use the PR template — fill in the Spec References section
- Include requirement IDs in commit messages when relevant: `feat(EP-07): add XLSX export format`

### Updating Specs

- If implementation diverges from the spec, update the change log in `datasource/DeFiTracker_PRD_v2.md` (Anhang C)
- Update `docs/traceability-matrix.md` when adding new requirement-to-file mappings

### CI Checks

The `spec-coverage` workflow runs on PRs and reports which test files reference requirement IDs. Target: 80%+ coverage.

## General Development

### Stack

- pnpm workspaces + Turborepo monorepo
- Conventional commits (feat:, fix:, chore:, docs:, ci:, refactor:)
- GitFlow branching (main, develop, feature/*, hotfix/*, release/*)

### Quick Start

```bash
pnpm install
pnpm dev
```

### Testing

```bash
pnpm test          # Unit tests
pnpm test:e2e      # Playwright E2E tests
pnpm test:perf     # k6 performance tests
```
