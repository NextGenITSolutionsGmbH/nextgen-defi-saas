import { describe, it, expect } from 'vitest';
import {
  calculateFreigrenze,
  PARAGRAPH_23_THRESHOLD,
  PARAGRAPH_22_NR3_THRESHOLD,
} from '../freigrenze';
import type { TaxEvent } from '../../types/tax';

describe('calculateFreigrenze', () => {
  // ─── § 23 EStG TESTS ───

  it('should return GREEN when gains are well below §23 threshold (€1000)', () => {
    const events: TaxEvent[] = [
      { gainLossEur: 200, isTaxFree: false },
      { gainLossEur: 100, isTaxFree: false },
    ];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.netGainsEur).toBe(300);
    expect(result.paragraph23.status).toBe('GREEN');
    expect(result.paragraph23.allTaxable).toBe(false);
    expect(result.paragraph23.thresholdEur).toBe(PARAGRAPH_23_THRESHOLD);
  });

  it('should return YELLOW when approaching §23 threshold (80%-100%)', () => {
    // 80% of 1000 = 800 → YELLOW starts at 800
    const events: TaxEvent[] = [{ gainLossEur: 850, isTaxFree: false }];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.netGainsEur).toBe(850);
    expect(result.paragraph23.status).toBe('YELLOW');
    expect(result.paragraph23.allTaxable).toBe(false);
  });

  it('should return YELLOW at exactly 80% of threshold', () => {
    const events: TaxEvent[] = [{ gainLossEur: 800, isTaxFree: false }];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.status).toBe('YELLOW');
    expect(result.paragraph23.allTaxable).toBe(false);
  });

  it('should return YELLOW at exactly the threshold (€1000)', () => {
    // At exactly €1000, gains do NOT exceed the threshold → not allTaxable
    // But status is YELLOW because it is >= 80%
    const events: TaxEvent[] = [{ gainLossEur: 1000, isTaxFree: false }];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.netGainsEur).toBe(1000);
    expect(result.paragraph23.status).toBe('YELLOW');
    expect(result.paragraph23.allTaxable).toBe(false);
  });

  it('should return RED when §23 threshold exceeded', () => {
    const events: TaxEvent[] = [{ gainLossEur: 1001, isTaxFree: false }];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.netGainsEur).toBe(1001);
    expect(result.paragraph23.status).toBe('RED');
    expect(result.paragraph23.allTaxable).toBe(true);
  });

  it('should apply Freigrenze all-or-nothing rule for §23', () => {
    // When gains = €1001, ALL €1001 is taxable (not just the €1 over threshold)
    // This is the key difference between Freigrenze and Freibetrag
    const events: TaxEvent[] = [{ gainLossEur: 1001, isTaxFree: false }];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.allTaxable).toBe(true);
    // The full amount is taxable
    expect(result.paragraph23.netGainsEur).toBe(1001);
  });

  it('should correctly compute net gains — losses offset gains for §23', () => {
    // Gain of €1500 + Loss of €600 = net €900 → below threshold → GREEN
    const events: TaxEvent[] = [
      { gainLossEur: 1500, isTaxFree: false },
      { gainLossEur: -600, isTaxFree: false },
    ];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.netGainsEur).toBe(900);
    expect(result.paragraph23.status).toBe('YELLOW');
    expect(result.paragraph23.allTaxable).toBe(false);
  });

  it('should treat net losses as zero for Freigrenze calculation', () => {
    // More losses than gains → net is negative → treated as 0
    const events: TaxEvent[] = [
      { gainLossEur: 200, isTaxFree: false },
      { gainLossEur: -500, isTaxFree: false },
    ];
    const result = calculateFreigrenze(events, 0);

    expect(result.paragraph23.netGainsEur).toBe(0);
    expect(result.paragraph23.status).toBe('GREEN');
    expect(result.paragraph23.allTaxable).toBe(false);
  });

  it('should exclude tax-free events from §23 net gains', () => {
    // €2000 gain that is tax-free (held > 365 days) + €500 taxable gain
    const events: TaxEvent[] = [
      { gainLossEur: 2000, isTaxFree: true },
      { gainLossEur: 500, isTaxFree: false },
    ];
    const result = calculateFreigrenze(events, 0);

    // Only the €500 taxable gain counts
    expect(result.paragraph23.netGainsEur).toBe(500);
    expect(result.paragraph23.status).toBe('GREEN');
  });

  // ─── § 22 Nr. 3 EStG TESTS ───

  it('should return GREEN for §22 Nr. 3 when rewards below €256', () => {
    const result = calculateFreigrenze([], 100);

    expect(result.paragraph22Nr3.totalRewardsEur).toBe(100);
    expect(result.paragraph22Nr3.status).toBe('GREEN');
    expect(result.paragraph22Nr3.allTaxable).toBe(false);
    expect(result.paragraph22Nr3.thresholdEur).toBe(PARAGRAPH_22_NR3_THRESHOLD);
  });

  it('should return YELLOW for §22 Nr. 3 when approaching threshold', () => {
    // 80% of 256 = 204.80
    const result = calculateFreigrenze([], 210);

    expect(result.paragraph22Nr3.status).toBe('YELLOW');
    expect(result.paragraph22Nr3.allTaxable).toBe(false);
  });

  it('should return RED for §22 Nr. 3 when threshold exceeded', () => {
    const result = calculateFreigrenze([], 257);

    expect(result.paragraph22Nr3.totalRewardsEur).toBe(257);
    expect(result.paragraph22Nr3.status).toBe('RED');
    expect(result.paragraph22Nr3.allTaxable).toBe(true);
  });

  it('should apply all-or-nothing rule for §22 Nr. 3', () => {
    // At €257, ALL €257 is taxable
    const result = calculateFreigrenze([], 257);

    expect(result.paragraph22Nr3.allTaxable).toBe(true);
    expect(result.paragraph22Nr3.totalRewardsEur).toBe(257);
  });

  it('should NOT offset losses for §22 Nr. 3', () => {
    // §22 Nr. 3 only counts positive income — no loss offsetting
    // Even if stakingRewardsEur is negative (unlikely but defensive), treat as 0
    const result = calculateFreigrenze([], -50);

    expect(result.paragraph22Nr3.totalRewardsEur).toBe(0);
    expect(result.paragraph22Nr3.status).toBe('GREEN');
  });

  // ─── COMBINED SCENARIOS ───

  it('should calculate both paragraphs independently', () => {
    const events: TaxEvent[] = [{ gainLossEur: 1500, isTaxFree: false }];
    const result = calculateFreigrenze(events, 300);

    // §23: €1500 > €1000 → RED
    expect(result.paragraph23.status).toBe('RED');
    expect(result.paragraph23.allTaxable).toBe(true);

    // §22 Nr. 3: €300 > €256 → RED
    expect(result.paragraph22Nr3.status).toBe('RED');
    expect(result.paragraph22Nr3.allTaxable).toBe(true);
  });

  it('should handle empty tax events', () => {
    const result = calculateFreigrenze([], 0);

    expect(result.paragraph23.netGainsEur).toBe(0);
    expect(result.paragraph23.status).toBe('GREEN');
    expect(result.paragraph22Nr3.totalRewardsEur).toBe(0);
    expect(result.paragraph22Nr3.status).toBe('GREEN');
  });
});
