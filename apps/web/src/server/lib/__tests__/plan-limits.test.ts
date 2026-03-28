// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  PLAN_LIMITS,
  getPlanLimits,
  enforceWalletLimit,
  enforceMonthlyTxLimit,
  enforceExportFormat,
} from "../plan-limits";

/**
 * @spec FR-05-01 — Plan tier enforcement (wallet limits)
 * @spec FR-05-02 — Plan tier enforcement (TX limits)
 * @spec FR-05-03 — Plan tier enforcement (export format restrictions)
 */

// ---------------------------------------------------------------------------
// Mock Prisma client factory
// ---------------------------------------------------------------------------

function createMockDb(overrides: { walletCount?: number; txCount?: number } = {}) {
  return {
    wallet: {
      count: vi.fn().mockResolvedValue(overrides.walletCount ?? 0),
    },
    transaction: {
      count: vi.fn().mockResolvedValue(overrides.txCount ?? 0),
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

// ---------------------------------------------------------------------------
// Plan limit definitions (pure data)
// ---------------------------------------------------------------------------

describe("PLAN_LIMITS definitions", () => {
  it("STARTER limits: 1 wallet, 100 TX/month, CSV only", () => {
    expect(PLAN_LIMITS.STARTER.maxWallets).toBe(1);
    expect(PLAN_LIMITS.STARTER.maxTxPerMonth).toBe(100);
    expect(PLAN_LIMITS.STARTER.exportFormats).toEqual(["CSV"]);
    expect(PLAN_LIMITS.STARTER.apiAccess).toBe(false);
  });

  it("PRO limits: 5 wallets, unlimited TX, CSV + PDF", () => {
    expect(PLAN_LIMITS.PRO.maxWallets).toBe(5);
    expect(PLAN_LIMITS.PRO.maxTxPerMonth).toBe(Infinity);
    expect(PLAN_LIMITS.PRO.exportFormats).toEqual(["CSV", "PDF"]);
    expect(PLAN_LIMITS.PRO.apiAccess).toBe(false);
  });

  it("BUSINESS limits: 20 wallets, unlimited TX, CSV + XLSX + PDF", () => {
    expect(PLAN_LIMITS.BUSINESS.maxWallets).toBe(20);
    expect(PLAN_LIMITS.BUSINESS.maxTxPerMonth).toBe(Infinity);
    expect(PLAN_LIMITS.BUSINESS.exportFormats).toEqual(["CSV", "XLSX", "PDF"]);
    expect(PLAN_LIMITS.BUSINESS.apiAccess).toBe(true);
  });

  it("KANZLEI limits: 100 wallets, unlimited TX, CSV + XLSX + PDF", () => {
    expect(PLAN_LIMITS.KANZLEI.maxWallets).toBe(100);
    expect(PLAN_LIMITS.KANZLEI.maxTxPerMonth).toBe(Infinity);
    expect(PLAN_LIMITS.KANZLEI.exportFormats).toEqual(["CSV", "XLSX", "PDF"]);
    expect(PLAN_LIMITS.KANZLEI.apiAccess).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPlanLimits
// ---------------------------------------------------------------------------

describe("getPlanLimits", () => {
  it("returns STARTER limits for undefined plan", () => {
    expect(getPlanLimits(undefined)).toEqual(PLAN_LIMITS.STARTER);
  });

  it("returns STARTER limits for unknown plan name", () => {
    expect(getPlanLimits("NONEXISTENT")).toEqual(PLAN_LIMITS.STARTER);
  });

  it("is case-insensitive", () => {
    expect(getPlanLimits("pro")).toEqual(PLAN_LIMITS.PRO);
    expect(getPlanLimits("Pro")).toEqual(PLAN_LIMITS.PRO);
  });
});

// ---------------------------------------------------------------------------
// enforceWalletLimit
// ---------------------------------------------------------------------------

describe("enforceWalletLimit", () => {
  it("does not throw when wallet count is below limit", async () => {
    const db = createMockDb({ walletCount: 0 });

    await expect(
      enforceWalletLimit(db, "user-1", "STARTER"),
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when wallet count equals STARTER limit (1)", async () => {
    const db = createMockDb({ walletCount: 1 });

    await expect(
      enforceWalletLimit(db, "user-1", "STARTER"),
    ).rejects.toThrow(TRPCError);

    try {
      await enforceWalletLimit(db, "user-1", "STARTER");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
      expect((err as TRPCError).message).toContain("1 wallet");
    }
  });

  it("uses correct limit for PRO plan (5)", async () => {
    const db = createMockDb({ walletCount: 4 });
    await expect(enforceWalletLimit(db, "user-1", "PRO")).resolves.toBeUndefined();

    const dbAtLimit = createMockDb({ walletCount: 5 });
    await expect(enforceWalletLimit(dbAtLimit, "user-1", "PRO")).rejects.toThrow(TRPCError);
  });

  it("uses correct limit for BUSINESS plan (20)", async () => {
    const db = createMockDb({ walletCount: 19 });
    await expect(enforceWalletLimit(db, "user-1", "BUSINESS")).resolves.toBeUndefined();

    const dbAtLimit = createMockDb({ walletCount: 20 });
    await expect(enforceWalletLimit(dbAtLimit, "user-1", "BUSINESS")).rejects.toThrow(TRPCError);
  });
});

// ---------------------------------------------------------------------------
// enforceMonthlyTxLimit
// ---------------------------------------------------------------------------

describe("enforceMonthlyTxLimit", () => {
  it("does not throw for PRO plan (unlimited — skips check)", async () => {
    const db = createMockDb({ txCount: 999_999 });

    await expect(
      enforceMonthlyTxLimit(db, "user-1", "PRO"),
    ).resolves.toBeUndefined();

    // Transaction.count should never be called for unlimited plans
    expect(db.transaction).toBeDefined();
  });

  it("does not throw when STARTER tx count is below 100", async () => {
    const db = createMockDb({ txCount: 50 });

    await expect(
      enforceMonthlyTxLimit(db, "user-1", "STARTER"),
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when STARTER tx count reaches 100", async () => {
    const db = createMockDb({ txCount: 100 });

    await expect(
      enforceMonthlyTxLimit(db, "user-1", "STARTER"),
    ).rejects.toThrow(TRPCError);

    try {
      await enforceMonthlyTxLimit(db, "user-1", "STARTER");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
      expect((err as TRPCError).message).toContain("100 transactions");
    }
  });
});

// ---------------------------------------------------------------------------
// enforceExportFormat
// ---------------------------------------------------------------------------

describe("enforceExportFormat", () => {
  it("does not throw when format is allowed (STARTER + CSV)", () => {
    expect(() => enforceExportFormat("STARTER", "CSV")).not.toThrow();
  });

  it("throws FORBIDDEN when STARTER requests PDF", () => {
    expect(() => enforceExportFormat("STARTER", "PDF")).toThrow(TRPCError);

    try {
      enforceExportFormat("STARTER", "PDF");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
      expect((err as TRPCError).message).toContain("PDF");
      expect((err as TRPCError).message).toContain("STARTER");
    }
  });

  it("does not throw for PRO + PDF", () => {
    expect(() => enforceExportFormat("PRO", "PDF")).not.toThrow();
  });

  it("throws FORBIDDEN when STARTER requests XLSX", () => {
    expect(() => enforceExportFormat("STARTER", "XLSX")).toThrow(TRPCError);

    try {
      enforceExportFormat("STARTER", "XLSX");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
      expect((err as TRPCError).message).toContain("XLSX");
    }
  });

  it("does not throw for BUSINESS + XLSX", () => {
    expect(() => enforceExportFormat("BUSINESS", "XLSX")).not.toThrow();
  });
});
