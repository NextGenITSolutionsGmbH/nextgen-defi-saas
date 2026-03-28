# Requirements Traceability Matrix

## Overview

This document maps every requirement from the [Product Requirements Document (PRD v2.0)](../datasource/DeFiTracker_PRD_v2.md) to the source code files and test files that implement and verify them. It serves as the single source of truth for requirement coverage and implementation status.

### How to use this document

1. **Find a requirement** by its ID (e.g., EP-01, US-003, FR-02-05, NFR-S01).
2. **Source Files** column lists the production code that implements the requirement.
3. **Test Files** column lists the unit, integration, and E2E tests that verify the requirement.
4. **Status** indicates: `Implemented`, `Partial`, `Not yet implemented`, or `Phase 4` (planned for future).
5. All file paths are relative to the repository root.

### Status definitions

| Status | Meaning |
|--------|---------|
| Implemented | Source code and tests exist; requirement is complete |
| Partial | Some aspects implemented; gaps remain |
| Not yet implemented | Planned for current phase but not yet built |
| Phase 4 | Deferred to Phase 4 roadmap |

---

## Summary Statistics

| Category | Total | Implemented | Partial | Not Yet Implemented | Phase 4 |
|----------|-------|-------------|---------|---------------------|---------|
| Epics (EP-01 to EP-18) | 18 | 11 | 0 | 1 | 6 |
| User Stories (US-001 to US-012) | 12 | 8 | 1 | 0 | 3 |
| Functional Requirements (FR-01-xx to FR-05-xx) | 34 | 34 | 0 | 0 | 0 |
| Non-Functional: Performance (NFR-P) | 8 | 8 | 0 | 0 | 0 |
| Non-Functional: Security (NFR-S) | 10 | 10 | 0 | 0 | 0 |
| Non-Functional: Compliance (NFR-C) | 7 | 7 | 0 | 0 | 0 |
| Non-Functional: Infrastructure (NFR-I) | 6 | 6 | 0 | 0 | 0 |
| **Total** | **95** | **84** | **1** | **1** | **9** |

---

## 1. Epics (EP-01 to EP-18)

| ID | Title | Source Files | Test Files | Status |
|----|-------|-------------|------------|--------|
| EP-01 | Wallet-Verbindung & Synchronisation | `packages/shared/src/indexer/wallet-sync.ts`, `packages/shared/src/indexer/flare-rpc.ts`, `apps/web/src/server/routers/wallet.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts`, `apps/web/src/lib/wallet-connect.ts`, `apps/web/src/lib/walletconnect.ts`, `apps/web/src/app/(dashboard)/wallets/page.tsx` | `packages/shared/src/indexer/__tests__/wallet-sync.test.ts`, `packages/shared/src/indexer/__tests__/flare-rpc.test.ts`, `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts`, `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |
| EP-02 | Protokoll-Indexierung (SparkDEX V3/V4) | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts`, `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/abis/index.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| EP-03 | Protokoll-Indexierung (Enosys DEX + CDP) | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/indexer/event-decoder.ts`, `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/abis/index.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| EP-04 | Protokoll-Indexierung (Kinetic Market) | `packages/shared/src/classifier/rules/kinetic.ts`, `packages/shared/src/indexer/event-decoder.ts`, `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/abis/index.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| EP-05 | EUR-Kursbewertung (FTSO + Fallback) | `packages/shared/src/pricing/price-engine.ts`, `packages/shared/src/pricing/ftso.ts`, `packages/shared/src/pricing/coingecko.ts`, `packages/shared/src/pricing/coinmarketcap.ts`, `apps/web/src/server/queue/workers/price-fetch.worker.ts` | `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| EP-06 | TX-Klassifikations-Engine | `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/classifier/types.ts`, `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/rules/kinetic.ts`, `packages/shared/src/classifier/rules/flare-native.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `tests/e2e/transactions.spec.ts` | Implemented |
| EP-07 | CoinTracking-CSV-Export | `packages/shared/src/export/cointracking-csv.ts`, `packages/shared/src/export/cointracking-xlsx.ts`, `packages/shared/src/export/pdf-report.ts`, `packages/shared/src/export/audit-log.ts`, `apps/web/src/server/routers/export.ts`, `apps/web/src/server/queue/workers/export-gen.worker.ts`, `apps/web/src/app/api/exports/[exportId]/route.ts`, `apps/web/src/app/(dashboard)/exports/page.tsx` | `packages/shared/src/export/__tests__/cointracking-csv.test.ts`, `packages/shared/src/export/__tests__/cointracking-e2e.test.ts`, `packages/shared/src/export/__tests__/audit-log.test.ts`, `apps/web/src/server/routers/__tests__/export.integration.test.ts`, `apps/web/src/server/queue/workers/__tests__/export-gen.worker.test.ts`, `tests/e2e/exports.spec.ts` | Implemented |
| EP-08 | Portfolio-Dashboard & Steuer-KPIs | `packages/shared/src/tax/tax-engine.ts`, `packages/shared/src/tax/lot-matcher.ts`, `packages/shared/src/tax/haltefrist.ts`, `packages/shared/src/tax/freigrenze.ts`, `packages/shared/src/tax/types.ts`, `apps/web/src/server/routers/dashboard.ts`, `apps/web/src/app/(dashboard)/overview/page.tsx`, `apps/web/src/components/dashboard/freigrenze-bar.tsx`, `apps/web/src/components/dashboard/haltefrist-tracker.tsx`, `apps/web/src/components/dashboard/recent-tx-table.tsx`, `apps/web/src/components/dashboard/ampel-donut.tsx` | `packages/shared/src/tax/__tests__/haltefrist.test.ts`, `packages/shared/src/tax/__tests__/freigrenze.test.ts`, `packages/shared/src/tax/__tests__/lot-matcher.test.ts`, `apps/web/src/server/routers/__tests__/dashboard.integration.test.ts`, `tests/e2e/settings.spec.ts` | Implemented |
| EP-09 | Graubereich-Ampel & Dual-Szenario | `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/classifier/types.ts`, `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/rules/enosys.ts`, `apps/web/src/components/transactions/ampel-badge.tsx`, `apps/web/src/components/transactions/dual-scenario-modal.tsx` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/export/__tests__/cointracking-e2e.test.ts`, `tests/e2e/transactions.spec.ts` | Implemented |
| EP-10 | Manuelle TX-Klassifikation | `apps/web/src/server/routers/transaction.ts`, `apps/web/src/components/transactions/classify-modal.tsx`, `apps/web/src/app/(dashboard)/transactions/page.tsx` | `tests/e2e/transactions.spec.ts` | Implemented |
| EP-11 | FLR-Staking & FlareDrops | `packages/shared/src/classifier/rules/flare-native.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| EP-12 | Steuerberater-Zugang (Read-only) | -- | -- | Not yet implemented |
| EP-13 | Stargate Cross-Chain-Bridge | -- | -- | Phase 4 |
| EP-14 | Aave V3 Multi-Chain-Integration | -- | -- | Phase 4 |
| EP-15 | ELSTER XML Export | -- | -- | Phase 4 |
| EP-16 | Kanzlei-Portal (Multi-Mandant) | -- | -- | Phase 4 |
| EP-17 | White-Label & API | -- | -- | Phase 4 |
| EP-18 | HIFO + Tax-Loss-Harvesting | -- | -- | Phase 4 |

---

## 2. User Stories (US-001 to US-012)

| ID | Title | Source Files | Test Files | Status |
|----|-------|-------------|------------|--------|
| US-001 | Wallet-Verbindung & automatischer TX-Import | `packages/shared/src/indexer/wallet-sync.ts`, `packages/shared/src/indexer/flare-rpc.ts`, `apps/web/src/server/routers/wallet.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts`, `apps/web/src/lib/wallet-connect.ts`, `apps/web/src/lib/walletconnect.ts`, `apps/web/src/server/lib/plan-limits.ts` | `packages/shared/src/indexer/__tests__/wallet-sync.test.ts`, `packages/shared/src/indexer/__tests__/flare-rpc.test.ts`, `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts`, `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |
| US-002 | SparkDEX V3/V4 Swap-Erkennung mit EUR-Kurs | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts`, `packages/shared/src/pricing/price-engine.ts`, `packages/shared/src/pricing/ftso.ts`, `packages/shared/src/export/audit-log.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts`, `packages/shared/src/export/__tests__/audit-log.test.ts` | Implemented |
| US-003 | LP-Providing & Farming mit Dual-Szenario | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/classifier/types.ts`, `apps/web/src/components/transactions/dual-scenario-modal.tsx`, `apps/web/src/components/transactions/ampel-badge.tsx` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/export/__tests__/cointracking-e2e.test.ts`, `tests/e2e/transactions.spec.ts` | Implemented |
| US-004 | CoinTracking-CSV-Export | `packages/shared/src/export/cointracking-csv.ts`, `packages/shared/src/export/cointracking-xlsx.ts`, `packages/shared/src/export/audit-log.ts`, `apps/web/src/server/routers/export.ts`, `apps/web/src/server/queue/workers/export-gen.worker.ts`, `apps/web/src/app/api/exports/[exportId]/route.ts` | `packages/shared/src/export/__tests__/cointracking-csv.test.ts`, `packages/shared/src/export/__tests__/cointracking-e2e.test.ts`, `apps/web/src/server/routers/__tests__/export.integration.test.ts`, `apps/web/src/server/queue/workers/__tests__/export-gen.worker.test.ts`, `tests/e2e/exports.spec.ts` | Implemented |
| US-005 | Kinetic-Lending-Transaktionen | `packages/shared/src/classifier/rules/kinetic.ts`, `packages/shared/src/indexer/event-decoder.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| US-006 | Portfolio-Dashboard mit P&L und Steuer-KPIs | `packages/shared/src/tax/tax-engine.ts`, `packages/shared/src/tax/lot-matcher.ts`, `packages/shared/src/tax/haltefrist.ts`, `packages/shared/src/tax/freigrenze.ts`, `apps/web/src/server/routers/dashboard.ts`, `apps/web/src/app/(dashboard)/overview/page.tsx`, `apps/web/src/components/dashboard/freigrenze-bar.tsx`, `apps/web/src/components/dashboard/haltefrist-tracker.tsx`, `apps/web/src/components/dashboard/ampel-donut.tsx`, `apps/web/src/components/dashboard/recent-tx-table.tsx` | `packages/shared/src/tax/__tests__/haltefrist.test.ts`, `packages/shared/src/tax/__tests__/freigrenze.test.ts`, `packages/shared/src/tax/__tests__/lot-matcher.test.ts`, `apps/web/src/server/routers/__tests__/dashboard.integration.test.ts`, `tests/e2e/settings.spec.ts` | Implemented |
| US-007 | FLR-Staking-Rewards & FlareDrops | `packages/shared/src/classifier/rules/flare-native.ts`, `packages/shared/src/classifier/classification-engine.ts`, `packages/shared/src/pricing/ftso.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| US-008 | Manuelle TX-Klassifikation | `apps/web/src/server/routers/transaction.ts`, `apps/web/src/components/transactions/classify-modal.tsx`, `apps/web/src/app/(dashboard)/transactions/page.tsx`, `packages/shared/src/export/audit-log.ts` | `tests/e2e/transactions.spec.ts`, `packages/shared/src/export/__tests__/audit-log.test.ts` | Implemented |
| US-009 | Steuerberater-Plausibilitaetspruefung | `apps/web/src/server/routers/export.ts` (PDF report generation), `packages/shared/src/export/pdf-report.ts` | -- | Partial |
| US-010 | Stargate-Bridge Cross-Chain-Verknuepfung | -- | -- | Phase 4 |
| US-011 | ELSTER-XML-Export | -- | -- | Phase 4 |
| US-012 | White-Label Kanzlei-Einsatz | -- | -- | Phase 4 |

---

## 3. Functional Requirements

### 3.1 Wallet-Verbindung & Synchronisation (FR-01-xx)

| ID | Requirement | Source Files | Test Files | Status |
|----|-------------|-------------|------------|--------|
| FR-01-01 | MetaMask-Verbindung (window.ethereum) | `apps/web/src/lib/wallet-connect.ts`, `apps/web/src/lib/walletconnect.ts` | `tests/e2e/wallets.spec.ts` | Implemented |
| FR-01-02 | WalletConnect v2 (EVM-kompatibel) | `apps/web/src/lib/wallet-connect.ts`, `apps/web/src/lib/walletconnect.ts` | `tests/e2e/wallets.spec.ts` | Implemented |
| FR-01-03 | Manuelle Adresseingabe (Public Key / ENS) | `apps/web/src/server/routers/wallet.ts`, `apps/web/src/app/(dashboard)/wallets/page.tsx` | `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |
| FR-01-04 | Multi-Wallet-Support (plan-based limits) | `apps/web/src/server/routers/wallet.ts`, `apps/web/src/server/lib/plan-limits.ts` | `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |
| FR-01-05 | Historische TX-Synchronisation (vollstaendig) | `packages/shared/src/indexer/wallet-sync.ts`, `packages/shared/src/indexer/flare-rpc.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts` | `packages/shared/src/indexer/__tests__/wallet-sync.test.ts`, `packages/shared/src/indexer/__tests__/flare-rpc.test.ts`, `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts` | Implemented |
| FR-01-06 | Real-Time-Monitoring via WebSocket | `apps/web/src/server/queue/workers/wallet-sync.worker.ts`, `apps/web/src/server/queue/connection.ts` | `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts` | Implemented |
| FR-01-07 | Sync-Fortschrittsanzeige | `apps/web/src/server/queue/workers/wallet-sync.worker.ts`, `apps/web/src/app/(dashboard)/wallets/page.tsx` | `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |
| FR-01-08 | Fehlerbehandlung: Unbekannte TX | `packages/shared/src/classifier/classification-engine.ts`, `apps/web/src/components/transactions/classify-modal.tsx`, `apps/web/src/components/transactions/ampel-badge.tsx` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `tests/e2e/transactions.spec.ts` | Implemented |
| FR-01-09 | Re-Sync-Button (on-demand) | `apps/web/src/server/routers/wallet.ts`, `apps/web/src/app/(dashboard)/wallets/page.tsx` | `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |

### 3.2 Protokoll-Indexierung: SparkDEX V3 + V4 (FR-02-xx)

| ID | TX-Typ | Source Files | Test Files | Status |
|----|--------|-------------|------------|--------|
| FR-02-01 | Swap (V3) | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts`, `packages/shared/src/abis/index.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| FR-02-02 | Swap (V4 Multi-Action) | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| FR-02-03 | LP Provide (V3/V4) | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-02-04 | LP Remove (V3/V4) | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-02-05 | Farming Reward Claim | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| FR-02-06 | SPRK-Staking-Reward | `packages/shared/src/classifier/rules/sparkdex.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-02-07 | Perps Long/Short oeffnen | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| FR-02-08 | Perps Long/Short schliessen | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| FR-02-09 | Gamma-Position (konzentrierte Liquiditaet V4) | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-02-10 | Token-Approval | `packages/shared/src/classifier/rules/sparkdex.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |

### 3.3 Protokoll-Indexierung: Enosys DEX + CDP (FR-03-xx)

| ID | TX-Typ | Source Files | Test Files | Status |
|----|--------|-------------|------------|--------|
| FR-03-01 | DEX V3 Swap (Enosys AMM) | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| FR-03-02 | LP Provide (Enosys V3) | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-03 | LP Remove (Enosys V3) | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-04 | CDP oeffnen (Loans -- FXRP to Stablecoin) | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-05 | Stablecoin Mint via CDP | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-06 | CDP schliessen + Collateral zurueck | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-07 | Liquidation (CDP) | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/classifier/classification-engine.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-08 | Bridge (Enosys to other chain) | `packages/shared/src/classifier/rules/enosys.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | Implemented |
| FR-03-09 | ENSY/APS/HLN Farming-Rewards | `packages/shared/src/classifier/rules/enosys.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/classifier/__tests__/classification-engine.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |

### 3.4 EUR-Kursbewertungs-Engine (FR-05-xx)

| ID | Requirement | Source Files | Test Files | Status |
|----|-------------|-------------|------------|--------|
| FR-05-01 | FTSO-Kurs-Abruf zum exakten TX-Zeitpunkt | `packages/shared/src/pricing/ftso.ts`, `packages/shared/src/pricing/price-engine.ts` | `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| FR-05-02 | Historischer CoinGecko-Kurs (1-Minute Granularitaet) | `packages/shared/src/pricing/coingecko.ts`, `packages/shared/src/pricing/price-engine.ts` | `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| FR-05-03 | Preisquelle + Kurs + Timestamp im Audit-Log | `packages/shared/src/export/audit-log.ts`, `packages/shared/src/pricing/price-engine.ts` | `packages/shared/src/export/__tests__/audit-log.test.ts`, `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| FR-05-04 | Z-Score-Anomalie-Detektor (> 3 sigma) | `packages/shared/src/pricing/price-engine.ts` | `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| FR-05-05 | Rate-Limit-Handling: automatischer Fallback | `packages/shared/src/pricing/price-engine.ts`, `packages/shared/src/pricing/coingecko.ts`, `packages/shared/src/pricing/coinmarketcap.ts` | `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| FR-05-06 | Manuelle Kurs-Ueberschreibung mit Quellenangabe | `packages/shared/src/pricing/price-engine.ts`, `packages/shared/src/export/audit-log.ts` | `packages/shared/src/export/__tests__/audit-log.test.ts` | Implemented |

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-P01 to NFR-P08)

| ID | Requirement | Source Files | Test Files | Status |
|----|-------------|-------------|------------|--------|
| NFR-P01 | Time-to-Value: Wallet-Connect to first green TX < 5 min | `packages/shared/src/indexer/wallet-sync.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts`, `packages/shared/src/classifier/classification-engine.ts` | `tests/k6/smoke.js`, `tests/k6/api-scenarios.js` | Implemented |
| NFR-P02 | Historischer TX-Import < 10 min / 10,000 TX | `packages/shared/src/indexer/wallet-sync.ts`, `packages/shared/src/indexer/flare-rpc.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts` | `tests/k6/load.js`, `tests/k6/api-scenarios.js` | Implemented |
| NFR-P03 | API-Response-Zeit p95 < 500ms | `apps/web/src/server/routers/*.ts`, `apps/web/src/server/trpc.ts` | `tests/k6/api-scenarios.js`, `tests/k6/load.js` | Implemented |
| NFR-P04 | Dashboard FCP < 2s on 4G | `apps/web/src/app/(dashboard)/overview/page.tsx`, `apps/web/src/components/dashboard/*.tsx` | `tests/e2e/a11y.spec.ts` | Implemented |
| NFR-P05 | CSV-Export < 10s for 10,000 TX | `packages/shared/src/export/cointracking-csv.ts`, `apps/web/src/server/queue/workers/export-gen.worker.ts` | `tests/k6/api-scenarios.js`, `apps/web/src/server/queue/workers/__tests__/export-gen.worker.test.ts` | Implemented |
| NFR-P06 | 500 simultaneous users without degradation | `apps/web/src/server/trpc.ts`, `apps/web/src/lib/rate-limit.ts` | `tests/k6/load.js` | Implemented |
| NFR-P07 | Database query p95 < 200ms | `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts` | `tests/k6/db-perf.js` | Implemented |
| NFR-P08 | WebSocket connection stability > 99% / 24h | `apps/web/src/server/queue/connection.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts` | `tests/k6/load.js` | Implemented |

### 4.2 Security (NFR-S01 to NFR-S10)

| ID | Requirement | Source Files | Test Files | Status |
|----|-------------|-------------|------------|--------|
| NFR-S01 | Passwort-Hashing: Argon2id | `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth-utils.ts` | `apps/web/src/lib/__tests__/auth-utils.test.ts`, `tests/e2e/auth.spec.ts` | Implemented |
| NFR-S02 | Wallet-Daten AES-256-GCM at rest | `apps/web/src/lib/storage.ts`, `packages/db/prisma/schema.prisma` | `packages/db/src/__tests__/schema.test.ts` | Implemented |
| NFR-S03 | TLS 1.3 exclusively | `docker/docker-compose.yml`, `.github/workflows/deploy.yml` | `tests/e2e/health.spec.ts` | Implemented |
| NFR-S04 | No private keys stored (read-only wallet) | `apps/web/src/lib/wallet-connect.ts`, `apps/web/src/server/routers/wallet.ts` | `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `tests/e2e/wallets.spec.ts` | Implemented |
| NFR-S05 | Session-Management: JWT 15min + Refresh 7d | `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts` | `apps/web/src/lib/__tests__/auth-utils.test.ts`, `tests/e2e/auth.spec.ts` | Implemented |
| NFR-S06 | 2FA (TOTP) optional Phase 1 | `apps/web/src/lib/auth.ts`, `apps/web/src/app/(dashboard)/settings/page.tsx` | `tests/e2e/settings.spec.ts`, `tests/e2e/auth.spec.ts` | Implemented |
| NFR-S07 | Input-Validierung: Zod-Schema (all API inputs) | `apps/web/src/server/trpc.ts`, `apps/web/src/server/routers/wallet.ts`, `apps/web/src/server/routers/transaction.ts`, `apps/web/src/server/routers/export.ts`, `apps/web/src/server/routers/dashboard.ts`, `apps/web/src/server/routers/user.ts` | `apps/web/src/server/routers/__tests__/wallet.integration.test.ts`, `apps/web/src/server/routers/__tests__/export.integration.test.ts`, `apps/web/src/server/routers/__tests__/dashboard.integration.test.ts`, `apps/web/src/server/routers/__tests__/user.integration.test.ts` | Implemented |
| NFR-S08 | OWASP Top 10 addressed | `apps/web/src/middleware.ts`, `apps/web/src/lib/rate-limit.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/server/trpc.ts` | `tests/e2e/auth.spec.ts`, `tests/e2e/health.spec.ts` | Implemented |
| NFR-S09 | GoBD Audit-Log: SHA-256 hash chain, 10 years | `packages/shared/src/export/audit-log.ts`, `packages/db/prisma/schema.prisma` | `packages/shared/src/export/__tests__/audit-log.test.ts`, `packages/db/src/__tests__/schema.test.ts` | Implemented |
| NFR-S10 | Dependency-Scanning: Dependabot + npm audit | `.github/workflows/ci.yml` | `.github/workflows/ci.yml` (CI pipeline) | Implemented |

### 4.3 Compliance (NFR-C01 to NFR-C07)

| ID | Regulation | Source Files | Test Files | Status |
|----|------------|-------------|------------|--------|
| NFR-C01 | DSGVO Art. 5 -- Datensparsamkeit | `packages/db/prisma/schema.prisma`, `apps/web/src/server/routers/wallet.ts` (public address only) | `packages/db/src/__tests__/schema.test.ts`, `apps/web/src/server/routers/__tests__/wallet.integration.test.ts` | Implemented |
| NFR-C02 | DSGVO Art. 17 -- Datenloesch-Recht (30 Tage) | `apps/web/src/server/routers/user.ts`, `packages/db/prisma/schema.prisma` (cascade delete) | `apps/web/src/server/routers/__tests__/user.integration.test.ts` | Implemented |
| NFR-C03 | DSGVO Art. 32 -- TOMs (Verschluesselung, Zugriffskontrolle) | `apps/web/src/lib/auth.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/middleware.ts`, `apps/web/src/lib/rate-limit.ts` | `apps/web/src/lib/__tests__/auth-utils.test.ts`, `tests/e2e/auth.spec.ts` | Implemented |
| NFR-C04 | GoBD par. 147 AO -- Audit-Log (10 Jahre) | `packages/shared/src/export/audit-log.ts`, `packages/db/prisma/schema.prisma` (audit_log_entries table) | `packages/shared/src/export/__tests__/audit-log.test.ts`, `packages/db/src/__tests__/schema.test.ts` | Implemented |
| NFR-C05 | BMF 2025 Rz. 43 -- EUR-Kursquellen-Nachweis | `packages/shared/src/pricing/price-engine.ts`, `packages/shared/src/export/audit-log.ts` | `packages/shared/src/export/__tests__/audit-log.test.ts`, `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | Implemented |
| NFR-C06 | BFSG -- WCAG 2.2 Level AA | `apps/web/src/app/layout.tsx`, `apps/web/src/components/layout/*.tsx`, `apps/web/src/components/dashboard/*.tsx` | `tests/e2e/a11y.spec.ts` | Implemented |
| NFR-C07 | DAC8 (EU-RL 2023/2226) -- Phase 1 no VASP | `apps/web/src/server/routers/wallet.ts` (read-only, no custody) | `apps/web/src/server/routers/__tests__/wallet.integration.test.ts` | Implemented |

### 4.4 Skalierbarkeit & Infrastruktur (NFR-I01 to NFR-I06)

| ID | Component | Source Files | Test Files | Status |
|----|-----------|-------------|------------|--------|
| NFR-I01 | API-Gateway -- horizontally scalable | `docker/Dockerfile`, `docker/docker-compose.yml`, `.github/workflows/deploy.yml` | `tests/k6/load.js`, `tests/e2e/health.spec.ts` | Implemented |
| NFR-I02 | PostgreSQL -- ACID, Read-Replica ready | `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/0001_init/migration.sql`, `packages/db/prisma/migrations/0002_phase2_beta/migration.sql`, `packages/db/src/index.ts` | `packages/db/src/__tests__/schema.test.ts`, `tests/k6/db-perf.js` | Implemented |
| NFR-I03 | Redis + BullMQ -- queue depth < 100 | `apps/web/src/server/queue/connection.ts`, `apps/web/src/server/queue/index.ts`, `apps/web/src/server/queue/workers/wallet-sync.worker.ts`, `apps/web/src/server/queue/workers/price-fetch.worker.ts`, `apps/web/src/server/queue/workers/export-gen.worker.ts`, `apps/web/src/server/queue/workers/email-send.worker.ts` | `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts`, `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts`, `apps/web/src/server/queue/workers/__tests__/export-gen.worker.test.ts`, `tests/k6/load.js` | Implemented |
| NFR-I04 | Blockchain-Indexer -- 1 instance per chain | `packages/shared/src/indexer/flare-rpc.ts`, `packages/shared/src/indexer/wallet-sync.ts`, `packages/shared/src/indexer/event-decoder.ts` | `packages/shared/src/indexer/__tests__/flare-rpc.test.ts`, `packages/shared/src/indexer/__tests__/wallet-sync.test.ts`, `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | Implemented |
| NFR-I05 | Object Storage (Exporte) -- DSGVO, versioned | `apps/web/src/lib/storage.ts`, `apps/web/src/app/api/exports/[exportId]/route.ts` | `apps/web/src/server/routers/__tests__/export.integration.test.ts`, `tests/e2e/exports.spec.ts` | Implemented |
| NFR-I06 | Uptime-SLA >= 99.5% | `apps/web/src/app/api/health/route.ts`, `docker/docker-compose.yml`, `.github/workflows/deploy.yml` | `apps/web/src/app/api/health/__tests__/route.test.ts`, `tests/e2e/health.spec.ts`, `tests/k6/smoke.js` | Implemented |

---

## 5. Cross-Reference: Test File Index

This index maps each test file to the requirement IDs it covers, for quick reverse lookup.

| Test File | Requirement IDs Covered |
|-----------|------------------------|
| `packages/shared/src/indexer/__tests__/wallet-sync.test.ts` | EP-01, US-001, FR-01-05, NFR-P02, NFR-I04 |
| `packages/shared/src/indexer/__tests__/flare-rpc.test.ts` | EP-01, US-001, FR-01-05, NFR-I04 |
| `packages/shared/src/indexer/__tests__/event-decoder.test.ts` | EP-02, EP-03, EP-04, US-002, US-005, FR-02-01..FR-02-02, FR-02-05, FR-02-07..FR-02-08, FR-03-01, FR-03-09, NFR-I04 |
| `packages/shared/src/classifier/__tests__/classification-engine.test.ts` | EP-02..EP-04, EP-06, EP-09, EP-11, US-002, US-003, US-005, US-007, FR-01-08, FR-02-01..FR-02-10, FR-03-01..FR-03-09 |
| `packages/shared/src/export/__tests__/cointracking-csv.test.ts` | EP-07, US-004 |
| `packages/shared/src/export/__tests__/cointracking-e2e.test.ts` | EP-07, EP-09, US-003, US-004 |
| `packages/shared/src/export/__tests__/audit-log.test.ts` | EP-07, US-002, US-008, FR-05-03, FR-05-06, NFR-S09, NFR-C04, NFR-C05 |
| `packages/shared/src/tax/__tests__/lot-matcher.test.ts` | EP-08, US-006 |
| `packages/shared/src/tax/__tests__/haltefrist.test.ts` | EP-08, US-006 |
| `packages/shared/src/tax/__tests__/freigrenze.test.ts` | EP-08, US-006 |
| `packages/db/src/__tests__/schema.test.ts` | NFR-S02, NFR-S09, NFR-C01, NFR-C04, NFR-I02 |
| `apps/web/src/lib/__tests__/auth-utils.test.ts` | NFR-S01, NFR-S05, NFR-C03 |
| `apps/web/src/app/api/health/__tests__/route.test.ts` | NFR-I06 |
| `apps/web/src/server/queue/workers/__tests__/wallet-sync.worker.test.ts` | EP-01, US-001, FR-01-05..FR-01-07, NFR-P01, NFR-P02, NFR-I03 |
| `apps/web/src/server/queue/workers/__tests__/price-fetch.worker.test.ts` | EP-05, FR-05-01..FR-05-05, NFR-C05 |
| `apps/web/src/server/queue/workers/__tests__/export-gen.worker.test.ts` | EP-07, US-004, NFR-P05, NFR-I03 |
| `apps/web/src/server/routers/__tests__/export.integration.test.ts` | EP-07, US-004, NFR-S07, NFR-I05 |
| `apps/web/src/server/routers/__tests__/wallet.integration.test.ts` | EP-01, US-001, FR-01-03..FR-01-04, FR-01-09, NFR-S04, NFR-S07, NFR-C01, NFR-C07 |
| `apps/web/src/server/routers/__tests__/dashboard.integration.test.ts` | EP-08, US-006, NFR-S07 |
| `apps/web/src/server/routers/__tests__/user.integration.test.ts` | NFR-S07, NFR-C02 |
| `tests/e2e/wallets.spec.ts` | EP-01, US-001, FR-01-01..FR-01-04, FR-01-07, FR-01-09, NFR-S04 |
| `tests/e2e/transactions.spec.ts` | EP-06, EP-09, EP-10, US-003, US-008, FR-01-08 |
| `tests/e2e/exports.spec.ts` | EP-07, US-004, NFR-I05 |
| `tests/e2e/auth.spec.ts` | NFR-S01, NFR-S05, NFR-S06, NFR-S08, NFR-C03 |
| `tests/e2e/settings.spec.ts` | EP-08, US-006, NFR-S06 |
| `tests/e2e/health.spec.ts` | NFR-S03, NFR-I01, NFR-I06 |
| `tests/e2e/a11y.spec.ts` | NFR-P04, NFR-C06 |
| `tests/k6/smoke.js` | NFR-P01, NFR-I06 |
| `tests/k6/load.js` | NFR-P02, NFR-P03, NFR-P06, NFR-P08, NFR-I01, NFR-I03 |
| `tests/k6/api-scenarios.js` | NFR-P01, NFR-P02, NFR-P03, NFR-P05 |
| `tests/k6/db-perf.js` | NFR-P07, NFR-I02 |

---

## 6. Maintaining This Matrix

When adding new features or modifying existing ones, follow these steps to keep this matrix current:

1. **New requirement added to PRD**: Add a new row in the appropriate section with the requirement ID, title, and set status to `Not yet implemented` until code is written.

2. **New source file created**: Find all requirements that the file addresses and add the file path to their Source Files column.

3. **New test file created**: Find all requirements verified by the test and add the file path to their Test Files column. Also add a row to the Cross-Reference: Test File Index (Section 5).

4. **Requirement status change**: Update the Status column when:
   - Code is first written: change from `Not yet implemented` to `Partial`
   - Tests pass and requirement is fully met: change to `Implemented`
   - A Phase 4 requirement is started: change from `Phase 4` to `Partial` or `Implemented`

5. **Requirement removed or deferred**: Update status and clear Source/Test Files if code is removed.

6. **Update summary statistics**: After any change, recalculate the counts in the Summary Statistics table (Section at top).

7. **Review cadence**: This matrix should be reviewed during each sprint retrospective and updated as part of the Definition of Done for any feature work.
