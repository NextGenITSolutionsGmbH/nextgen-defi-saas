// ---------------------------------------------------------------------------
// @defi-tracker/shared — FIFO/LIFO Lot Matching Engine
// Matches disposals against tax lots per BMF 2025 guidelines.
//
// @spec EP-08 — FIFO/LIFO lot matching per BMF 2025
// ---------------------------------------------------------------------------

import type { TaxLot, TaxMethod, Disposal, TaxGainLossResult } from './types';

/** Precision for all monetary string arithmetic (10 decimal places) */
const PRECISION = 10;

/**
 * Converts a decimal string to a number for arithmetic.
 * @param value - Decimal string representation
 * @returns Parsed float value
 */
function toNum(value: string): number {
  return parseFloat(value);
}

/**
 * Converts a number back to a fixed-precision decimal string.
 * @param value - Numeric value
 * @returns Fixed-precision string (10 decimal places)
 */
function toStr(value: number): string {
  return value.toFixed(PRECISION);
}

/**
 * Calculates the number of whole days between two dates.
 * @param from - Start date (acquisition)
 * @param to - End date (disposal)
 * @returns Number of whole days
 */
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / msPerDay);
}

/**
 * Generates a simple unique ID for tax lots.
 * Uses timestamp + random component for uniqueness.
 */
function generateLotId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `lot_${ts}_${rand}`;
}

/**
 * FIFO/LIFO Lot Matcher for German tax calculation.
 *
 * Matches token disposals against existing tax lots using either
 * First-In-First-Out (FIFO) or Last-In-First-Out (LIFO) methodology.
 *
 * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — Private Veraeusserungsgeschaefte
 * @see BMF-Schreiben 2025 — Lot matching methodology
 */
export class LotMatcher {
  private readonly method: TaxMethod;

  /**
   * Creates a new LotMatcher instance.
   * @param method - Tax lot matching method ('FIFO' or 'LIFO')
   */
  constructor(method: TaxMethod) {
    this.method = method;
  }

  /**
   * Matches a disposal against available tax lots and computes gain/loss results.
   *
   * For FIFO: lots are sorted by acquisitionDate ascending (oldest consumed first).
   * For LIFO: lots are sorted by acquisitionDate descending (newest consumed first).
   *
   * Each lot consumed generates a separate TaxGainLossResult. If a disposal spans
   * multiple lots, multiple results are returned. Partial lot consumption is handled
   * by reducing the lot's remainingAmount.
   *
   * @param lots - Array of tax lots for the token being disposed (mutated in place)
   * @param disposal - The disposal event to match
   * @returns Array of gain/loss results, one per lot consumed
   * @throws Error if insufficient lots to cover the disposal amount
   *
   * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — 365-day holding period for tax exemption
   */
  matchDisposal(lots: TaxLot[], disposal: Disposal): TaxGainLossResult[] {
    // Filter to lots for the correct token with remaining balance
    const availableLots = lots.filter(
      (lot) =>
        lot.tokenSymbol === disposal.tokenSymbol &&
        (lot.status === 'OPEN' || lot.status === 'PARTIAL') &&
        toNum(lot.remainingAmount) > 0
    );

    // Sort by acquisition date per method
    if (this.method === 'FIFO') {
      availableLots.sort(
        (a, b) => a.acquisitionDate.getTime() - b.acquisitionDate.getTime()
      );
    } else {
      // LIFO: newest first
      availableLots.sort(
        (a, b) => b.acquisitionDate.getTime() - a.acquisitionDate.getTime()
      );
    }

    let remainingDisposal = toNum(disposal.amount);
    const totalDisposalAmount = toNum(disposal.amount);
    const totalDisposalProceeds = toNum(disposal.disposalProceedsEur);
    const results: TaxGainLossResult[] = [];

    for (const lot of availableLots) {
      if (remainingDisposal <= 0) break;

      const lotRemaining = toNum(lot.remainingAmount);
      const lotTotalAmount = toNum(lot.amount);
      const lotTotalCost = toNum(lot.acquisitionCostEur);

      // How much we consume from this lot
      const consumedAmount = Math.min(lotRemaining, remainingDisposal);

      // Proportional acquisition cost: (consumedAmount / lotTotalAmount) * lotTotalCost
      const proportionalCost = (consumedAmount / lotTotalAmount) * lotTotalCost;

      // Proportional disposal proceeds: (consumedAmount / totalDisposalAmount) * totalDisposalProceeds
      const proportionalProceeds =
        (consumedAmount / totalDisposalAmount) * totalDisposalProceeds;

      // Holding period in days
      const holdingDays = daysBetween(lot.acquisitionDate, disposal.disposalDate);

      // Tax-free if holding period > 365 days per Section 23 Abs. 1 S. 1 Nr. 2 EStG
      const isTaxFree = holdingDays > 365;

      // Gain/loss = disposal proceeds - acquisition cost (for this proportion)
      const gainLoss = proportionalProceeds - proportionalCost;

      // Update the lot's remaining amount
      const newRemaining = lotRemaining - consumedAmount;
      lot.remainingAmount = toStr(newRemaining);

      // Update lot status
      if (newRemaining <= 0) {
        lot.status = 'CLOSED';
        lot.disposalDate = disposal.disposalDate;
        // Ensure no floating point dust
        lot.remainingAmount = toStr(0);
      } else {
        lot.status = 'PARTIAL';
      }

      results.push({
        eventType: 'PARAGRAPH_23',
        gainLossEur: toStr(gainLoss),
        holdingPeriodDays: holdingDays,
        isTaxFree,
        taxYear: disposal.disposalDate.getFullYear(),
        lotId: lot.id,
        disposalAmount: toStr(consumedAmount),
        acquisitionCostEur: toStr(proportionalCost),
        disposalProceedsEur: toStr(proportionalProceeds),
      });

      remainingDisposal -= consumedAmount;
    }

    // Check if we fully covered the disposal
    if (remainingDisposal > 1e-8) {
      throw new Error(
        `Insufficient lots for disposal of ${disposal.amount} ${disposal.tokenSymbol}. ` +
          `Remaining unmatched: ${toStr(remainingDisposal)} ${disposal.tokenSymbol}. ` +
          `Ensure all acquisitions are tracked before processing disposals.`
      );
    }

    return results;
  }

  /**
   * Creates a new tax lot for a token acquisition.
   *
   * @param tokenSymbol - Token ticker symbol (e.g. 'FLR')
   * @param tokenAddress - On-chain contract address
   * @param amount - Acquired amount as decimal string
   * @param acquisitionCostEur - Total acquisition cost in EUR as decimal string
   * @param acquisitionDate - Date/time of the acquisition
   * @param method - Lot matching method to tag the lot with
   * @returns A new TaxLot instance with status 'OPEN'
   */
  createLot(
    tokenSymbol: string,
    tokenAddress: string,
    amount: string,
    acquisitionCostEur: string,
    acquisitionDate: Date,
    method: TaxMethod
  ): TaxLot {
    return {
      id: generateLotId(),
      tokenSymbol,
      tokenAddress,
      amount,
      acquisitionCostEur,
      acquisitionDate,
      remainingAmount: amount,
      method,
      disposalDate: null,
      status: 'OPEN',
    };
  }
}
