import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Flare Mainnet — this is a Flare-only MVP */
const FLARE_CHAIN_ID = 14;

/** Wallet limits per plan tier */
const PLAN_WALLET_LIMITS: Record<string, number> = {
  STARTER: 1,
  PRO: 5,
  BUSINESS: 20,
  KANZLEI: 20,
};

/** EVM address regex: 0x followed by exactly 40 hex characters */
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const addWalletSchema = z.object({
  address: z
    .string()
    .regex(EVM_ADDRESS_REGEX, "Invalid EVM address — must be 0x followed by 40 hex characters"),
  label: z.string().max(100).optional(),
  connectionMethod: z.enum(["metamask", "walletconnect", "manual"]),
});

const removeWalletSchema = z.object({
  walletId: z.string().uuid(),
});

const syncWalletSchema = z.object({
  walletId: z.string().uuid(),
});

const syncStatusSchema = z.object({
  walletId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const walletRouter = router({
  /**
   * List all wallets for the authenticated user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const wallets = await ctx.db.wallet.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        address: true,
        chainId: true,
        label: true,
        syncStatus: true,
        lastSyncAt: true,
        createdAt: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    return wallets;
  }),

  /**
   * Add a new Flare wallet (read-only tracking).
   * Enforces plan-based wallet limits.
   */
  add: protectedProcedure
    .input(addWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const address = input.address.toLowerCase();

      // --- Plan-based wallet limit ---
      const plan = ctx.user.plan ?? "STARTER";
      const limit = PLAN_WALLET_LIMITS[plan] ?? PLAN_WALLET_LIMITS.STARTER;

      const currentCount = await ctx.db.wallet.count({
        where: { userId: ctx.user.id },
      });

      if (currentCount >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Wallet limit reached (${limit} wallet${limit === 1 ? "" : "s"} on ${plan} plan). Upgrade your plan to add more wallets.`,
        });
      }

      // --- Duplicate check ---
      const existing = await ctx.db.wallet.findFirst({
        where: {
          userId: ctx.user.id,
          address,
          chainId: FLARE_CHAIN_ID,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This Flare wallet is already being tracked.",
        });
      }

      // --- Create wallet ---
      const wallet = await ctx.db.wallet.create({
        data: {
          userId: ctx.user.id,
          address,
          chainId: FLARE_CHAIN_ID,
          label: input.label,
        },
      });

      return wallet;
    }),

  /**
   * Remove a wallet and all associated data.
   */
  remove: protectedProcedure
    .input(removeWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const wallet = await ctx.db.wallet.findFirst({
        where: {
          id: input.walletId,
          userId: ctx.user.id,
        },
      });

      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found.",
        });
      }

      await ctx.db.wallet.delete({
        where: { id: input.walletId },
      });

      return { success: true };
    }),

  /**
   * Trigger a sync for a wallet.
   */
  sync: protectedProcedure
    .input(syncWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const wallet = await ctx.db.wallet.findFirst({
        where: {
          id: input.walletId,
          userId: ctx.user.id,
        },
      });

      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found.",
        });
      }

      // Mark as syncing — the background job will update to COMPLETED or ERROR
      await ctx.db.wallet.update({
        where: { id: wallet.id },
        data: { syncStatus: "SYNCING" },
      });

      // TODO: Dispatch sync job to BullMQ queue
      // await syncQueue.add('sync-wallet', { walletId: wallet.id, chainId: wallet.chainId });

      return {
        status: "queued" as const,
        message: "Wallet sync has been queued",
        walletId: wallet.id,
      };
    }),

  /**
   * Get the current sync status for a wallet.
   */
  syncStatus: protectedProcedure
    .input(syncStatusSchema)
    .query(async ({ ctx, input }) => {
      const wallet = await ctx.db.wallet.findFirst({
        where: {
          id: input.walletId,
          userId: ctx.user.id,
        },
        select: {
          id: true,
          syncStatus: true,
          lastSyncAt: true,
          lastSyncBlock: true,
          _count: {
            select: { transactions: true },
          },
        },
      });

      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Wallet not found.",
        });
      }

      return wallet;
    }),
});
