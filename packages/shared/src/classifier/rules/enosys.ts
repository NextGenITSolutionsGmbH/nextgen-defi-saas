// ---------------------------------------------------------------------------
// Enosys DEX + CDP — Transaction Classification Rules
// ---------------------------------------------------------------------------
// Classifies decoded events from the Enosys protocol on Flare Network.
// Covers DEX swaps, LP operations, CDP (collateralised debt positions),
// stablecoin minting, farming rewards, and bridge transfers.
// ---------------------------------------------------------------------------

import type { DecodedEvent, ClassificationResult } from '../types';

/** Known Enosys farming/reward token symbols */
const ENOSYS_REWARD_TOKENS: ReadonlySet<string> = new Set(['aps', 'hln', 'rflr', 'ensy']);

/**
 * Classify a decoded event from the Enosys protocol.
 *
 * @param event - The decoded on-chain event.
 * @returns A ClassificationResult, or null if the event is not from Enosys.
 */
export function classifyEnosys(event: DecodedEvent): ClassificationResult | null {
  const proto = event.protocol?.toLowerCase() ?? '';
  if (!proto.includes('enosys') && !proto.includes('ēnosys')) {
    return null;
  }

  const name = event.eventName;

  switch (name) {
    // -----------------------------------------------------------------
    // DEX Swap — §23 EStG private Veraeusserungsgeschaeft
    // -----------------------------------------------------------------
    case 'Swap':
    case 'TokenSwap':
      return {
        ctType: 'Trade',
        buyAmount: stringOrNull(event.args['amountOut'] ?? event.args['tokensBought']),
        buyCurrency: stringOrNull(event.args['tokenOut'] ?? event.args['boughtToken']),
        sellAmount: stringOrNull(event.args['amountIn'] ?? event.args['tokensSold']),
        sellCurrency: stringOrNull(event.args['tokenIn'] ?? event.args['soldToken']),
        fee: stringOrNull(event.args['fee']),
        feeCurrency: stringOrNull(event.args['feeCurrency'] ?? 'FLR'),
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'GREEN',
        isGraubereich: false,
        modelChoice: null,
        comment: 'Ēnosys DEX Swap — privates Veraeusserungsgeschaeft gemaess §23 EStG. Haltefrist 1 Jahr beachten.',
      };

    // -----------------------------------------------------------------
    // LP Provide — Graubereich
    // -----------------------------------------------------------------
    case 'Mint':
    case 'AddLiquidity':
      return {
        ctType: 'Add Liquidity',
        buyAmount: stringOrNull(event.args['liquidity'] ?? event.args['lpTokens']),
        buyCurrency: stringOrNull(event.args['lpToken'] ?? 'LP-Token'),
        sellAmount: stringOrNull(event.args['amount0'] ?? event.args['tokenAmount']),
        sellCurrency: stringOrNull(event.args['token0']),
        fee: null,
        feeCurrency: null,
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'Ēnosys LP Bereitstellung — Graubereich BMF 2025. ' +
          'Modell A: Tausch gegen LP-Token (§23 EStG, neue Haltefrist). ' +
          'Modell B: Kein steuerrelevanter Tausch (Einlage). ' +
          'Nutzer muss Szenario waehlen.',
      };

    // -----------------------------------------------------------------
    // LP Remove — Graubereich reversal
    // -----------------------------------------------------------------
    case 'Burn':
    case 'RemoveLiquidity':
      return {
        ctType: 'Remove Liquidity',
        buyAmount: stringOrNull(event.args['amount0'] ?? event.args['tokenAmount']),
        buyCurrency: stringOrNull(event.args['token0']),
        sellAmount: stringOrNull(event.args['liquidity'] ?? event.args['lpTokens']),
        sellCurrency: stringOrNull(event.args['lpToken'] ?? 'LP-Token'),
        fee: null,
        feeCurrency: null,
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'Ēnosys LP Entnahme — Graubereich BMF 2025. ' +
          'Modell A: Ruecktausch LP-Token (§23 EStG). ' +
          'Modell B: Kein steuerrelevanter Tausch (Entnahme). ' +
          'Konsistent mit Bereitstellungs-Szenario waehlen.',
      };

    // -----------------------------------------------------------------
    // CDP Open — Critical Graubereich
    // Model A: Tausch (Trade) — collateral exchanged for stablecoin
    // Model B: Darlehen (Loan) — collateral locked, stablecoin is loan
    // -----------------------------------------------------------------
    case 'CDPOpened':
    case 'CDPCreated':
      return {
        ctType: 'Trade',
        buyAmount: stringOrNull(event.args['debtAmount'] ?? event.args['stablecoinMinted']),
        buyCurrency: stringOrNull(event.args['stablecoin'] ?? 'USDX'),
        sellAmount: stringOrNull(event.args['collateralAmount']),
        sellCurrency: stringOrNull(event.args['collateralToken'] ?? 'WFLR'),
        fee: stringOrNull(event.args['fee']),
        feeCurrency: stringOrNull(event.args['feeCurrency'] ?? 'FLR'),
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'Ēnosys CDP Eroeffnung — KRITISCHER Graubereich BMF 2025. ' +
          'Modell A (konservativ): Tausch Collateral gegen Stablecoin (§23 EStG, Veraeusserung). ' +
          'Modell B (progressiv): Darlehensaufnahme (steuerlich neutral, kein Tausch). ' +
          'BMF hat hierzu noch keine eindeutige Stellung bezogen. Nutzer muss Szenario waehlen.',
      };

    // -----------------------------------------------------------------
    // CDP Close — Graubereich reversal of CDP Open
    // -----------------------------------------------------------------
    case 'CDPClosed':
    case 'CDPRepaid':
      return {
        ctType: 'Trade',
        buyAmount: stringOrNull(event.args['collateralReturned'] ?? event.args['collateralAmount']),
        buyCurrency: stringOrNull(event.args['collateralToken'] ?? 'WFLR'),
        sellAmount: stringOrNull(event.args['debtRepaid'] ?? event.args['stablecoinBurned']),
        sellCurrency: stringOrNull(event.args['stablecoin'] ?? 'USDX'),
        fee: stringOrNull(event.args['fee']),
        feeCurrency: stringOrNull(event.args['feeCurrency'] ?? 'FLR'),
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'Ēnosys CDP Schliessung — Graubereich BMF 2025 (Umkehrung der Eroeffnung). ' +
          'Modell A: Ruecktausch Stablecoin gegen Collateral (§23 EStG). ' +
          'Modell B: Darlehensrueckzahlung (steuerlich neutral). ' +
          'Muss konsistent mit CDP-Eroeffnungs-Szenario gewaehlt werden.',
      };

    // -----------------------------------------------------------------
    // CDP Liquidation — RED: forced disposal, §23 EStG
    // -----------------------------------------------------------------
    case 'CDPLiquidated':
    case 'Liquidation':
      return {
        ctType: 'Trade',
        buyAmount: stringOrNull(event.args['debtCovered'] ?? event.args['debtRepaid']),
        buyCurrency: stringOrNull(event.args['stablecoin'] ?? 'USDX'),
        sellAmount: stringOrNull(event.args['collateralSeized'] ?? event.args['collateralLiquidated']),
        sellCurrency: stringOrNull(event.args['collateralToken'] ?? 'WFLR'),
        fee: stringOrNull(event.args['liquidationPenalty']),
        feeCurrency: stringOrNull(event.args['penaltyToken'] ?? 'WFLR'),
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'RED',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Ēnosys CDP Liquidation — Zwangsveraeusserung gemaess §23 EStG. ' +
          'ACHTUNG: Liquidation gilt steuerlich als Veraeusserung (Trade) unabhaengig vom gewaehlten CDP-Modell. ' +
          'Liquidationsstrafe als Kosten der Veraeusserung absetzbar. Manuelle Pruefung empfohlen.',
      };

    // -----------------------------------------------------------------
    // Stablecoin Mint — linked to CDP, YELLOW
    // -----------------------------------------------------------------
    case 'StablecoinMinted':
    case 'MintStable':
      return {
        ctType: 'Trade',
        buyAmount: stringOrNull(event.args['amount'] ?? event.args['stablecoinAmount']),
        buyCurrency: stringOrNull(event.args['stablecoin'] ?? 'USDX'),
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'Ēnosys Stablecoin Minting — Graubereich, an CDP-Eroeffnung gekoppelt. ' +
          'Steuerliche Behandlung haengt vom gewaehlten CDP-Modell ab (Tausch vs. Darlehen). ' +
          'Siehe zugehoerige CDP-Transaktion.',
      };

    // -----------------------------------------------------------------
    // Farming Rewards (APS, HLN, rFLR) — §22 Nr.3 EStG
    // -----------------------------------------------------------------
    case 'RewardClaimed':
    case 'RewardPaid':
    case 'Harvest': {
      const rewardToken = String(event.args['rewardToken'] ?? event.args['token'] ?? '').toLowerCase();
      const isKnownReward = ENOSYS_REWARD_TOKENS.has(rewardToken);

      return {
        ctType: 'LP Rewards',
        buyAmount: stringOrNull(event.args['amount'] ?? event.args['reward']),
        buyCurrency: stringOrNull(event.args['rewardToken'] ?? event.args['token']),
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'Ēnosys',
        tradeGroup: 'Farming',
        ampelStatus: 'GREEN',
        isGraubereich: false,
        modelChoice: null,
        comment:
          `Ēnosys Farming Reward${isKnownReward ? ` (${rewardToken.toUpperCase()})` : ''} — ` +
          'sonstige Einkuenfte gemaess §22 Nr.3 EStG. Freigrenze 256 EUR/Jahr beachten.',
      };
    }

    // -----------------------------------------------------------------
    // Bridge Transfer — Internal transfer, GRAY (tax neutral)
    // -----------------------------------------------------------------
    case 'BridgeTransfer':
    case 'BridgeDeposit':
    case 'BridgeWithdraw':
      return {
        ctType: 'Transfer (intern)',
        buyAmount: stringOrNull(event.args['amount']),
        buyCurrency: stringOrNull(event.args['token']),
        sellAmount: stringOrNull(event.args['amount']),
        sellCurrency: stringOrNull(event.args['token']),
        fee: stringOrNull(event.args['bridgeFee']),
        feeCurrency: stringOrNull(event.args['feeToken'] ?? 'FLR'),
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'Ēnosys Bridge Transfer — interner Transfer zwischen Netzwerken. ' +
          'Steuerlich neutral (kein Tausch, keine Veraeusserung). Brueckengebuehr ggf. als Werbungskosten.',
      };

    // -----------------------------------------------------------------
    // Approval — Tax-irrelevant
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
        exchange: 'Ēnosys',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'GRAY',
        isGraubereich: false,
        modelChoice: null,
        comment: 'Ēnosys Approval — steuerlich irrelevant. Keine Veraeusserung oder Einkuenfte.',
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
