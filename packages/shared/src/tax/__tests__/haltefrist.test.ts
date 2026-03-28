import { describe, it, expect } from 'vitest';
import { calculateHaltefrist, getUpcomingTaxFreeAssets } from '../haltefrist';
import type { TaxLot } from '../types';

/**
 * @spec EP-08 — §23 EStG 365-day holding period (Haltefrist)
 */

describe('calculateHaltefrist [EP-08]', () => {
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

  const REFERENCE_DATE = new Date('2025-07-01T00:00:00Z');

  it('should compute days remaining until tax-free', () => {
    // Bought 2025-01-01, reference 2025-07-01 -> 181 days held
    // Tax-free date: 2025-01-01 + 365 = 2025-12-31 (via addDays)
    // Days remaining from 2025-07-01 to 2025-12-31 = 183
    const lot = makeLot({ id: 'lot-1', acquisitionDate: new Date('2025-01-01T00:00:00Z') });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].daysRemaining).toBeGreaterThan(0);
    expect(entries[0].isExpired).toBe(false);
  });

  it('should mark lots held more than 365 days as expired (tax-free)', () => {
    // Bought 2024-01-01, reference 2025-07-01 -> well past 365 days -> tax-free
    const lot = makeLot({ id: 'lot-1', acquisitionDate: new Date('2024-01-01T00:00:00Z') });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].isExpired).toBe(true);
    expect(entries[0].daysRemaining).toBe(0);
  });

  it('should mark lots at exactly 365 days as expired since taxFreeDate = acq+365', () => {
    // acquisitionDate 2025-01-01 -> taxFreeDate = 2026-01-01
    // referenceDate = 2026-01-01 -> refDate >= taxFreeDate -> isExpired = true
    const lot = makeLot({ id: 'lot-1', acquisitionDate: new Date('2025-01-01T00:00:00Z') });
    const entries = calculateHaltefrist([lot], new Date('2026-01-01T00:00:00Z'));

    expect(entries[0].isExpired).toBe(true);
    expect(entries[0].daysRemaining).toBe(0);
  });

  it('should not be expired at 364 days', () => {
    // acquisitionDate 2025-01-01 -> taxFreeDate = 2026-01-01
    // referenceDate = 2025-12-31 -> refDate < taxFreeDate -> not expired
    const lot = makeLot({ id: 'lot-1', acquisitionDate: new Date('2025-01-01T00:00:00Z') });
    const entries = calculateHaltefrist([lot], new Date('2025-12-31T00:00:00Z'));

    expect(entries[0].isExpired).toBe(false);
    expect(entries[0].daysRemaining).toBeGreaterThan(0);
  });

  it('should sort by daysRemaining ascending (most urgent first)', () => {
    const lot1 = makeLot({
      id: 'lot-a',
      acquisitionDate: new Date('2025-06-01T00:00:00Z'), // Most recent -> most days remaining
    });
    const lot2 = makeLot({
      id: 'lot-b',
      acquisitionDate: new Date('2025-03-01T00:00:00Z'), // Middle
    });
    const lot3 = makeLot({
      id: 'lot-c',
      acquisitionDate: new Date('2024-01-01T00:00:00Z'), // Oldest -> tax-free (0 days remaining)
    });

    const entries = calculateHaltefrist([lot1, lot2, lot3], REFERENCE_DATE);

    expect(entries).toHaveLength(3);
    // Sorted by daysRemaining ascending
    expect(entries[0].lotId).toBe('lot-c'); // 0 days remaining (expired)
    expect(entries[1].lotId).toBe('lot-b'); // fewer days remaining
    expect(entries[2].lotId).toBe('lot-a'); // most days remaining

    // Verify ordering is ascending
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].daysRemaining).toBeGreaterThanOrEqual(
        entries[i - 1].daysRemaining,
      );
    }
  });

  it('should skip closed lots', () => {
    const closedLot = makeLot({ id: 'lot-closed', status: 'CLOSED', remainingAmount: '0' });
    const openLot = makeLot({ id: 'lot-open', status: 'OPEN' });

    const entries = calculateHaltefrist([closedLot, openLot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].lotId).toBe('lot-open');
  });

  it('should skip lots with zero remaining amount', () => {
    const emptyLot = makeLot({ id: 'lot-empty', remainingAmount: '0', status: 'OPEN' });
    const fullLot = makeLot({ id: 'lot-full', remainingAmount: '50' });

    const entries = calculateHaltefrist([emptyLot, fullLot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].lotId).toBe('lot-full');
    expect(entries[0].amount).toBe('50');
  });

  it('should include correct token symbol and amount', () => {
    const lot = makeLot({
      id: 'lot-1',
      tokenSymbol: 'WFLR',
      remainingAmount: '75.5',
    });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(entries[0].tokenSymbol).toBe('WFLR');
    expect(entries[0].amount).toBe('75.5');
    expect(entries[0].acquisitionDate).toEqual(new Date('2025-01-01T00:00:00Z'));
  });

  it('should handle empty lots array', () => {
    const entries = calculateHaltefrist([], REFERENCE_DATE);
    expect(entries).toHaveLength(0);
  });

  it('should handle multiple lots with the same acquisition date', () => {
    const lot1 = makeLot({ id: 'lot-1', acquisitionDate: new Date('2025-03-01T00:00:00Z') });
    const lot2 = makeLot({ id: 'lot-2', acquisitionDate: new Date('2025-03-01T00:00:00Z') });

    const entries = calculateHaltefrist([lot1, lot2], REFERENCE_DATE);

    expect(entries).toHaveLength(2);
    // Both should have the same daysRemaining
    expect(entries[0].daysRemaining).toBe(entries[1].daysRemaining);
  });

  it('should compute eurValueAtAcquisition proportionally', () => {
    // Lot: 100 FLR, cost EUR 10.00, remaining 50
    // EUR value at acquisition for remaining: (50/100) * 10.00 = 5.00
    const lot = makeLot({
      id: 'lot-1',
      amount: '100',
      remainingAmount: '50',
      acquisitionCostEur: '10',
      status: 'PARTIAL',
    });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(parseFloat(entries[0].eurValueAtAcquisition)).toBeCloseTo(5.0, 5);
  });

  it('should default referenceDate to current time if not provided', () => {
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2020-01-01T00:00:00Z'), // Very old
    });
    const entries = calculateHaltefrist([lot]);

    // Should be expired since it is very old
    expect(entries).toHaveLength(1);
    expect(entries[0].isExpired).toBe(true);
    expect(entries[0].daysRemaining).toBe(0);
  });
});

describe('getUpcomingTaxFreeAssets', () => {
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

  it('should return lots that will become tax-free within the specified window', () => {
    // Reference: 2025-12-20 -> lot acquired 2025-01-01 has taxFreeDate = 2026-01-01
    // Days remaining: 12 -> within 30-day window
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2025-01-01T00:00:00Z'),
    });
    const result = getUpcomingTaxFreeAssets([lot], 30, new Date('2025-12-20T00:00:00Z'));

    expect(result).toHaveLength(1);
    expect(result[0].lotId).toBe('lot-1');
  });

  it('should not return lots that are already expired', () => {
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2024-01-01T00:00:00Z'), // very old, already expired
    });
    const result = getUpcomingTaxFreeAssets([lot], 30, new Date('2025-12-20T00:00:00Z'));

    expect(result).toHaveLength(0);
  });

  it('should not return lots that are far from expiry', () => {
    const lot = makeLot({
      id: 'lot-1',
      acquisitionDate: new Date('2025-06-01T00:00:00Z'), // taxFreeDate = 2026-06-01
    });
    // Reference: 2025-07-01 -> daysRemaining ~335 -> outside 30-day window
    const result = getUpcomingTaxFreeAssets([lot], 30, new Date('2025-07-01T00:00:00Z'));

    expect(result).toHaveLength(0);
  });
});
