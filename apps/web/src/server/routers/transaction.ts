import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const listTransactionsSchema = z.object({
  walletId: z.string().uuid().optional(),
  protocol: z.string().optional(),
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
      const { walletId, protocol, cursor, limit } = input;

      const where: Record<string, unknown> = {
        wallet: { userId: ctx.user.id },
      };

      if (walletId) where.walletId = walletId;
      if (protocol) where.protocol = protocol;

      const transactions = await ctx.db.transaction.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { blockTimestamp: "desc" },
        select: {
          id: true,
          txHash: true,
          protocol: true,
          blockTimestamp: true,
          walletId: true,
          status: true,
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
              chainId: true,
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

      // Create a TxClassification record instead of updating a non-existent field
      const classification = await ctx.db.txClassification.create({
        data: {
          transactionId: input.transactionId,
          ctType: input.classification,
          priceSource: "MANUAL",
          isManual: true,
          comment: input.notes ?? null,
        },
      });

      return classification;
    }),
});
