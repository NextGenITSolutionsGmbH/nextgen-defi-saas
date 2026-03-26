import { describe, it, expect } from 'vitest';
import { LotMatcher } from '../lot-matcher';
import type { TaxLot, Disposal, TaxMethod } from '../types';

describe('LotMatcher', () => {
  function makeLot(overrides: Partial<TaxLot> & { id: string }): TaxLot {
    return {
      tokenSymbol: 'FLR',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      amount: '100',
      remainingAmount: '100',
      acquisitionCostEur: '2',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
      method: 'FIFO',
      disposalDate: null,
      status: 'OPEN',
      ...overrides,
    };
  }

  function makeDisposal(overrides: Partial<Disposal> = {}): Disposal {
    return {
      tokenSymbol: 'FLR',
      amount: '50',
      disposalProceedsEur: '2.5',
      disposalDate: new Date('2025-06-01T00:00:00Z'),
      txHash: '0xabc123',
      ...overrides,
    };
  }

  // ---- FIFO TESTS ----

  it('should match disposal against single lot using FIFO', () => {
    const matcher = new LotMatcher('FIFO');
    // Buy 100 FLR at EUR 2.00 total cost
    // Sell 50 FLR at EUR 2.50 total proceeds
    // Cost basis for 50 FLR = (50/100) * 2.00 = 1.00
    // Expected gain: 2.50 - 1.00 = 1.50
    const lot = makeLot({ id: 'lot-1', amount: '100', remainingAmount: '100', acquisitionCostEur: '2.0' });
    const disposal = makeDisposal({ amount: '50', disposalProceedsEur: '2.5' });

    const results = matcher.matchDisposal([lot], disposal);

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-1');
    expect(parseFloat(results[0].disposalAmount)).toBeCloseTo(50, 5);
    expect(parseFloat(results[0].acquisitionCostEur)).toBeCloseTo(1.0, 5);
    expect(parseFloat(results[0].disposalProceedsEur)).toBeCloseTo(2.5, 5);
    expect(parseFloat(results[0].gainLossEur)).toBeCloseTo(1.5, 5);
  });

  it('should match FIFO — oldest lot consumed first', () => {
    const matcher = new LotMatcher('FIFO');
    // Lot 1: 50 FLR bought 2025-01-01 at EUR 0.50 total
    // Lot 2: 50 FLR bought 2025-06-01 at EUR 1.50 total
    // Sell 60 FLR -> FIFO: consume all of Lot 1 (50) + partial Lot 2 (10)
    const lot1 = makeLot({
      id: 'lot-1',
      amount: '50',
      remainingAmount: '50',
      acquisitionCostEur: '0.5',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: '50',
      remainingAmount: '50',
      acquisitionCostEur: '1.5',
      acquisitionDate: new Date('2025-06-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '60',
      disposalProceedsEur: '3.0',
      disposalDate: new Date('2025-09-01T00:00:00Z'),
    });

    // Pass lots in wrong order to verify FIFO sorting
    const results = matcher.matchDisposal([lot2, lot1], disposal);

    expect(results).toHaveLength(2);

    // First result should be from lot-1 (oldest -- FIFO)
    expect(results[0].lotId).toBe('lot-1');
    expect(parseFloat(results[0].disposalAmount)).toBeCloseTo(50, 5);
    // Cost basis: (50/50) * 0.50 = 0.50
    expect(parseFloat(results[0].acquisitionCostEur)).toBeCloseTo(0.5, 5);

    // Second result should be from lot-2
    expect(results[1].lotId).toBe('lot-2');
    expect(parseFloat(results[1].disposalAmount)).toBeCloseTo(10, 5);
    // Cost basis: (10/50) * 1.50 = 0.30
    expect(parseFloat(results[1].acquisitionCostEur)).toBeCloseTo(0.3, 5);
  });

  // ---- LIFO TESTS ----

  it('should match LIFO — newest lot consumed first', () => {
    const matcher = new LotMatcher('LIFO');
    // Same lots as FIFO test, but LIFO
    // Should consume all of Lot 2 (50, newest) + partial Lot 1 (10)
    const lot1 = makeLot({
      id: 'lot-1',
      amount: '50',
      remainingAmount: '50',
      acquisitionCostEur: '0.5',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: '50',
      remainingAmount: '50',
      acquisitionCostEur: '1.5',
      acquisitionDate: new Date('2025-06-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '60',
      disposalProceedsEur: '3.0',
      disposalDate: new Date('2025-09-01T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot1, lot2], disposal);

    expect(results).toHaveLength(2);

    // First result should be from lot-2 (newest -- LIFO)
    expect(results[0].lotId).toBe('lot-2');
    expect(parseFloat(results[0].disposalAmount)).toBeCloseTo(50, 5);
    // Cost basis: (50/50) * 1.50 = 1.50
    expect(parseFloat(results[0].acquisitionCostEur)).toBeCloseTo(1.5, 5);

    // Second result should be from lot-1
    expect(results[1].lotId).toBe('lot-1');
    expect(parseFloat(results[1].disposalAmount)).toBeCloseTo(10, 5);
    // Cost basis: (10/50) * 0.50 = 0.10
    expect(parseFloat(results[1].acquisitionCostEur)).toBeCloseTo(0.1, 5);
  });

  // ---- PARTIAL LOT CONSUMPTION ----

  it('should handle partial lot consumption', () => {
    const matcher = new LotMatcher('FIFO');
    // Lot: 100 FLR, sell only 30 -> result should show 30 consumed
    const lot = makeLot({
      id: 'lot-1',
      amount: '100',
      remainingAmount: '100',
      acquisitionCostEur: '2.0',
    });
    const disposal = makeDisposal({ amount: '30', disposalProceedsEur: '1.5' });

    const results = matcher.matchDisposal([lot], disposal);

    expect(results).toHaveLength(1);
    expect(parseFloat(results[0].disposalAmount)).toBeCloseTo(30, 5);
    // Cost basis: (30/100) * 2.00 = 0.60
    expect(parseFloat(results[0].acquisitionCostEur)).toBeCloseTo(0.6, 5);

    // Lot should have status PARTIAL and reduced remaining
    expect(lot.status).toBe('PARTIAL');
    expect(parseFloat(lot.remainingAmount)).toBeCloseTo(70, 5);
  });

  // ---- HOLDING PERIOD / TAX-FREE ----

  it('should compute holding period correctly', () => {
    const matcher = new LotMatcher('FIFO');
    // Buy 2025-01-01, sell 2025-06-01 -> 151 days -> taxable
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '50',
      disposalProceedsEur: '2.5',
      disposalDate: new Date('2025-06-01T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot], disposal);
    expect(results[0].holdingPeriodDays).toBe(151);
    expect(results[0].isTaxFree).toBe(false);
  });

  it('should mark disposals as tax-free when holding > 365 days', () => {
    const matcher = new LotMatcher('FIFO');
    // Buy 2025-01-01, sell 2026-01-02 -> 366 days -> tax-free
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '50',
      disposalProceedsEur: '5.0',
      disposalDate: new Date('2026-01-02T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot], disposal);
    expect(results[0].holdingPeriodDays).toBe(366);
    expect(results[0].isTaxFree).toBe(true);
  });

  it('should NOT mark disposals as tax-free at exactly 365 days', () => {
    const matcher = new LotMatcher('FIFO');
    // Buy 2025-01-01, sell 2026-01-01 -> 365 days -> NOT tax-free (must be MORE than 365)
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '50',
      disposalProceedsEur: '5.0',
      disposalDate: new Date('2026-01-01T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot], disposal);
    expect(results[0].holdingPeriodDays).toBe(365);
    expect(results[0].isTaxFree).toBe(false);
  });

  // ---- MULTI-LOT HOLDING PERIODS (FIFO) ----

  it('should compute different holding periods per lot in FIFO', () => {
    const matcher = new LotMatcher('FIFO');
    // Lot 1: bought 2024-01-01 (>365 days held -> tax-free)
    // Lot 2: bought 2025-06-01 (<365 days held -> taxable)
    // Sell 70 on 2025-09-01 -> consumes 50 from lot-1, 20 from lot-2
    const lot1 = makeLot({
      id: 'lot-1',
      amount: '50',
      remainingAmount: '50',
      acquisitionCostEur: '0.25',
      acquisitionDate: new Date('2024-01-01T00:00:00Z'),
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: '50',
      remainingAmount: '50',
      acquisitionCostEur: '1.5',
      acquisitionDate: new Date('2025-06-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '70',
      disposalProceedsEur: '7.0',
      disposalDate: new Date('2025-09-01T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot1, lot2], disposal);

    expect(results).toHaveLength(2);

    // Lot 1: held since 2024-01-01 to 2025-09-01 = 609 days -> tax-free
    expect(results[0].lotId).toBe('lot-1');
    expect(results[0].isTaxFree).toBe(true);
    expect(results[0].holdingPeriodDays).toBeGreaterThan(365);

    // Lot 2: held since 2025-06-01 to 2025-09-01 = 92 days -> taxable
    expect(results[1].lotId).toBe('lot-2');
    expect(results[1].isTaxFree).toBe(false);
    expect(results[1].holdingPeriodDays).toBeLessThan(365);
  });

  // ---- ERROR HANDLING ----

  it('should throw when disposal exceeds available lots', () => {
    const matcher = new LotMatcher('FIFO');
    const lot = makeLot({ id: 'lot-1', amount: '50', remainingAmount: '50' });
    const disposal = makeDisposal({ amount: '100' });

    expect(() => matcher.matchDisposal([lot], disposal)).toThrow(
      /Insufficient lots/,
    );
  });

  it('should skip closed lots', () => {
    const matcher = new LotMatcher('FIFO');
    const closedLot = makeLot({ id: 'lot-closed', status: 'CLOSED', remainingAmount: '0' });
    const openLot = makeLot({ id: 'lot-open', amount: '100', remainingAmount: '100' });
    const disposal = makeDisposal({ amount: '50' });

    const results = matcher.matchDisposal([closedLot, openLot], disposal);

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-open');
  });

  it('should skip lots with zero remaining amount', () => {
    const matcher = new LotMatcher('FIFO');
    const emptyLot = makeLot({ id: 'lot-empty', remainingAmount: '0', status: 'CLOSED' });
    const fullLot = makeLot({ id: 'lot-full', amount: '100', remainingAmount: '100' });
    const disposal = makeDisposal({ amount: '50' });

    const results = matcher.matchDisposal([emptyLot, fullLot], disposal);

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-full');
  });

  it('should filter lots by token symbol', () => {
    const matcher = new LotMatcher('FIFO');
    const flrLot = makeLot({ id: 'lot-flr', tokenSymbol: 'FLR' });
    const wflrLot = makeLot({ id: 'lot-wflr', tokenSymbol: 'WFLR' });
    const disposal = makeDisposal({ tokenSymbol: 'FLR', amount: '50' });

    const results = matcher.matchDisposal([flrLot, wflrLot], disposal);

    expect(results).toHaveLength(1);
    expect(results[0].lotId).toBe('lot-flr');
  });

  it('should mutate the lot in-place when consumed', () => {
    const matcher = new LotMatcher('FIFO');
    const lot = makeLot({ id: 'lot-1', amount: '100', remainingAmount: '100' });
    const disposal = makeDisposal({ amount: '100' });

    matcher.matchDisposal([lot], disposal);

    // The actual source code mutates lots in place
    expect(lot.status).toBe('CLOSED');
    expect(parseFloat(lot.remainingAmount)).toBeCloseTo(0, 5);
  });

  // ---- GAIN/LOSS CALCULATION ----

  it('should compute a loss correctly', () => {
    const matcher = new LotMatcher('FIFO');
    // Buy 100 FLR at EUR 5.00
    // Sell 100 FLR at EUR 2.00
    // Loss: 2.00 - 5.00 = -3.00
    const lot = makeLot({
      id: 'lot-1',
      amount: '100',
      remainingAmount: '100',
      acquisitionCostEur: '5.0',
    });
    const disposal = makeDisposal({
      amount: '100',
      disposalProceedsEur: '2.0',
      disposalDate: new Date('2025-06-01T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot], disposal);

    expect(parseFloat(results[0].gainLossEur)).toBeCloseTo(-3.0, 5);
  });

  it('should pro-rate proceeds across multiple lots', () => {
    const matcher = new LotMatcher('FIFO');
    // Lot 1: 30 FLR, cost EUR 0.60
    // Lot 2: 30 FLR, cost EUR 0.90
    // Sell 60 FLR for EUR 6.00
    // Lot 1 proceeds: (30/60) * 6.00 = 3.00
    // Lot 2 proceeds: (30/60) * 6.00 = 3.00
    const lot1 = makeLot({
      id: 'lot-1',
      amount: '30',
      remainingAmount: '30',
      acquisitionCostEur: '0.6',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const lot2 = makeLot({
      id: 'lot-2',
      amount: '30',
      remainingAmount: '30',
      acquisitionCostEur: '0.9',
      acquisitionDate: new Date('2025-02-01T00:00:00Z'),
    });
    const disposal = makeDisposal({
      amount: '60',
      disposalProceedsEur: '6.0',
      disposalDate: new Date('2025-09-01T00:00:00Z'),
    });

    const results = matcher.matchDisposal([lot1, lot2], disposal);

    expect(parseFloat(results[0].disposalProceedsEur)).toBeCloseTo(3.0, 5);
    expect(parseFloat(results[1].disposalProceedsEur)).toBeCloseTo(3.0, 5);

    // Lot 1: gain = 3.00 - 0.60 = 2.40
    expect(parseFloat(results[0].gainLossEur)).toBeCloseTo(2.4, 5);
    // Lot 2: gain = 3.00 - 0.90 = 2.10
    expect(parseFloat(results[1].gainLossEur)).toBeCloseTo(2.1, 5);
  });

  // ---- createLot ----

  it('should create a new tax lot with OPEN status', () => {
    const matcher = new LotMatcher('FIFO');
    const lot = matcher.createLot(
      'FLR',
      '0x0000000000000000000000000000000000000000',
      '1000',
      '50',
      new Date('2025-01-01T00:00:00Z'),
      'FIFO',
    );

    expect(lot.tokenSymbol).toBe('FLR');
    expect(lot.amount).toBe('1000');
    expect(lot.remainingAmount).toBe('1000');
    expect(lot.acquisitionCostEur).toBe('50');
    expect(lot.status).toBe('OPEN');
    expect(lot.disposalDate).toBeNull();
    expect(lot.id).toMatch(/^lot_/);
  });

  // ---- ALL RESULTS HAVE PARAGRAPH_23 EVENT TYPE ----

  it('should always set eventType to PARAGRAPH_23', () => {
    const matcher = new LotMatcher('FIFO');
    const lot = makeLot({ id: 'lot-1' });
    const disposal = makeDisposal({ amount: '50' });

    const results = matcher.matchDisposal([lot], disposal);
    expect(results[0].eventType).toBe('PARAGRAPH_23');
  });
});
