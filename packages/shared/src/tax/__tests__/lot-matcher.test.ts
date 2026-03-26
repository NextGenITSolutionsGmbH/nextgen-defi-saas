import { describe, it, expect } from 'vitest';
import { LotMatcher, daysBetween } from '../lot-matcher';
import type { TaxLot, Disposal } from '../../types/tax';

describe('daysBetween', () => {
  it('should compute days between two dates correctly', () => {
    expect(daysBetween('2025-01-01', '2025-01-02')).toBe(1);
    expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0);
    expect(daysBetween('2025-01-01', '2025-12-31')).toBe(364);
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(daysBetween('2025-01-01', '2026-01-02')).toBe(366);
  });

  it('should handle leap years', () => {
    // 2024 is a leap year
    expect(daysBetween('2024-01-01', '2024-12-31')).toBe(365);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap day
  });
});

describe('LotMatcher', () => {
  const matcher = new LotMatcher();

  function makeLot(overrides: Partial<TaxLot> & { id: string }): TaxLot {
    return {
      tokenSymbol: 'FLR',
      amount: 100,
      remainingAmount: 100,
      acquisitionCostEur: 2,
      acquisitionDate: '2025-01-01T00:00:00Z',
      isClosed: false,
      ...overrides,
    };
  }

  function makeDisposal(overrides: Partial<Disposal> = {}): Disposal {
    return {
      tokenSymbol: 'FLR',
      amount: 50,
      proceedsEur: 2.5,
      disposalDate: '2025-06-01T00:00:00Z',
      ...overrides,
    };
  }

  // ─── FIFO TESTS ───

  it('should match disposal against single lot using FIFO', () => {
    // Buy 100 FLR at €0.02 each = €2.00 total cost
    // Sell 50 FLR at €0.05 each = €2.50 total proceeds
    // Cost basis for 50 FLR = €1.00
    // Expected gain: €2.50 - €1.00 = €1.50
    const lot = makeLot({ id: 'lot-1', amount: 100, remainingAmount: 100, acquisitionCostEur: 2.0 });
    const disposal = makeDisposal({ amount: 50, proceedsEur: 2.5 });

    const results = matcher.match(disposal, [lot], 'FIFO');

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-1');
    expect(results[0].amountConsumed).toBe(50);
    expect(results[0].costBasisEur).toBe(1.0);
    expect(results[0].proceedsEur).toBe(2.5);
    expect(results[0].gainLossEur).toBe(1.5);
  });

  it('should match FIFO — oldest lot consumed first', () => {
    // Lot 1: 50 FLR bought 2025-01-01 at €0.01 each (€0.50 total)
    // Lot 2: 50 FLR bought 2025-06-01 at €0.03 each (€1.50 total)
    // Sell 60 FLR → FIFO: consume all of Lot 1 (50) + partial Lot 2 (10)
    const lot1 = makeLot({
      id: 'lot-1',
      amount: 50,
      remainingAmount: 50,
      acquisitionCostEur: 0.5,
      acquisitionDate: '2025-01-01T00:00:00Z',
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: 50,
      remainingAmount: 50,
      acquisitionCostEur: 1.5,
      acquisitionDate: '2025-06-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 60,
      proceedsEur: 3.0,
      disposalDate: '2025-09-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot2, lot1], 'FIFO'); // pass in wrong order to test sorting

    expect(results).toHaveLength(2);

    // First result should be from lot-1 (oldest — FIFO)
    expect(results[0].lotId).toBe('lot-1');
    expect(results[0].amountConsumed).toBe(50);
    // Cost basis: 50/50 * 0.50 = 0.50
    expect(results[0].costBasisEur).toBe(0.5);

    // Second result should be from lot-2
    expect(results[1].lotId).toBe('lot-2');
    expect(results[1].amountConsumed).toBe(10);
    // Cost basis: 10/50 * 1.50 = 0.30
    expect(results[1].costBasisEur).toBe(0.3);
  });

  // ─── LIFO TESTS ───

  it('should match LIFO — newest lot consumed first', () => {
    // Same lots as FIFO test, but LIFO
    // Should consume all of Lot 2 (50, newest) + partial Lot 1 (10)
    const lot1 = makeLot({
      id: 'lot-1',
      amount: 50,
      remainingAmount: 50,
      acquisitionCostEur: 0.5,
      acquisitionDate: '2025-01-01T00:00:00Z',
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: 50,
      remainingAmount: 50,
      acquisitionCostEur: 1.5,
      acquisitionDate: '2025-06-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 60,
      proceedsEur: 3.0,
      disposalDate: '2025-09-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot1, lot2], 'LIFO');

    expect(results).toHaveLength(2);

    // First result should be from lot-2 (newest — LIFO)
    expect(results[0].lotId).toBe('lot-2');
    expect(results[0].amountConsumed).toBe(50);
    // Cost basis: 50/50 * 1.50 = 1.50
    expect(results[0].costBasisEur).toBe(1.5);

    // Second result should be from lot-1
    expect(results[1].lotId).toBe('lot-1');
    expect(results[1].amountConsumed).toBe(10);
    // Cost basis: 10/50 * 0.50 = 0.10
    expect(results[1].costBasisEur).toBe(0.1);
  });

  // ─── PARTIAL LOT CONSUMPTION ───

  it('should handle partial lot consumption', () => {
    // Lot: 100 FLR, sell only 30 → result should show 30 consumed
    const lot = makeLot({
      id: 'lot-1',
      amount: 100,
      remainingAmount: 100,
      acquisitionCostEur: 2.0,
    });
    const disposal = makeDisposal({ amount: 30, proceedsEur: 1.5 });

    const results = matcher.match(disposal, [lot], 'FIFO');

    expect(results).toHaveLength(1);
    expect(results[0].amountConsumed).toBe(30);
    // Cost basis: 30/100 * 2.00 = 0.60
    expect(results[0].costBasisEur).toBe(0.6);
  });

  // ─── HOLDING PERIOD / TAX-FREE ───

  it('should compute holding period correctly', () => {
    // Buy 2025-01-01, sell 2025-06-01 → 151 days → taxable
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: '2025-01-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 50,
      proceedsEur: 2.5,
      disposalDate: '2025-06-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot], 'FIFO');
    expect(results[0].holdingPeriodDays).toBe(151);
    expect(results[0].isTaxFree).toBe(false);
  });

  it('should mark disposals as tax-free when holding > 365 days', () => {
    // Buy 2025-01-01, sell 2026-01-02 → 366 days → tax-free
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: '2025-01-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 50,
      proceedsEur: 5.0,
      disposalDate: '2026-01-02T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot], 'FIFO');
    expect(results[0].holdingPeriodDays).toBe(366);
    expect(results[0].isTaxFree).toBe(true);
  });

  it('should NOT mark disposals as tax-free at exactly 365 days', () => {
    // Buy 2025-01-01, sell 2026-01-01 → 365 days → NOT tax-free (must be MORE than 365)
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: '2025-01-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 50,
      proceedsEur: 5.0,
      disposalDate: '2026-01-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot], 'FIFO');
    expect(results[0].holdingPeriodDays).toBe(365);
    expect(results[0].isTaxFree).toBe(false);
  });

  // ─── MULTI-LOT HOLDING PERIODS (FIFO) ───

  it('should compute different holding periods per lot in FIFO', () => {
    // Lot 1: bought 2024-01-01 (>365 days held → tax-free)
    // Lot 2: bought 2025-06-01 (<365 days held → taxable)
    // Sell 70 on 2025-09-01 → consumes 50 from lot-1, 20 from lot-2
    const lot1 = makeLot({
      id: 'lot-1',
      amount: 50,
      remainingAmount: 50,
      acquisitionCostEur: 0.25,
      acquisitionDate: '2024-01-01T00:00:00Z',
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: 50,
      remainingAmount: 50,
      acquisitionCostEur: 1.5,
      acquisitionDate: '2025-06-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 70,
      proceedsEur: 7.0,
      disposalDate: '2025-09-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot1, lot2], 'FIFO');

    expect(results).toHaveLength(2);

    // Lot 1: held since 2024-01-01 to 2025-09-01 = 609 days → tax-free
    expect(results[0].lotId).toBe('lot-1');
    expect(results[0].isTaxFree).toBe(true);
    expect(results[0].holdingPeriodDays).toBeGreaterThan(365);

    // Lot 2: held since 2025-06-01 to 2025-09-01 = 92 days → taxable
    expect(results[1].lotId).toBe('lot-2');
    expect(results[1].isTaxFree).toBe(false);
    expect(results[1].holdingPeriodDays).toBeLessThan(365);
  });

  // ─── ERROR HANDLING ───

  it('should throw when disposal exceeds available lots', () => {
    const lot = makeLot({ id: 'lot-1', amount: 50, remainingAmount: 50 });
    const disposal = makeDisposal({ amount: 100 });

    expect(() => matcher.match(disposal, [lot], 'FIFO')).toThrow(
      /Insufficient lots/,
    );
  });

  it('should skip closed lots', () => {
    const closedLot = makeLot({ id: 'lot-closed', isClosed: true });
    const openLot = makeLot({ id: 'lot-open', amount: 100, remainingAmount: 100 });
    const disposal = makeDisposal({ amount: 50 });

    const results = matcher.match(disposal, [closedLot, openLot], 'FIFO');

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-open');
  });

  it('should skip lots with zero remaining amount', () => {
    const emptyLot = makeLot({ id: 'lot-empty', remainingAmount: 0 });
    const fullLot = makeLot({ id: 'lot-full', amount: 100, remainingAmount: 100 });
    const disposal = makeDisposal({ amount: 50 });

    const results = matcher.match(disposal, [emptyLot, fullLot], 'FIFO');

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-full');
  });

  it('should filter lots by token symbol', () => {
    const flrLot = makeLot({ id: 'lot-flr', tokenSymbol: 'FLR' });
    const wflrLot = makeLot({ id: 'lot-wflr', tokenSymbol: 'WFLR' });
    const disposal = makeDisposal({ tokenSymbol: 'FLR', amount: 50 });

    const results = matcher.match(disposal, [flrLot, wflrLot], 'FIFO');

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-flr');
  });

  it('should not mutate the original lots array', () => {
    const lot = makeLot({ id: 'lot-1', amount: 100, remainingAmount: 100 });
    const disposal = makeDisposal({ amount: 50 });

    matcher.match(disposal, [lot], 'FIFO');

    // Original lot should be unchanged
    expect(lot.remainingAmount).toBe(100);
    expect(lot.isClosed).toBe(false);
  });

  // ─── GAIN/LOSS CALCULATION ───

  it('should compute a loss correctly', () => {
    // Buy 100 FLR at €0.05 each = €5.00
    // Sell 100 FLR at €0.02 each = €2.00
    // Loss: €2.00 - €5.00 = -€3.00
    const lot = makeLot({
      id: 'lot-1',
      amount: 100,
      remainingAmount: 100,
      acquisitionCostEur: 5.0,
    });
    const disposal = makeDisposal({
      amount: 100,
      proceedsEur: 2.0,
      disposalDate: '2025-06-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot], 'FIFO');

    expect(results[0].gainLossEur).toBe(-3.0);
  });

  it('should pro-rate proceeds across multiple lots', () => {
    // Lot 1: 30 FLR, cost €0.60
    // Lot 2: 30 FLR, cost €0.90
    // Sell 60 FLR for €6.00
    // Lot 1 proceeds: (30/60) * 6.00 = 3.00
    // Lot 2 proceeds: (30/60) * 6.00 = 3.00
    const lot1 = makeLot({
      id: 'lot-1',
      amount: 30,
      remainingAmount: 30,
      acquisitionCostEur: 0.6,
      acquisitionDate: '2025-01-01T00:00:00Z',
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: 30,
      remainingAmount: 30,
      acquisitionCostEur: 0.9,
      acquisitionDate: '2025-02-01T00:00:00Z',
    });
    const disposal = makeDisposal({
      amount: 60,
      proceedsEur: 6.0,
      disposalDate: '2025-09-01T00:00:00Z',
    });

    const results = matcher.match(disposal, [lot1, lot2], 'FIFO');

    expect(results[0].proceedsEur).toBe(3.0);
    expect(results[1].proceedsEur).toBe(3.0);

    // Lot 1: gain = 3.00 - 0.60 = 2.40
    expect(results[0].gainLossEur).toBe(2.4);
    // Lot 2: gain = 3.00 - 0.90 = 2.10
    expect(results[1].gainLossEur).toBe(2.1);
  });
});
