// ---------------------------------------------------------------------------
// Classification Engine — Main entry point
// ---------------------------------------------------------------------------
// 5-layer classification pipeline that routes decoded blockchain events
// through protocol-specific classifiers and heuristic fallbacks to produce
// CoinTracking-compatible, BMF-2025-compliant tax classifications.
//
// @spec EP-06 — TX Classification Engine (5-layer pipeline)
// @spec EP-09 — Graubereich Ampel & Dual-Szenario
// ---------------------------------------------------------------------------

import type { DecodedEvent, ClassificationResult, AmpelStatus } from './types';
import { classifySparkDex } from './rules/sparkdex';
import { classifyEnosys } from './rules/enosys';
import { classifyKinetic } from './rules/kinetic';
import { classifyFlareNative } from './rules/flare-native';

/**
 * Known protocol contract addresses mapped to protocol identifiers.
 * Used in Layer 2 (Contract Address Match) when event.protocol is not set.
 * All addresses are stored lowercase for case-insensitive comparison.
 */
const CONTRACT_TO_PROTOCOL: ReadonlyMap<string, string> = new Map([
  // SparkDEX
  ['0x8a1e35f5c98c4e85500f079e0b2bd83bdf23e9cd', 'sparkdex'],  // V3 Router
  ['0x1b4e2e8b6d5b2c90e4b0ce5a38b7df8c1264e8e', 'sparkdex'],  // V4 Router
  ['0x6bb4025dc157e4c68d6d23a0d1d2e3e08c29ebd6', 'sparkdex'],  // SPRK Token
  // Enosys
  ['0x4ca1326bc2776f5d2f5a2f77bf6c076ce7b7d8a1', 'enosys'],   // DEX Router
  ['0x9d3c4a2bb1e6bf45dbc3b1f2a1cd9e1b43c8a5d2', 'enosys'],   // CDP
  // Kinetic Market
  ['0x5bc2e3f7a2b1c93eda8a6df8b23e3f1c9d4a5b6c', 'kinetic'],  // Comptroller
  ['0xb348e39080fce8a97147adf16a5cbe43e85ae430', 'kinetic'],   // kFLR
  ['0xa30fa3d22d5e4e7b03b34060f3436d8e0a75a4b2', 'kinetic'],   // kUSDT
]);

/**
 * Event name patterns used in Layer 3 (Event Pattern Heuristic) as a
 * fallback when no protocol-specific classifier matches.
 */
const EVENT_PATTERN_MAP: ReadonlyArray<{
  pattern: RegExp;
  classify: (event: DecodedEvent) => ClassificationResult;
}> = [
  {
    pattern: /^Swap$/i,
    classify: (event) => ({
      ctType: 'Trade',
      buyAmount: stringOrNull(event.args['amountOut'] ?? event.args['amount1']),
      buyCurrency: stringOrNull(event.args['tokenOut'] ?? event.args['token1']),
      sellAmount: stringOrNull(event.args['amountIn'] ?? event.args['amount0']),
      sellCurrency: stringOrNull(event.args['tokenIn'] ?? event.args['token0']),
      fee: stringOrNull(event.args['fee']),
      feeCurrency: 'FLR',
      exchange: 'Unknown DEX',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'YELLOW' as AmpelStatus,
      isGraubereich: false,
      modelChoice: null,
      comment: 'Swap-Event erkannt (heuristisch) — vermutlich Trade gemaess §23 EStG. Manuelle Pruefung empfohlen.',
    }),
  },
  {
    pattern: /^(Mint|AddLiquidity|IncreaseLiquidity)$/i,
    classify: (event) => ({
      ctType: 'Add Liquidity',
      buyAmount: stringOrNull(event.args['liquidity']),
      buyCurrency: stringOrNull(event.args['lpToken'] ?? 'LP-Token'),
      sellAmount: stringOrNull(event.args['amount0'] ?? event.args['amount']),
      sellCurrency: stringOrNull(event.args['token0']),
      fee: null,
      feeCurrency: null,
      exchange: 'Unknown DEX',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'YELLOW' as AmpelStatus,
      isGraubereich: true,
      modelChoice: null,
      comment: 'LP-Bereitstellung erkannt (heuristisch) — Graubereich BMF 2025. Manuelle Pruefung empfohlen.',
    }),
  },
  {
    pattern: /^(Burn|RemoveLiquidity|DecreaseLiquidity)$/i,
    classify: (event) => ({
      ctType: 'Remove Liquidity',
      buyAmount: stringOrNull(event.args['amount0'] ?? event.args['amount']),
      buyCurrency: stringOrNull(event.args['token0']),
      sellAmount: stringOrNull(event.args['liquidity']),
      sellCurrency: stringOrNull(event.args['lpToken'] ?? 'LP-Token'),
      fee: null,
      feeCurrency: null,
      exchange: 'Unknown DEX',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'YELLOW' as AmpelStatus,
      isGraubereich: true,
      modelChoice: null,
      comment: 'LP-Entnahme erkannt (heuristisch) — Graubereich BMF 2025. Manuelle Pruefung empfohlen.',
    }),
  },
  {
    pattern: /^(RewardClaimed|RewardPaid|Harvest|Collect)$/i,
    classify: (event) => ({
      ctType: 'LP Rewards',
      buyAmount: stringOrNull(event.args['amount'] ?? event.args['reward']),
      buyCurrency: stringOrNull(event.args['token'] ?? event.args['rewardToken']),
      sellAmount: null,
      sellCurrency: null,
      fee: null,
      feeCurrency: null,
      exchange: 'Unknown',
      tradeGroup: 'Farming',
      ampelStatus: 'YELLOW' as AmpelStatus,
      isGraubereich: false,
      modelChoice: null,
      comment: 'Reward-Event erkannt (heuristisch) — vermutlich §22 Nr.3 EStG. Manuelle Pruefung empfohlen.',
    }),
  },
];

/**
 * Transaction Classification Engine.
 *
 * Implements a 5-layer classification pipeline:
 *   1. Protocol ABI Match — route to protocol-specific classifier
 *   2. Contract Address Match — identify protocol by known addresses
 *   3. Event Pattern Heuristic — classify by event name patterns
 *   4. ERC20 Fallback — detect simple token transfers
 *   5. Unknown — RED ampel, requires manual classification
 */
export class ClassificationEngine {
  /**
   * Classify a single decoded event through the 5-layer pipeline.
   *
   * @param event - The decoded on-chain event to classify.
   * @returns A ClassificationResult with tax classification and Ampel status.
   */
  classify(event: DecodedEvent): ClassificationResult {
    // -----------------------------------------------------------------
    // Layer 1: Protocol ABI Match
    // Route to the correct protocol-specific classifier based on
    // the event.protocol field (set by the event decoder).
    // -----------------------------------------------------------------
    const layer1Result = this.classifyByProtocol(event);
    if (layer1Result !== null) {
      return layer1Result;
    }

    // -----------------------------------------------------------------
    // Layer 2: Contract Address Match
    // If event.protocol is not set, look up the contract address in
    // the known-address registry and retry with protocol assigned.
    // -----------------------------------------------------------------
    const layer2Result = this.classifyByContractAddress(event);
    if (layer2Result !== null) {
      return layer2Result;
    }

    // -----------------------------------------------------------------
    // Layer 3: Event Pattern Heuristic
    // Match event name against common DeFi event patterns.
    // -----------------------------------------------------------------
    const layer3Result = this.classifyByEventPattern(event);
    if (layer3Result !== null) {
      return layer3Result;
    }

    // -----------------------------------------------------------------
    // Layer 4: ERC20 Fallback
    // Check if this is a simple ERC20 Transfer event.
    // -----------------------------------------------------------------
    const layer4Result = this.classifyErc20Fallback(event);
    if (layer4Result !== null) {
      return layer4Result;
    }

    // -----------------------------------------------------------------
    // Layer 5: Unknown
    // No classifier matched — return RED with manual review required.
    // -----------------------------------------------------------------
    return this.classifyUnknown(event);
  }

  /**
   * Classify a batch of decoded events.
   *
   * @param events - Array of decoded on-chain events.
   * @returns Array of ClassificationResults in the same order.
   */
  classifyBatch(events: DecodedEvent[]): ClassificationResult[] {
    return events.map((event) => this.classify(event));
  }

  // ===================================================================
  // Layer implementations (private)
  // ===================================================================

  /**
   * Layer 1: Protocol ABI Match.
   * Routes to protocol-specific classifiers based on event.protocol.
   */
  private classifyByProtocol(event: DecodedEvent): ClassificationResult | null {
    if (event.protocol === null) {
      return null;
    }

    const proto = event.protocol.toLowerCase();

    // Try SparkDEX
    if (proto.includes('sparkdex') || proto.includes('spark')) {
      return classifySparkDex(event);
    }

    // Try Enosys
    if (proto.includes('enosys') || proto.includes('ēnosys')) {
      return classifyEnosys(event);
    }

    // Try Kinetic Market
    if (proto.includes('kinetic')) {
      return classifyKinetic(event);
    }

    // Try Flare native (FTSO, FlareDrop, FAssets, etc.)
    if (
      proto.includes('flare') ||
      proto.includes('ftso') ||
      proto.includes('fasset') ||
      proto.includes('delegation') ||
      proto.includes('rflr')
    ) {
      return classifyFlareNative(event);
    }

    // Protocol specified but not recognized — try Flare native as fallback
    return classifyFlareNative(event);
  }

  /**
   * Layer 2: Contract Address Match.
   * Looks up the contract address in the known-address registry,
   * assigns the protocol, and re-routes to the appropriate classifier.
   */
  private classifyByContractAddress(event: DecodedEvent): ClassificationResult | null {
    const address = event.contractAddress.toLowerCase();
    const protocol = CONTRACT_TO_PROTOCOL.get(address);

    if (protocol === undefined) {
      return null;
    }

    // Create a copy with protocol assigned and re-classify via Layer 1
    const enrichedEvent: DecodedEvent = {
      ...event,
      protocol,
    };

    return this.classifyByProtocol(enrichedEvent);
  }

  /**
   * Layer 3: Event Pattern Heuristic.
   * Matches the event name against known DeFi event patterns.
   */
  private classifyByEventPattern(event: DecodedEvent): ClassificationResult | null {
    for (const entry of EVENT_PATTERN_MAP) {
      if (entry.pattern.test(event.eventName)) {
        return entry.classify(event);
      }
    }
    return null;
  }

  /**
   * Layer 4: ERC20 Fallback.
   * If the event is a Transfer (and not already handled), classify as
   * an internal transfer (GRAY, tax neutral).
   */
  private classifyErc20Fallback(event: DecodedEvent): ClassificationResult | null {
    if (event.eventName !== 'Transfer') {
      return null;
    }

    return {
      ctType: 'Transfer (intern)',
      buyAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
      buyCurrency: stringOrNull(event.args['token'] ?? event.args['symbol']),
      sellAmount: stringOrNull(event.args['value'] ?? event.args['amount']),
      sellCurrency: stringOrNull(event.args['token'] ?? event.args['symbol']),
      fee: null,
      feeCurrency: null,
      exchange: 'Unknown',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'GRAY',
      isGraubereich: false,
      modelChoice: null,
      comment:
        'ERC20 Transfer (Fallback) — als interner Transfer klassifiziert. ' +
        'Steuerlich neutral sofern Transfer zwischen eigenen Wallets. Manuelle Pruefung empfohlen.',
    };
  }

  /**
   * Layer 5: Unknown.
   * No classifier matched — returns RED ampel requiring manual classification.
   */
  private classifyUnknown(event: DecodedEvent): ClassificationResult {
    return {
      ctType: 'Other',
      buyAmount: null,
      buyCurrency: null,
      sellAmount: null,
      sellCurrency: null,
      fee: null,
      feeCurrency: null,
      exchange: event.protocol ?? 'Unknown',
      tradeGroup: 'DeFi-Flare',
      ampelStatus: 'RED',
      isGraubereich: false,
      modelChoice: null,
      comment:
        `Unbekanntes Event "${event.eventName}" auf Vertrag ${event.contractAddress} — ` +
        'konnte nicht automatisch klassifiziert werden. Manuelle Klassifizierung erforderlich.',
    };
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
