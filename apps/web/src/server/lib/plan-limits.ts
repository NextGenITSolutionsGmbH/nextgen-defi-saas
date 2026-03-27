import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Plan tier definitions
// ---------------------------------------------------------------------------

export const PLAN_LIMITS = {
  STARTER: { maxWallets: 1, maxTxPerMonth: 100, exportFormats: ["CSV"] as const, apiAccess: false },
  PRO: { maxWallets: 5, maxTxPerMonth: Infinity, exportFormats: ["CSV", "PDF"] as const, apiAccess: false },
  BUSINESS: { maxWallets: 20, maxTxPerMonth: Infinity, exportFormats: ["CSV", "XLSX", "PDF"] as const, apiAccess: true },
  KANZLEI: { maxWallets: 100, maxTxPerMonth: Infinity, exportFormats: ["CSV", "XLSX", "PDF"] as const, apiAccess: true },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return limits for the given plan tier, defaulting to STARTER. */
export function getPlanLimits(plan: string | undefined) {
  const key = (plan ?? "STARTER").toUpperCase() as PlanName;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.STARTER;
}

/** Throw FORBIDDEN if the user has already reached their wallet limit. */
export async function enforceWalletLimit(
  db: PrismaClient,
  userId: string,
  plan: string | undefined,
) {
  const limits = getPlanLimits(plan);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PrismaClient generic type varies by generated schema
  const currentCount = await (db as Record<string, any>).wallet.count({
    where: { userId },
  });

  if (currentCount >= limits.maxWallets) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Your ${plan ?? "STARTER"} plan allows a maximum of ${limits.maxWallets} wallet(s). Please upgrade to add more.`,
    });
  }
}

/** Throw FORBIDDEN if the user has exceeded their monthly TX sync limit. */
export async function enforceMonthlyTxLimit(
  db: PrismaClient,
  userId: string,
  plan: string | undefined,
) {
  const limits = getPlanLimits(plan);

  // Unlimited plans skip the check
  if (!Number.isFinite(limits.maxTxPerMonth)) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartTimestamp = Math.floor(monthStart.getTime() / 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PrismaClient generic type varies by generated schema
  const txCount = await (db as Record<string, any>).transaction.count({
    where: {
      wallet: { userId },
      blockTimestamp: { gte: monthStartTimestamp },
    },
  });

  if (txCount >= limits.maxTxPerMonth) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Your ${plan ?? "STARTER"} plan allows a maximum of ${limits.maxTxPerMonth} transactions per month. Please upgrade to continue syncing.`,
    });
  }
}

/** Throw FORBIDDEN if the requested export format is not included in the plan. */
export function enforceExportFormat(
  plan: string | undefined,
  format: string,
) {
  const limits = getPlanLimits(plan);
  const allowed: readonly string[] = limits.exportFormats;

  if (!allowed.includes(format)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `The ${format} export format is not available on your ${plan ?? "STARTER"} plan. Allowed formats: ${allowed.join(", ")}.`,
    });
  }
}
