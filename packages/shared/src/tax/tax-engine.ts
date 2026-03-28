// ---------------------------------------------------------------------------
// @defi-tracker/shared — Tax Calculation Engine (Orchestrator)
// Main entry point for German BMF 2025 compliant tax calculations.
//
// @spec EP-08 — Tax calculation engine orchestrator
// @spec US-006 — Portfolio P&L and tax positions
// ---------------------------------------------------------------------------

import type {
  TaxMethod,
  TaxLot,
  Disposal,
  TaxGainLossResult,
  FreigrenzeStatus,
  HaltefristEntry,
} from './types';
import { LotMatcher } from './lot-matcher';
import { calculateFreigrenze } from './freigrenze';
import { calculateHaltefrist } from './haltefrist';

/** Precision for all monetary string arithmetic (10 decimal places) */
const PRECISION = 10;

/**
 * Converts a number to a fixed-precision decimal string.
 * @param value - Numeric value
 * @returns Fixed-precision string
 */
function toStr(value: number): string {
  return value.toFixed(PRECISION);
}

/**
 * Generates a simple unique ID for tax events.
 */
function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `evt_${ts}_${rand}`;
}

/**
 * Tax Calculation Engine — orchestrates FIFO/LIFO lot matching,
 * Freigrenze monitoring, and Haltefrist tracking.
 *
 * This is a pure, stateful calculator with no side effects or database dependencies.
 * It maintains an in-memory collection of tax lots and computed events.
 *
 * Usage:
 * ```typescript
 * const engine = new TaxEngine('FIFO');
 * engine.addLot(myLot);
 * const results = engine.processDisposal(myDisposal);
 * const freigrenze = engine.getFreigrenzeStatus(2025);
 * ```
 *
 * @see Section 23 EStG — Private Veraeusserungsgeschaefte
 * @see Section 22 Nr. 3 EStG — Sonstige Einkuenfte
 * @see BMF-Schreiben 2025 — Crypto tax guidance
 */
export class TaxEngine {
  /** The lot matching method used by this engine instance */
  private readonly lotMatcher: LotMatcher;

  /** Tax lots indexed by token symbol for efficient lookup */
  private readonly lots: Map<string, TaxLot[]>;

  /** All computed tax gain/loss events */
  private readonly taxEvents: TaxGainLossResult[];

  /** Staking/LP/lending rewards tracked separately for Freigrenze */
  private readonly stakingRewards: Map<number, number[]>;

  /**
   * Creates a new TaxEngine instance.
   * @param method - Tax lot matching method (default: 'FIFO')
   */
  constructor(method: TaxMethod = 'FIFO') {
    this.lotMatcher = new LotMatcher(method);
    this.lots = new Map();
    this.taxEvents = [];
    this.stakingRewards = new Map();
  }

  /**
   * Adds a tax lot to the engine's internal tracking.
   * Lots are indexed by token symbol for efficient disposal matching.
   *
   * @param lot - The tax lot to add
   */
  addLot(lot: TaxLot): void {
    const existing = this.lots.get(lot.tokenSymbol);
    if (existing) {
      existing.push(lot);
    } else {
      this.lots.set(lot.tokenSymbol, [lot]);
    }
  }

  /**
   * Processes a token disposal (sale, trade, spend) against tracked lots.
   *
   * Uses the configured FIFO/LIFO method to match the disposal against
   * existing lots, computing gain/loss for each lot consumed. Results
   * are stored internally and also returned.
   *
   * @param disposal - The disposal event to process
   * @returns Array of gain/loss results, one per lot consumed
   * @throws Error if no lots exist for the disposed token
   * @throws Error if insufficient lot balance to cover the disposal
   *
   * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — Private disposal gains
   */
  processDisposal(disposal: Disposal): TaxGainLossResult[] {
    const tokenLots = this.lots.get(disposal.tokenSymbol);
    if (!tokenLots || tokenLots.length === 0) {
      throw new Error(
        `No lots found for token ${disposal.tokenSymbol}. ` +
          `Add acquisition lots before processing disposals.`
      );
    }

    const results = this.lotMatcher.matchDisposal(tokenLots, disposal);
    this.taxEvents.push(...results);
    return results;
  }

  /**
   * Processes a staking reward as a Section 22 Nr. 3 EStG income event.
   *
   * Staking rewards are taxable as "sonstige Einkuenfte" at the time of claim.
   * The EUR value at the time of receipt is the taxable income amount.
   * Additionally, creates a new tax lot for the received tokens (acquisition at market value).
   *
   * @param tokenSymbol - Token ticker symbol of the reward
   * @param amountEur - EUR value of the reward at time of receipt
   * @param claimDate - Date/time the reward was claimed
   * @param taxYear - Calendar year for Freigrenze calculation
   * @returns TaxGainLossResult for the income event
   *
   * @see Section 22 Nr. 3 EStG — Sonstige Einkuenfte from staking
   */
  processStakingReward(
    tokenSymbol: string,
    amountEur: string,
    claimDate: Date,
    taxYear: number
  ): TaxGainLossResult {
    const eurValue = parseFloat(amountEur);

    // Track reward for Freigrenze calculation
    const yearRewards = this.stakingRewards.get(taxYear);
    if (yearRewards) {
      yearRewards.push(eurValue);
    } else {
      this.stakingRewards.set(taxYear, [eurValue]);
    }

    const result: TaxGainLossResult = {
      eventType: 'PARAGRAPH_22_NR3',
      gainLossEur: toStr(eurValue),
      holdingPeriodDays: 0,
      isTaxFree: false,
      taxYear,
      lotId: generateEventId(),
      disposalAmount: toStr(0),
      acquisitionCostEur: toStr(0),
      disposalProceedsEur: amountEur,
    };

    this.taxEvents.push(result);
    return result;
  }

  /**
   * Processes a liquidity pool (LP) reward as a Section 22 Nr. 3 EStG income event.
   *
   * LP rewards follow the same tax treatment as staking rewards —
   * taxable as "sonstige Einkuenfte" at the EUR value upon receipt.
   *
   * @param tokenSymbol - Token ticker symbol of the reward
   * @param amountEur - EUR value of the reward at time of receipt
   * @param claimDate - Date/time the reward was claimed
   * @param taxYear - Calendar year for Freigrenze calculation
   * @returns TaxGainLossResult for the income event
   *
   * @see Section 22 Nr. 3 EStG — Sonstige Einkuenfte from LP rewards
   */
  processLPReward(
    tokenSymbol: string,
    amountEur: string,
    claimDate: Date,
    taxYear: number
  ): TaxGainLossResult {
    // LP rewards have identical tax treatment to staking rewards under Section 22 Nr. 3
    return this.processStakingReward(tokenSymbol, amountEur, claimDate, taxYear);
  }

  /**
   * Returns the current Freigrenze (exemption limit) status for a given tax year.
   *
   * Aggregates all tracked tax events and staking rewards to compute
   * the status of both exemption limits.
   *
   * @param taxYear - Calendar year to evaluate
   * @returns FreigrenzeStatus with paragraph 23 and 22 Nr. 3 thresholds
   *
   * @see Section 23 Abs. 3 S. 5 EStG — EUR 1,000 Freigrenze
   * @see Section 22 Nr. 3 S. 2 EStG — EUR 256 Freigrenze
   */
  getFreigrenzeStatus(taxYear: number): FreigrenzeStatus {
    const yearRewards = this.stakingRewards.get(taxYear) ?? [];
    return calculateFreigrenze(this.taxEvents, yearRewards, taxYear);
  }

  /**
   * Returns the Haltefrist (holding period) status for all open/partial lots.
   *
   * @param referenceDate - Date to calculate from (defaults to current date/time)
   * @returns Array of HaltefristEntry sorted by daysRemaining ascending
   *
   * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — 365-day holding period
   */
  getHaltefrist(referenceDate?: Date): HaltefristEntry[] {
    const allLots: TaxLot[] = [];
    for (const tokenLots of this.lots.values()) {
      allLots.push(...tokenLots);
    }
    return calculateHaltefrist(allLots, referenceDate);
  }

  /**
   * Returns all computed tax events across all tokens and tax years.
   *
   * @returns Array of all TaxGainLossResult events
   */
  getAllTaxEvents(): TaxGainLossResult[] {
    return [...this.taxEvents];
  }

  /**
   * Returns a summary of the current portfolio state.
   *
   * @returns Portfolio summary with total gains, losses, rewards, and open lot count
   */
  getPortfolioSummary(): {
    totalGainsEur: string;
    totalLossesEur: string;
    totalRewardsEur: string;
    openLots: number;
  } {
    let totalGains = 0;
    let totalLosses = 0;
    let totalRewards = 0;

    for (const event of this.taxEvents) {
      const value = parseFloat(event.gainLossEur);

      if (event.eventType === 'PARAGRAPH_22_NR3') {
        totalRewards += value;
      } else if (value >= 0) {
        totalGains += value;
      } else {
        totalLosses += Math.abs(value);
      }
    }

    let openLots = 0;
    for (const tokenLots of this.lots.values()) {
      for (const lot of tokenLots) {
        if (lot.status === 'OPEN' || lot.status === 'PARTIAL') {
          openLots++;
        }
      }
    }

    return {
      totalGainsEur: toStr(totalGains),
      totalLossesEur: toStr(totalLosses),
      totalRewardsEur: toStr(totalRewards),
      openLots,
    };
  }
}
