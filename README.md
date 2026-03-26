# DeFi Tracker SaaS

**On-Chain Tax Intelligence for Flare Network DeFi Users**

Fully automated, BMF-2025-compliant DeFi transaction tracking and CoinTracking CSV export — so users don't need to understand German tax law.

## Overview

DeFi Tracker is a SaaS platform by [NextGen IT Solutions GmbH](https://nextgenitsolutions.de) (Stuttgart) that automatically indexes, classifies, and exports DeFi transactions from the Flare Network ecosystem for German tax compliance.

### Supported Protocols (MVP)
| Protocol | Type | Status |
|----------|------|--------|
| SparkDEX V3/V4 | AMM / DEX | Planned |
| Enosys DEX + CDP | DEX + CDP | Planned |
| Kinetic Market | Lending/Borrowing | Planned |
| FLR Staking & FlareDrops | Native Staking | Planned |

### Key Features
- **Wallet Connection**: MetaMask / WalletConnect / manual address input
- **Auto-Classification**: All DeFi TX types mapped to CoinTracking categories
- **BMF 2025 Compliance**: Full mapping to § 22 / § 23 EStG
- **FTSO Price Feeds**: EUR valuation at exact blockchain timestamp
- **CoinTracking CSV Export**: Direct 15-column export, no manual editing
- **Grey Area Indicator**: Traffic-light system for ambiguous tax treatments
- **GoBD Audit Log**: Immutable transaction audit trail

## Tech Stack
- **Frontend**: Next.js / React / TypeScript
- **Backend**: Node.js / TypeScript
- **Database**: PostgreSQL
- **Hosting**: Hetzner (self-hosted) via Coolify
- **CI/CD**: GitHub Actions with 4 Hetzner self-hosted runners
- **Domain**: app.defi.nextgenitsolutions.de

## Getting Started

```bash
# Clone the repository
git clone https://github.com/NextGenITSolutionsGmbH/nextgen-defi-saas.git
cd nextgen-defi-saas

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Install dependencies
npm install

# Start development server
npm run dev
```

## Documentation
- [Product Requirements (PRD v2)](DeFiTracker_PRD_v2.md)
- [Technical Analysis v10](DeFi_Tracker_Komplett_v10_NextGen.md)
- [Brand Guidelines](DeFiTracker_BrandBook_KOMPLETT_v1.md)

## Deployment
Deployment is automated via GitHub Actions → Coolify on Hetzner infrastructure.

| Environment | URL | Branch |
|-------------|-----|--------|
| Production | https://app.defi.nextgenitsolutions.de | main |
| Staging | TBD | develop |

## License
Proprietary — NextGen IT Solutions GmbH. All rights reserved.
