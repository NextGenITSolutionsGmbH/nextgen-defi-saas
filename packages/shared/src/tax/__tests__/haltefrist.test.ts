import { describe, it, expect } from 'vitest';
import { calculateHaltefrist, HALTEFRIST_DAYS } from '../haltefrist';
import type { TaxLot } from '../../types/tax';

describe('calculateHaltefrist', () => {
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

  const REFERENCE_DATE = '2025-07-01T00:00:00Z';

  it('should compute days remaining until tax-free', () => {
    // Bought 2025-01-01, reference 2025-07-01 → 181 days held
    // Days remaining: 366 - 181 = 185
    const lot = makeLot({ id: 'lot-1', acquisitionDate: '2025-01-01T00:00:00Z' });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].daysHeld).toBe(181);
    expect(entries[0].daysRemaining).toBe(185); // 366 - 181
    expect(entries[0].isTaxFree).toBe(false);
  });

  it('should mark lots held more than 365 days as tax-free', () => {
    // Bought 2024-01-01, reference 2025-07-01 → 546 days held → tax-free
    const lot = makeLot({ id: 'lot-1', acquisitionDate: '2024-01-01T00:00:00Z' });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].isTaxFree).toBe(true);
    expect(entries[0].daysRemaining).toBe(0);
    expect(entries[0].daysHeld).toBeGreaterThan(HALTEFRIST_DAYS);
  });

  it('should NOT mark lots at exactly 365 days as tax-free', () => {
    // Need to be MORE than 365 days
    // 2025-01-01 + 365 days = 2026-01-01
    const lot = makeLot({ id: 'lot-1', acquisitionDate: '2025-01-01T00:00:00Z' });
    const entries = calculateHaltefrist([lot], '2026-01-01T00:00:00Z');

    expect(entries[0].daysHeld).toBe(365);
    expect(entries[0].isTaxFree).toBe(false);
    expect(entries[0].daysRemaining).toBe(1); // 1 more day needed
  });

  it('should mark lots at 366 days as tax-free', () => {
    const lot = makeLot({ id: 'lot-1', acquisitionDate: '2025-01-01T00:00:00Z' });
    const entries = calculateHaltefrist([lot], '2026-01-02T00:00:00Z');

    expect(entries[0].daysHeld).toBe(366);
    expect(entries[0].isTaxFree).toBe(true);
    expect(entries[0].daysRemaining).toBe(0);
  });

  it('should sort by daysRemaining ascending (most urgent first)', () => {
    const lot1 = makeLot({
      id: 'lot-a',
      acquisitionDate: '2025-06-01T00:00:00Z', // Most recent → most days remaining
    });
    const lot2 = makeLot({
      id: 'lot-b',
      acquisitionDate: '2025-03-01T00:00:00Z', // Middle
    });
    const lot3 = makeLot({
      id: 'lot-c',
      acquisitionDate: '2024-01-01T00:00:00Z', // Oldest → tax-free (0 days remaining)
    });

    const entries = calculateHaltefrist([lot1, lot2, lot3], REFERENCE_DATE);

    expect(entries).toHaveLength(3);
    // Sorted by daysRemaining ascending
    expect(entries[0].lotId).toBe('lot-c'); // 0 days remaining (tax-free)
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
    const closedLot = makeLot({ id: 'lot-closed', isClosed: true });
    const openLot = makeLot({ id: 'lot-open', isClosed: false });

    const entries = calculateHaltefrist([closedLot, openLot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].lotId).toBe('lot-open');
  });

  it('should skip lots with zero remaining amount', () => {
    const emptyLot = makeLot({ id: 'lot-empty', remainingAmount: 0 });
    const fullLot = makeLot({ id: 'lot-full', remainingAmount: 50 });

    const entries = calculateHaltefrist([emptyLot, fullLot], REFERENCE_DATE);

    expect(entries).toHaveLength(1);
    expect(entries[0].lotId).toBe('lot-full');
    expect(entries[0].remainingAmount).toBe(50);
  });

  it('should include correct token symbol and remaining amount', () => {
    const lot = makeLot({
      id: 'lot-1',
      tokenSymbol: 'WFLR',
      remainingAmount: 75.5,
    });
    const entries = calculateHaltefrist([lot], REFERENCE_DATE);

    expect(entries[0].tokenSymbol).toBe('WFLR');
    expect(entries[0].remainingAmount).toBe(75.5);
    expect(entries[0].acquisitionDate).toBe('2025-01-01T00:00:00Z');
  });

  it('should handle empty lots array', () => {
    const entries = calculateHaltefrist([], REFERENCE_DATE);
    expect(entries).toHaveLength(0);
  });

  it('should handle multiple lots with the same acquisition date', () => {
    const lot1 = makeLot({ id: 'lot-1', acquisitionDate: '2025-03-01T00:00:00Z' });
    const lot2 = makeLot({ id: 'lot-2', acquisitionDate: '2025-03-01T00:00:00Z' });

    const entries = calculateHaltefrist([lot1, lot2], REFERENCE_DATE);

    expect(entries).toHaveLength(2);
    // Both should have the same daysHeld and daysRemaining
    expect(entries[0].daysHeld).toBe(entries[1].daysHeld);
    expect(entries[0].daysRemaining).toBe(entries[1].daysRemaining);
  });

  it('should export HALTEFRIST_DAYS constant as 365', () => {
    expect(HALTEFRIST_DAYS).toBe(365);
  });
});
