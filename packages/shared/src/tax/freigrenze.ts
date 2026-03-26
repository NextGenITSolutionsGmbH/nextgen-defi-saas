// ---------------------------------------------------------------------------
// @defi-tracker/shared — Freigrenze (Exemption Limit) Monitor
// Monitors German BMF 2025 tax exemption thresholds.
// ---------------------------------------------------------------------------

import type { TaxGainLossResult, FreigrenzeStatus } from './types';

/**
 * Calculates the Freigrenze (exemption limit) status for a given tax year.
 *
 * CRITICAL DISTINCTION — Freigrenze vs. Freibetrag:
 * These are Freigrenzen (exemption LIMITS), NOT Freibetraege (allowances).
 * - Freibetrag: Only the amount exceeding the limit is taxed.
 * - Freigrenze: If the limit is exceeded, the ENTIRE amount is taxed.
 *
 * Section 23 Abs. 3 S. 5 EStG — EUR 1,000 Freigrenze:
 *   - Applies to gains from private disposal of crypto assets (Veraeusserungsgeschaefte)
 *   - Only taxable events count (holding period <= 365 days)
 *   - Losses can be offset against gains
 *   - If net gain <= EUR 1,000: entire gain is tax-free
 *   - If net gain > EUR 1,000: ALL gains are taxable (not just the excess!)
 *
 * Section 22 Nr. 3 S. 2 EStG — EUR 256 Freigrenze:
 *   - Applies to staking rewards, LP rewards, lending income
 *   - No loss offsetting from Section 23 events
 *   - If total income <= EUR 256: entire income is tax-free
 *   - If total income > EUR 256: ALL income is taxable (not just the excess!)
 *
 * @param taxEvents - All computed tax gain/loss events
 * @param stakingRewardsEur - Array of staking/LP/lending reward amounts in EUR
 * @param taxYear - Calendar year to calculate for
 * @returns FreigrenzeStatus with both paragraph thresholds
 */
export function calculateFreigrenze(
  taxEvents: TaxGainLossResult[],
  stakingRewardsEur: number[],
  taxYear: number
): FreigrenzeStatus {
  // -------------------------------------------------------------------------
  // Section 23 EStG — Private Veraeusserungsgeschaefte
  // -------------------------------------------------------------------------

  // Filter to Section 23 events for the given tax year that are NOT tax-free
  // (only taxable events with holding period <= 365 days count)
  const paragraph23Events = taxEvents.filter(
    (e) =>
      e.eventType === 'PARAGRAPH_23' &&
      e.taxYear === taxYear &&
      !e.isTaxFree
  );

  let totalGainsEur = 0;
  let totalLossesEur = 0;

  for (const event of paragraph23Events) {
    const gainLoss = parseFloat(event.gainLossEur);
    if (gainLoss >= 0) {
      totalGainsEur += gainLoss;
    } else {
      // Losses are tracked as positive numbers in totalLossesEur
      totalLossesEur += Math.abs(gainLoss);
    }
  }

  const netGainEur = totalGainsEur - totalLossesEur;
  const p23Limit = 1000 as const;
  const p23IsExceeded = netGainEur > p23Limit;
  const p23Remaining = Math.max(0, p23Limit - netGainEur);

  // Ampel (traffic light) thresholds for Section 23
  let p23Ampel: 'GREEN' | 'YELLOW' | 'RED';
  if (netGainEur > p23Limit) {
    p23Ampel = 'RED';
  } else if (netGainEur >= 800) {
    p23Ampel = 'YELLOW';
  } else {
    p23Ampel = 'GREEN';
  }

  // -------------------------------------------------------------------------
  // Section 22 Nr. 3 EStG — Sonstige Einkuenfte (staking, LP, lending)
  // -------------------------------------------------------------------------

  // Sum PARAGRAPH_22_NR3 events from taxEvents for this year
  const paragraph22Events = taxEvents.filter(
    (e) => e.eventType === 'PARAGRAPH_22_NR3' && e.taxYear === taxYear
  );

  let totalIncomeEur = 0;
  for (const event of paragraph22Events) {
    totalIncomeEur += parseFloat(event.gainLossEur);
  }

  // Also add any staking rewards passed separately
  for (const reward of stakingRewardsEur) {
    totalIncomeEur += reward;
  }

  const p22Limit = 256 as const;
  const p22IsExceeded = totalIncomeEur > p22Limit;
  const p22Remaining = Math.max(0, p22Limit - totalIncomeEur);

  // Ampel (traffic light) thresholds for Section 22 Nr. 3
  let p22Ampel: 'GREEN' | 'YELLOW' | 'RED';
  if (totalIncomeEur > p22Limit) {
    p22Ampel = 'RED';
  } else if (totalIncomeEur >= 200) {
    p22Ampel = 'YELLOW';
  } else {
    p22Ampel = 'GREEN';
  }

  return {
    paragraph23: {
      totalGainsEur,
      totalLossesEur,
      netGainEur,
      limit: 1000,
      remaining: p23Remaining,
      isExceeded: p23IsExceeded,
      ampel: p23Ampel,
    },
    paragraph22Nr3: {
      totalIncomeEur,
      limit: 256,
      remaining: p22Remaining,
      isExceeded: p22IsExceeded,
      ampel: p22Ampel,
    },
  };
}
