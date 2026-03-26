import { describe, it, expect } from 'vitest';
import { calculateFreigrenze } from '../freigrenze';
import type { TaxGainLossResult } from '../types';

/**
 * Helper to create a TaxGainLossResult for testing.
 * By default: PARAGRAPH_23, taxYear 2025, not tax-free.
 */
function makeEvent(overrides: Partial<TaxGainLossResult> = {}): TaxGainLossResult {
  return {
    eventType: 'PARAGRAPH_23',
    gainLossEur: '0.0000000000',
    holdingPeriodDays: 100,
    isTaxFree: false,
    taxYear: 2025,
    lotId: 'lot-1',
    disposalAmount: '100.0000000000',
    acquisitionCostEur: '1.0000000000',
    disposalProceedsEur: '1.0000000000',
    ...overrides,
  };
}

describe('calculateFreigrenze', () => {
  // ---- Section 23 EStG TESTS ----

  it('should return GREEN when gains are well below threshold (EUR 1000)', () => {
    const events: TaxGainLossResult[] = [
      makeEvent({ gainLossEur: '200' }),
      makeEvent({ gainLossEur: '100' }),
    ];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.totalGainsEur).toBeCloseTo(300, 2);
    expect(result.paragraph23.netGainEur).toBeCloseTo(300, 2);
    expect(result.paragraph23.ampel).toBe('GREEN');
    expect(result.paragraph23.isExceeded).toBe(false);
    expect(result.paragraph23.limit).toBe(1000);
  });

  it('should return YELLOW when approaching threshold (80%-100%)', () => {
    // 80% of 1000 = 800 -> YELLOW starts at 800
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '850' })];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.netGainEur).toBeCloseTo(850, 2);
    expect(result.paragraph23.ampel).toBe('YELLOW');
    expect(result.paragraph23.isExceeded).toBe(false);
  });

  it('should return YELLOW at exactly 80% of threshold', () => {
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '800' })];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.ampel).toBe('YELLOW');
    expect(result.paragraph23.isExceeded).toBe(false);
  });

  it('should return YELLOW at exactly the threshold (EUR 1000)', () => {
    // At exactly EUR 1000, gains do NOT exceed the threshold -> not exceeded
    // But ampel is YELLOW because >= 800
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '1000' })];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.netGainEur).toBeCloseTo(1000, 2);
    expect(result.paragraph23.ampel).toBe('YELLOW');
    expect(result.paragraph23.isExceeded).toBe(false);
  });

  it('should return RED when threshold exceeded', () => {
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '1001' })];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.netGainEur).toBeCloseTo(1001, 2);
    expect(result.paragraph23.ampel).toBe('RED');
    expect(result.paragraph23.isExceeded).toBe(true);
  });

  it('should apply Freigrenze all-or-nothing rule for Section 23', () => {
    // When gains = EUR 1001, ALL EUR 1001 is taxable (not just the EUR 1 over threshold)
    // This is the key difference between Freigrenze and Freibetrag
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '1001' })];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.isExceeded).toBe(true);
    // The full amount is taxable
    expect(result.paragraph23.netGainEur).toBeCloseTo(1001, 2);
  });

  it('should correctly compute net gains -- losses offset gains for Section 23', () => {
    // Gain of EUR 1500 + Loss of EUR -600 = net EUR 900 -> below threshold
    const events: TaxGainLossResult[] = [
      makeEvent({ gainLossEur: '1500' }),
      makeEvent({ gainLossEur: '-600' }),
    ];
    const result = calculateFreigrenze(events, [], 2025);

    expect(result.paragraph23.netGainEur).toBeCloseTo(900, 2);
    expect(result.paragraph23.ampel).toBe('YELLOW');
    expect(result.paragraph23.isExceeded).toBe(false);
  });

  it('should exclude tax-free events from Section 23 net gains', () => {
    // EUR 2000 gain that is tax-free (held > 365 days) + EUR 500 taxable gain
    const events: TaxGainLossResult[] = [
      makeEvent({ gainLossEur: '2000', isTaxFree: true }),
      makeEvent({ gainLossEur: '500', isTaxFree: false }),
    ];
    const result = calculateFreigrenze(events, [], 2025);

    // Only the EUR 500 taxable gain counts
    expect(result.paragraph23.totalGainsEur).toBeCloseTo(500, 2);
    expect(result.paragraph23.netGainEur).toBeCloseTo(500, 2);
    expect(result.paragraph23.ampel).toBe('GREEN');
  });

  it('should only count events from the specified tax year', () => {
    const events: TaxGainLossResult[] = [
      makeEvent({ gainLossEur: '2000', taxYear: 2024 }), // different year
      makeEvent({ gainLossEur: '300', taxYear: 2025 }),
    ];
    const result = calculateFreigrenze(events, [], 2025);

    // Only the EUR 300 from 2025 should count
    expect(result.paragraph23.totalGainsEur).toBeCloseTo(300, 2);
    expect(result.paragraph23.ampel).toBe('GREEN');
  });

  // ---- Section 22 Nr. 3 EStG TESTS ----

  it('should return GREEN for Section 22 Nr. 3 when rewards below EUR 256', () => {
    const result = calculateFreigrenze([], [100], 2025);

    expect(result.paragraph22Nr3.totalIncomeEur).toBeCloseTo(100, 2);
    expect(result.paragraph22Nr3.ampel).toBe('GREEN');
    expect(result.paragraph22Nr3.isExceeded).toBe(false);
    expect(result.paragraph22Nr3.limit).toBe(256);
  });

  it('should return YELLOW for Section 22 Nr. 3 when approaching threshold', () => {
    // 200 is the YELLOW threshold for Section 22 Nr. 3
    const result = calculateFreigrenze([], [210], 2025);

    expect(result.paragraph22Nr3.ampel).toBe('YELLOW');
    expect(result.paragraph22Nr3.isExceeded).toBe(false);
  });

  it('should return RED for Section 22 Nr. 3 when threshold exceeded', () => {
    const result = calculateFreigrenze([], [257], 2025);

    expect(result.paragraph22Nr3.totalIncomeEur).toBeCloseTo(257, 2);
    expect(result.paragraph22Nr3.ampel).toBe('RED');
    expect(result.paragraph22Nr3.isExceeded).toBe(true);
  });

  it('should apply all-or-nothing rule for Section 22 Nr. 3', () => {
    // At EUR 257, ALL EUR 257 is taxable
    const result = calculateFreigrenze([], [257], 2025);

    expect(result.paragraph22Nr3.isExceeded).toBe(true);
    expect(result.paragraph22Nr3.totalIncomeEur).toBeCloseTo(257, 2);
  });

  it('should sum PARAGRAPH_22_NR3 events and staking rewards for Section 22 Nr. 3', () => {
    // PARAGRAPH_22_NR3 events also contribute
    const events: TaxGainLossResult[] = [
      makeEvent({ eventType: 'PARAGRAPH_22_NR3', gainLossEur: '100', taxYear: 2025 }),
    ];
    const result = calculateFreigrenze(events, [100], 2025);

    // 100 from event + 100 from staking rewards = 200
    expect(result.paragraph22Nr3.totalIncomeEur).toBeCloseTo(200, 2);
    expect(result.paragraph22Nr3.ampel).toBe('YELLOW');
  });

  // ---- COMBINED SCENARIOS ----

  it('should calculate both paragraphs independently', () => {
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '1500' })];
    const result = calculateFreigrenze(events, [300], 2025);

    // Section 23: EUR 1500 > EUR 1000 -> RED
    expect(result.paragraph23.ampel).toBe('RED');
    expect(result.paragraph23.isExceeded).toBe(true);

    // Section 22 Nr. 3: EUR 300 > EUR 256 -> RED
    expect(result.paragraph22Nr3.ampel).toBe('RED');
    expect(result.paragraph22Nr3.isExceeded).toBe(true);
  });

  it('should handle empty tax events', () => {
    const result = calculateFreigrenze([], [], 2025);

    expect(result.paragraph23.netGainEur).toBeCloseTo(0, 2);
    expect(result.paragraph23.ampel).toBe('GREEN');
    expect(result.paragraph22Nr3.totalIncomeEur).toBeCloseTo(0, 2);
    expect(result.paragraph22Nr3.ampel).toBe('GREEN');
  });

  it('should compute remaining headroom correctly', () => {
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '700' })];
    const result = calculateFreigrenze(events, [150], 2025);

    // Section 23: remaining = max(0, 1000 - 700) = 300
    expect(result.paragraph23.remaining).toBeCloseTo(300, 2);

    // Section 22 Nr. 3: remaining = max(0, 256 - 150) = 106
    expect(result.paragraph22Nr3.remaining).toBeCloseTo(106, 2);
  });

  it('should return 0 remaining when limit exceeded', () => {
    const events: TaxGainLossResult[] = [makeEvent({ gainLossEur: '2000' })];
    const result = calculateFreigrenze(events, [500], 2025);

    expect(result.paragraph23.remaining).toBe(0);
    expect(result.paragraph22Nr3.remaining).toBe(0);
  });
});
