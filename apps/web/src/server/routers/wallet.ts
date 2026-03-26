import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const addWalletSchema = z.object({
  address: z
    .string()
    .min(26, "Wallet address is too short")
    .max(128, "Wallet address is too long"),
  chain: z.enum(["ethereum", "polygon", "arbitrum", "optimism", "base", "solana", "bitcoin"]),
  label: z.string().max(64).optional(),
});

const removeWalletSchema = z.object({
  walletId: z.string().uuid(),
});

const syncWalletSchema = z.object({
  walletId: z.string().uuid(),
});

export const walletRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const wallets = await ctx.db.wallet.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        address: true,
        chain: true,
        label: true,
        lastSyncedAt: true,
        createdAt: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    return wallets;
  }),

  add: protectedProcedure
    .input(addWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.wallet.findFirst({
        where: {
          userId: ctx.user.id,
          address: input.address.toLowerCase(),
          chain: input.chain,
        },
      });

      if (existing) {
        throw new Error("Wallet already exists for this chain");
      }

      const wallet = await ctx.db.wallet.create({
        data: {
          userId: ctx.user.id,
          address: input.address.toLowerCase(),
          chain: input.chain,
          label: input.label,
        },
      });

      return wallet;
    }),

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
        throw new Error("Wallet not found");
      }

      await ctx.db.wallet.delete({
        where: { id: input.walletId },
      });

      return { success: true };
    }),

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
        throw new Error("Wallet not found");
      }

      // TODO: Dispatch sync job to BullMQ queue
      // await syncQueue.add('sync-wallet', { walletId: wallet.id, chain: wallet.chain });

      return {
        status: "queued" as const,
        message: "Wallet sync has been queued",
        walletId: wallet.id,
      };
    }),
});
