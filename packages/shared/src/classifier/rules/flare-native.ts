// ---------------------------------------------------------------------------
// Flare Network Native Events — Transaction Classification Rules
// ---------------------------------------------------------------------------
// Classifies decoded events native to the Flare Network itself:
// delegation rewards, FlareDrop claims, rFLR emissions, FAssets, and
// generic ERC20 transfers/approvals.
//
// @spec US-007, EP-11 — FLR staking, FlareDrops classification
// ---------------------------------------------------------------------------

import type { DecodedEvent, ClassificationResult } from '../types';

/** Known exchange/CEX deposit addresses (lowercase). Transfers to/from these are not internal. */
const KNOWN_EXCHANGE_ADDRESSES: ReadonlySet<string> = new Set([
  // Placeholder — populated from configuration in production
]);

/**
 * Classify a decoded event from Flare Network native contracts.
 *
 * @param event - The decoded on-chain event.
 * @returns A ClassificationResult, or null if the event cannot be classified here.
 */
export function classifyFlareNative(event: DecodedEvent): ClassificationResult | null {
  const proto = event.protocol?.toLowerCase() ?? '';
  const name = event.eventName;

  // -----------------------------------------------------------------
  // FLR Delegation Reward — §22 Nr.3 EStG sonstige Einkuenfte
  // FTSO delegation rewards paid in FLR/WFLR
  // -----------------------------------------------------------------
  if (
    name === 'RewardClaimed' ||
    name === 'RewardDistributed' ||
    (name === 'Transfer' && proto.includes('ftso'))
  ) {
    if (proto.includes('ftso') || proto.includes('delegation') || proto.includes('flare')) {
      return {
        ctType: 'Staking',
        buyAmount: stringOrNull(event.args['amount'] ?? event.args['value'] ?? event.args['reward']),
        buyCurrency: stringOrNull(event.args['token'] ?? 'FLR'),
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: 'Flare Network',
        tradeGroup: 'Staking',
        ampelStatus: 'GREEN',
        isGraubereich: false,
        modelChoice: null,
        comment:
          'FLR Delegation Reward (FTSO) — sonstige Einkuenfte gemaess §22 Nr.3 EStG. ' +
          'Freigrenze 256 EUR/Jahr beachten. Zuflusszeitpunkt = Zeitpunkt des Claims.',
      };
    }
  }

  // -----------------------------------------------------------------
  // FlareDrop Claim — Airdrop, §22 Nr.3 EStG
  // Monthly FlareDrop distribution for WFLR holders
  // -----------------------------------------------------------------
  if (name === 'FlareDropClaimed' || name === 'AirdropClaimed' || name === 'DistributionClaimed') {
    return {
      ctType: 'Airdrop',
      buyAmount: stringOrNull(event.args['amount'] ?? event.args['value']),
      buyCurrency: stringOrNull(event.args['token'] ?? 'FLR'),
      sellAmount: null,
      sellCurrency: null,
      fee: null,
      feeCurrency: null,
      exchange: 'Flare Network',
      tradeGroup: 'Staking',
      ampelStatus: 'GREEN',
      isGraubereich: false,
      modelChoice: null,
      comment:
        'FlareDrop Claim — Airdrop, sonstige Einkuenfte gemaess §22 Nr.3 EStG. ' +
        'Freigrenze 256 EUR/Jahr beachten. Marktwert zum Zuflusszeitpunkt massgeblich.',
    };
  }

  // -----------------------------------------------------------------
  // rFLR Emission — LP Rewards, §22 Nr.3 EStG
  // Reward FLR distributed for DeFi participation
  // -----------------------------------------------------------------
  if (
    (name === 'Transfer' || name === 'RewardClaimed' || name === 'RewardPaid') &&
    (proto.includes('rflr') || String(event.args['token'] ?? '').toLowerCase() === 'rflr')
  ) {
    return {
      ctType: 'LP Rewards',
      buyAmount: stringOrNull(event.args['amount'] ?? event.args['value']),
      buyCurrency: 'rFLR',
      sellAmount: null,
      sellCurrency: null,
      fee: null,
      feeCurrency: null,
      exchange: 'Flare Network',
      tradeGroup: 'Farming',
      ampelStatus: 'GREEN',
      isGraubereich: false,
      modelChoice: null,
      comment:
        'rFLR Emission — LP Reward, sonstige Einkuenfte gemaess §22 Nr.3 EStG. ' +
        'Freigrenze 256 EUR/Jahr beachten.',
    };
  }

  // -----------------------------------------------------------------
  // FAsset Mint (FXRP, FBTC, etc.) — Trade, §23 EStG
  // Minting FAssets creates a new holding with new holding period.
  // -----------------------------------------------------------------
  if (
    (name === 'CollateralReservationCreated' || name === 'MintingExecuted' || name === 'FAssetMinted') &&
    (proto.includes('fasset') || proto.includes('flare'))
  ) {
    return {
      ctType: 'Trade',
      buyAmount: stringOrNull(event.args['mintedAmount'] ?? event.args['fAssetAmount']),
      buyCurrency: stringOrNull(event.args['fAsset'] ?? event.args['token']),
      sellAmount: stringOrNull(event.args['collateralAmount'] ?? event.args['paymentAmount']),
      sellCurrency: stringOrNull(event.args['paymentToken'] ?? 'FLR'),
      fee: stringOrNull(event.args['fee'] ?? event.args['mintingFee']),
      feeCurrency: stringOrNull(event.args['feeToken'] ?? 'FLR'),
      exchange: 'Flare Network',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'GREEN',
      isGraubereich: false,
      modelChoice: null,
      comment:
        'FAsset Minting — privates Veraeusserungsgeschaeft gemaess §23 EStG. ' +
        'Neue Haltefrist beginnt fuer den geminteten FAsset. Haltefrist 1 Jahr beachten.',
    };
  }

  // -----------------------------------------------------------------
  // FAsset Redemption — Trade, §23 EStG
  // -----------------------------------------------------------------
  if (
    (name === 'RedemptionRequested' || name === 'RedemptionPerformed' || name === 'FAssetRedeemed') &&
    (proto.includes('fasset') || proto.includes('flare'))
  ) {
    return {
      ctType: 'Trade',
      buyAmount: stringOrNull(event.args['underlyingAmount'] ?? event.args['redeemedAmount']),
      buyCurrency: stringOrNull(event.args['underlyingToken'] ?? event.args['paymentToken']),
      sellAmount: stringOrNull(event.args['fAssetAmount'] ?? event.args['burnedAmount']),
      sellCurrency: stringOrNull(event.args['fAsset'] ?? event.args['token']),
      fee: stringOrNull(event.args['fee'] ?? event.args['redemptionFee']),
      feeCurrency: stringOrNull(event.args['feeToken'] ?? 'FLR'),
      exchange: 'Flare Network',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'GREEN',
      isGraubereich: false,
      modelChoice: null,
      comment:
        'FAsset Redemption — privates Veraeusserungsgeschaeft gemaess §23 EStG. ' +
        'Veraeusserung des FAssets. Haltefrist ab Minting-Zeitpunkt pruefen.',
    };
  }

  // -----------------------------------------------------------------
  // ERC20 Approval — GRAY (tax irrelevant)
  // -----------------------------------------------------------------
  if (name === 'Approval') {
    return {
      ctType: 'Other',
      buyAmount: null,
      buyCurrency: null,
      sellAmount: null,
      sellCurrency: null,
      fee: null,
      feeCurrency: null,
      exchange: 'Flare Network',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'GRAY',
      isGraubereich: false,
      modelChoice: null,
      comment: 'ERC20 Approval — steuerlich irrelevant. Keine Veraeusserung oder Einkuenfte.',
    };
  }

  // -----------------------------------------------------------------
  // ERC20 Transfer — GRAY (internal transfer) unless to/from exchange
  // -----------------------------------------------------------------
  if (name === 'Transfer') {
    const to = String(event.args['to'] ?? '').toLowerCase();
    const from = String(event.args['from'] ?? '').toLowerCase();
    const isExchangeTransfer =
      KNOWN_EXCHANGE_ADDRESSES.has(to) || KNOWN_EXCHANGE_ADDRESSES.has(from);

    if (isExchangeTransfer) {
      // Transfer to/from a known exchange — may be taxable, needs review
      return {
        ctType: 'Transfer (intern)',
        buyAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
        buyCurrency: stringOrNull(event.args['token'] ?? event.args['symbol']),
        sellAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
        sellCurrency: stringOrNull(event.args['token'] ?? event.args['symbol']),
        fee: null,
        feeCurrency: null,
        exchange: 'Flare Network',
        tradeGroup: 'DeFi-Flare',
        ampelStatus: 'YELLOW',
        isGraubereich: true,
        modelChoice: null,
        comment:
          'ERC20 Transfer zu/von bekannter Boerse — moeglicherweise steuerrelevant. ' +
          'Transfer an Boerse koennte Verkaufsabsicht signalisieren. Manuelle Pruefung empfohlen.',
      };
    }

    // Standard internal transfer
    return {
      ctType: 'Transfer (intern)',
      buyAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
      buyCurrency: stringOrNull(event.args['token'] ?? event.args['symbol']),
      sellAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
      sellCurrency: stringOrNull(event.args['token'] ?? event.args['symbol']),
      fee: null,
      feeCurrency: null,
      exchange: 'Flare Network',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'GRAY',
      isGraubereich: false,
      modelChoice: null,
      comment:
        'ERC20 Transfer (intern) — steuerlich neutral. ' +
        'Kein Tausch, keine Veraeusserung. Eigentumsuebertragung zwischen eigenen Wallets.',
    };
  }

  // Event not handled by Flare native classifier
  return null;
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
