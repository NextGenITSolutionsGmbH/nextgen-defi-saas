// ---------------------------------------------------------------------------
// SparkDEX V3/V4 — Transaction Classification Rules
// ---------------------------------------------------------------------------
// Classifies decoded events from SparkDEX (Uniswap V3/V4 fork on Flare)
// into CoinTracking-compatible types with BMF-2025 tax law references.
//
// @spec FR-02-01..FR-02-10, EP-02 — SparkDEX V3/V4 classification rules
// ---------------------------------------------------------------------------

import type { DecodedEvent, ClassificationResult } from '../types';

/** Known SparkDEX reward / staking contract addresses (Flare Mainnet, lowercase) */
const SPARKDEX_REWARD_CONTRACTS: ReadonlySet<string> = new Set([
  '0x6bb4025dc157e4c68d6d23a0d1d2e3e08c29ebd6', // SPRK token
]);

/**
 * Classify a decoded event from SparkDEX V3/V4.
 *
 * @param event - The decoded on-chain event.
 * @returns A ClassificationResult, or null if the event is not from SparkDEX.
 */
export function classifySparkDex(event: DecodedEvent): ClassificationResult | null {
  const proto = event.protocol?.toLowerCase() ?? '';
  if (!proto.includes('sparkdex') && !proto.includes('spark')) {
    return null;
  }

  const name = event.eventName;

  switch (name) {
    // -----------------------------------------------------------------
    // Swap — §23 EStG private Veraeusserungsgeschaeft (disposal)
    // -----------------------------------------------------------------
    case 'Swap':
      return {
        ctType: 'Trade',
        buyAmount: stringOrNull(event.args['amountOut'] ?? event.args['amount1'] ?? event.args['amount0Out']),
        buyCurrency: stringOrNull(event.args['tokenOut'] ?? event.args['token1']),
        sellAmount: stringOrNull(event.args['amountIn'] ?? event.args['amount0'] ?? event.args['amount0In']),
        sellCurrency: stringOrNull(event.args['tokenIn'] ?? event.args['token0']),
        fee: stringOrNull(event.args['fee']),
        feeCurrency: stringOrNull(event.args['feeCurrency'] ?? 'FLR'),
        exchange: 'SparkDEX',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'GREEN',
        isGraubereich: false,
        modelChoice: null,
        comment: 'SparkDEX Swap — privates Veraeusserungsgeschaeft gemaess §23 EStG. Haltefrist 1 Jahr beachten.',
      };

    // -----------------------------------------------------------------
    // Mint (LP Provide) — Graubereich: dual-scenario treatment
    // Model A: Tausch (disposal, new holding period starts)
    // Model B: Kein Tausch (no disposal, original holding period preserved)
    // -----------------------------------------------------------------
    case 'Mint':
    case 'IncreaseLiquidity':
      return {
        ctType: 'Add Liquidity',
        buyAmount: stringOrNull(event.args['liquidity']),
        buyCurrency: stringOrNull(event.args['lpToken'] ?? 'LP-Token'),
        sellAmount: stringOrNull(event.args['amount0'] ?? event.args['amount']),
        sellCurrency: stringOrNull(event.args['token0']),
        fee: null,
        feeCurrency: null,
        exchange: 'SparkDEX',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'SparkDEX LP Bereitstellung — Graubereich BMF 2025. ' +
          'Modell A: Tausch der Einlage-Token gegen LP-Token (§23 EStG, neue Haltefrist). ' +
          'Modell B: Kein steuerrelevanter Tausch (Einlage, Haltefrist laeuft weiter). ' +
          'Nutzer muss Szenario waehlen.',
      };

    // -----------------------------------------------------------------
    // Burn (LP Remove) — Graubereich reversal
    // -----------------------------------------------------------------
    case 'Burn':
    case 'DecreaseLiquidity':
      return {
        ctType: 'Remove Liquidity',
        buyAmount: stringOrNull(event.args['amount0'] ?? event.args['amount']),
        buyCurrency: stringOrNull(event.args['token0']),
        sellAmount: stringOrNull(event.args['liquidity']),
        sellCurrency: stringOrNull(event.args['lpToken'] ?? 'LP-Token'),
        fee: null,
        feeCurrency: null,
        exchange: 'SparkDEX',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'SparkDEX LP Entnahme — Graubereich BMF 2025. ' +
          'Modell A: Ruecktausch LP-Token gegen Einlage-Token (§23 EStG). ' +
          'Modell B: Kein steuerrelevanter Tausch (Entnahme). ' +
          'Muss konsistent mit Bereitstellungs-Szenario gewaehlt werden.',
      };

    // -----------------------------------------------------------------
    // Collect (Farming Reward) — §22 Nr.3 EStG sonstige Einkuenfte
    // -----------------------------------------------------------------
    case 'Collect':
    case 'CollectProtocol':
      return {
        ctType: 'LP Rewards',
        buyAmount: stringOrNull(event.args['amount0'] ?? event.args['amount']),
        buyCurrency: stringOrNull(event.args['token0'] ?? event.args['rewardToken']),
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'SparkDEX',
        tradeGroup: 'Farming',
        ampelStatus: 'GREEN',
        isGraubereich: false,
        modelChoice: null,
        comment: 'SparkDEX Farming Reward — sonstige Einkuenfte gemaess §22 Nr.3 EStG. Freigrenze 256 EUR/Jahr beachten.',
      };

    // -----------------------------------------------------------------
    // Transfer from SPRK reward contract — Staking reward
    // §22 Nr.3 EStG sonstige Einkuenfte
    // -----------------------------------------------------------------
    case 'Transfer': {
      const from = String(event.args['from'] ?? '').toLowerCase();
      if (SPARKDEX_REWARD_CONTRACTS.has(from) || SPARKDEX_REWARD_CONTRACTS.has(event.contractAddress.toLowerCase())) {
        return {
          ctType: 'Staking',
          buyAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
          buyCurrency: 'SPRK',
          sellAmount: null,
          sellCurrency: null,
          fee: null,
          feeCurrency: null,
          exchange: 'SparkDEX',
          tradeGroup: 'Staking',
          ampelStatus: 'GREEN',
          isGraubereich: false,
          modelChoice: null,
          comment: 'SparkDEX SPRK Staking Reward — sonstige Einkuenfte gemaess §22 Nr.3 EStG. Freigrenze 256 EUR/Jahr beachten.',
        };
      }
      // Not a reward transfer — not handled by SparkDEX classifier
      return null;
    }

    // -----------------------------------------------------------------
    // Approval — Tax-irrelevant, GRAY
    // -----------------------------------------------------------------
    case 'Approval':
      return {
        ctType: 'Other',
        buyAmount: null,
        buyCurrency: null,
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'SparkDEX',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment: 'SparkDEX Approval — steuerlich irrelevant. Keine Veraeusserung oder Einkuenfte.',
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely convert an unknown event arg to a string, or return null.
 */
function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}
