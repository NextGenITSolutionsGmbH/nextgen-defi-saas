// ---------------------------------------------------------------------------
// @defi-tracker/shared — Haltefrist (Holding Period) Tracker
// Tracks the 365-day holding period per Section 23 Abs. 1 S. 1 Nr. 2 EStG.
// ---------------------------------------------------------------------------

import type { TaxLot, HaltefristEntry } from './types';

/** Number of milliseconds in one day */
const MS_PER_DAY = 86_400_000;

/** Holding period threshold in days per Section 23 EStG */
const HOLDING_PERIOD_DAYS = 365;

/**
 * Adds a specified number of days to a date.
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date with days added
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculates the number of whole days between two dates.
 * Returns 0 if the result would be negative.
 * @param from - Start date
 * @param to - End date
 * @returns Number of whole days (>= 0)
 */
function daysBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(diffMs / MS_PER_DAY));
}

/**
 * Calculates the Haltefrist (holding period) status for all open/partial tax lots.
 *
 * For each lot that is not fully closed, computes:
 * - The date on which the lot becomes tax-free (acquisitionDate + 365 days)
 * - Days remaining until that date
 * - Whether the holding period has already expired (lot is now tax-free)
 *
 * Results are sorted by daysRemaining ascending (closest to expiry first),
 * making it easy to show users which positions will become tax-free soonest.
 *
 * @param lots - Array of tax lots to evaluate
 * @param referenceDate - Date to calculate from (defaults to current date/time)
 * @returns Array of HaltefristEntry sorted by daysRemaining ascending
 *
 * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — 365-day holding period
 */
export function calculateHaltefrist(
  lots: TaxLot[],
  referenceDate?: Date
): HaltefristEntry[] {
  const refDate = referenceDate ?? new Date();

  const entries: HaltefristEntry[] = [];

  for (const lot of lots) {
    // Only consider lots that still have a remaining balance
    if (lot.status === 'CLOSED') continue;
    if (parseFloat(lot.remainingAmount) <= 0) continue;

    // The date on which this lot becomes tax-free
    const taxFreeDate = addDays(lot.acquisitionDate, HOLDING_PERIOD_DAYS);

    // Days remaining until tax-free (0 if already expired)
    const daysRemaining = refDate >= taxFreeDate
      ? 0
      : daysBetween(refDate, taxFreeDate);

    // Whether the holding period has completed
    const isExpired = refDate >= taxFreeDate;

    // Calculate EUR value at acquisition (proportional to remaining amount)
    const totalAmount = parseFloat(lot.amount);
    const remainingAmount = parseFloat(lot.remainingAmount);
    const totalCostEur = parseFloat(lot.acquisitionCostEur);
    const eurValueAtAcquisition =
      totalAmount > 0
        ? (remainingAmount / totalAmount) * totalCostEur
        : 0;

    entries.push({
      lotId: lot.id,
      tokenSymbol: lot.tokenSymbol,
      amount: lot.remainingAmount,
      acquisitionDate: lot.acquisitionDate,
      taxFreeDate,
      daysRemaining,
      isExpired,
      eurValueAtAcquisition: eurValueAtAcquisition.toFixed(10),
    });
  }

  // Sort by daysRemaining ascending (closest to expiry first)
  entries.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return entries;
}

/**
 * Filters tax lots to those that will become tax-free within a specified number of days.
 *
 * Useful for dashboard widgets like "Upcoming Tax-Free Assets" that alert users
 * when their holdings are about to pass the 365-day Haltefrist threshold.
 *
 * Only includes lots that are NOT yet expired but WILL expire within the window.
 *
 * @param lots - Array of tax lots to evaluate
 * @param withinDays - Number of days to look ahead (default: 30)
 * @param referenceDate - Date to calculate from (defaults to current date/time)
 * @returns Array of HaltefristEntry for lots becoming tax-free within the window
 *
 * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — 365-day holding period
 */
export function getUpcomingTaxFreeAssets(
  lots: TaxLot[],
  withinDays: number = 30,
  referenceDate?: Date
): HaltefristEntry[] {
  const allEntries = calculateHaltefrist(lots, referenceDate);

  // Filter to entries that are not yet expired but will expire within the window
  return allEntries.filter(
    (entry) => !entry.isExpired && entry.daysRemaining <= withinDays
  );
}
