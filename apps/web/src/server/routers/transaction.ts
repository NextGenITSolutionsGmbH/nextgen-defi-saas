import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const listTransactionsSchema = z.object({
  walletId: z.string().uuid().optional(),
  chain: z.string().optional(),
  classification: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(25),
});

const detailSchema = z.object({
  transactionId: z.string().uuid(),
});

const classifySchema = z.object({
  transactionId: z.string().uuid(),
  classification: z.enum([
    "swap",
    "transfer",
    "bridge",
    "stake",
    "unstake",
    "claim",
    "mint",
    "burn",
    "approve",
    "deposit",
    "withdraw",
    "other",
  ]),
  notes: z.string().max(500).optional(),
});

export const transactionRouter = router({
  list: protectedProcedure
    .input(listTransactionsSchema)
    .query(async ({ ctx, input }) => {
      const { walletId, chain, classification, cursor, limit } = input;

      const where: Record<string, unknown> = {
        wallet: { userId: ctx.user.id },
      };

      if (walletId) where.walletId = walletId;
      if (chain) where.chain = chain;
      if (classification) where.classification = classification;

      const transactions = await ctx.db.transaction.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          hash: true,
          chain: true,
          from: true,
          to: true,
          value: true,
          tokenSymbol: true,
          classification: true,
          timestamp: true,
          walletId: true,
        },
      });

      let nextCursor: string | undefined;
      if (transactions.length > limit) {
        const nextItem = transactions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: transactions,
        nextCursor,
      };
    }),

  detail: protectedProcedure
    .input(detailSchema)
    .query(async ({ ctx, input }) => {
      const transaction = await ctx.db.transaction.findFirst({
        where: {
          id: input.transactionId,
          wallet: { userId: ctx.user.id },
        },
        include: {
          wallet: {
            select: {
              address: true,
              chain: true,
              label: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      return transaction;
    }),

  classify: protectedProcedure
    .input(classifySchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transaction.findFirst({
        where: {
          id: input.transactionId,
          wallet: { userId: ctx.user.id },
        },
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      const updated = await ctx.db.transaction.update({
        where: { id: input.transactionId },
        data: {
          classification: input.classification,
          notes: input.notes,
        },
      });

      return updated;
    }),
});
