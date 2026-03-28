import { z } from "zod";
import { router, protectedProcedure, createRateLimitedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "../lib/cache";

/**
 * @spec US-002, US-003, US-005, US-008, EP-06, EP-09, EP-10 — Transaction listing, classification, dual-scenario
 */

// Valid CoinTracking types
const ctTypeEnum = z.enum([
  "Trade",
  "Deposit",
  "Withdrawal",
  "Staking",
  "LP Rewards",
  "Lending Einnahme",
  "Airdrop",
  "Mining",
  "Add Liquidity",
  "Remove Liquidity",
  "Transfer (intern)",
  "Margin Trade",
  "Other Income",
  "Other Expense",
  "Lost",
  "Stolen",
  "Gift",
]);

export type CTType = z.infer<typeof ctTypeEnum>;

const listTransactionsSchema = z.object({
  walletId: z.string().uuid().optional(),
  status: z.enum(["GREEN", "YELLOW", "RED", "GRAY"]).optional(),
  protocol: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(25),
});

const detailSchema = z.object({
  transactionId: z.string().uuid(),
});

const classifySchema = z.object({
  transactionId: z.string().uuid(),
  ctType: ctTypeEnum,
  buyAmount: z.number().optional(),
  buyCurrency: z.string().max(20).optional(),
  sellAmount: z.number().optional(),
  sellCurrency: z.string().max(20).optional(),
  fee: z.number().optional(),
  feeCurrency: z.string().max(20).optional(),
  priceSource: z.enum(["FTSO", "COINGECKO", "CMC", "MANUAL"]).default("MANUAL"),
  modelChoice: z.enum(["MODEL_A", "MODEL_B"]).optional(),
  comment: z.string().max(1000).optional(),
});

const setDualScenarioSchema = z.object({
  transactionId: z.string().uuid(),
  modelChoice: z.enum(["MODEL_A", "MODEL_B"]),
});

const bulkClassifySchema = z.object({
  items: z.array(
    z.object({
      transactionId: z.string().uuid(),
      ctType: ctTypeEnum,
      buyAmount: z.number().optional(),
      buyCurrency: z.string().max(20).optional(),
      sellAmount: z.number().optional(),
      sellCurrency: z.string().max(20).optional(),
      fee: z.number().optional(),
      feeCurrency: z.string().max(20).optional(),
      priceSource: z.enum(["FTSO", "COINGECKO", "CMC", "MANUAL"]).default("MANUAL"),
      modelChoice: z.enum(["MODEL_A", "MODEL_B"]).optional(),
      comment: z.string().max(1000).optional(),
    })
  ).min(1).max(100),
});

export const transactionRouter = router({
  list: protectedProcedure
    .input(listTransactionsSchema)
    .query(async ({ ctx, input }) => {
      const { walletId, status, protocol, dateFrom, dateTo, search, cursor, limit } = input;

      // Build where clause
      const where: Record<string, unknown> = {
        wallet: { userId: ctx.user.id },
      };

      if (walletId) where.walletId = walletId;
      if (status) where.status = status;
      if (protocol) where.protocol = protocol;
      if (search) {
        where.txHash = { contains: search, mode: "insensitive" };
      }

      // Date range filter on blockTimestamp (unix seconds stored as BigInt)
      if (dateFrom || dateTo) {
        const tsFilter: Record<string, bigint> = {};
        if (dateFrom) {
          tsFilter.gte = BigInt(Math.floor(new Date(dateFrom).getTime() / 1000));
        }
        if (dateTo) {
          tsFilter.lte = BigInt(Math.floor(new Date(dateTo).getTime() / 1000));
        }
        where.blockTimestamp = tsFilter;
      }

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
          legs: {
            select: {
              id: true,
              legIndex: true,
              direction: true,
              tokenSymbol: true,
              amount: true,
              eurValue: true,
            },
            orderBy: { legIndex: "asc" },
          },
          _count: {
            select: { classifications: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (transactions.length > limit) {
        const nextItem = transactions.pop();
        nextCursor = nextItem?.id;
      }

      // Get total count for the current filters
      const totalCount = await ctx.db.transaction.count({ where });

      return {
        items: transactions,
        nextCursor,
        totalCount,
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
          legs: {
            orderBy: { legIndex: "asc" },
          },
          classifications: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      return transaction;
    }),

  classify: createRateLimitedProcedure("tx.classify", 30, 60 * 1000)
    .input(classifySchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transaction.findFirst({
        where: {
          id: input.transactionId,
          wallet: { userId: ctx.user.id },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      // Create classification and update status to GREEN in a transaction
      const [classification] = await ctx.db.$transaction([
        ctx.db.txClassification.create({
          data: {
            transactionId: input.transactionId,
            ctType: input.ctType,
            buyAmount: input.buyAmount ?? null,
            buyCurrency: input.buyCurrency ?? null,
            sellAmount: input.sellAmount ?? null,
            sellCurrency: input.sellCurrency ?? null,
            fee: input.fee ?? null,
            feeCurrency: input.feeCurrency ?? null,
            priceSource: input.priceSource,
            modelChoice: input.modelChoice ?? null,
            isManual: true,
            comment: input.comment ?? null,
          },
        }),
        ctx.db.transaction.update({
          where: { id: input.transactionId },
          data: { status: "GREEN" },
        }),
      ]);

      await invalidateCache(ctx.user.id, ["transaction.*", "dashboard.*"]);

      return classification;
    }),

  setDualScenario: protectedProcedure
    .input(setDualScenarioSchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transaction.findFirst({
        where: {
          id: input.transactionId,
          wallet: { userId: ctx.user.id },
        },
        include: {
          classifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      if (transaction.status !== "YELLOW") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Dual scenario selection is only available for YELLOW (Graubereich) transactions",
        });
      }

      const latestClassification = transaction.classifications[0];

      if (latestClassification) {
        // Update the existing classification with the model choice
        const updated = await ctx.db.$transaction([
          ctx.db.txClassification.update({
            where: { id: latestClassification.id },
            data: { modelChoice: input.modelChoice },
          }),
          ctx.db.transaction.update({
            where: { id: input.transactionId },
            data: { status: "GREEN" },
          }),
        ]);
        await invalidateCache(ctx.user.id, ["transaction.*", "dashboard.*"]);
        return updated[0];
      } else {
        // Create a new classification with the model choice
        const [classification] = await ctx.db.$transaction([
          ctx.db.txClassification.create({
            data: {
              transactionId: input.transactionId,
              ctType: input.modelChoice === "MODEL_A" ? "Trade" : "Other Income",
              priceSource: "MANUAL",
              modelChoice: input.modelChoice,
              isManual: true,
              comment: `Graubereich: ${input.modelChoice === "MODEL_A" ? "Tauschmodell (§ 23 EStG)" : "Nutzungsüberlassung (§ 22 Nr. 3 EStG)"}`,
            },
          }),
          ctx.db.transaction.update({
            where: { id: input.transactionId },
            data: { status: "GREEN" },
          }),
        ]);
        await invalidateCache(ctx.user.id, ["transaction.*", "dashboard.*"]);
        return classification;
      }
    }),

  bulkClassify: createRateLimitedProcedure("tx.bulkClassify", 5, 60 * 1000)
    .input(bulkClassifySchema)
    .mutation(async ({ ctx, input }) => {
      // Verify all transactions belong to user
      const txIds = input.items.map((item) => item.transactionId);
      const existingTxs = await ctx.db.transaction.findMany({
        where: {
          id: { in: txIds },
          wallet: { userId: ctx.user.id },
        },
        select: { id: true },
      });

      const existingIds = new Set(existingTxs.map((tx) => tx.id));
      const invalidIds = txIds.filter((id) => !existingIds.has(id));

      if (invalidIds.length > 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Transactions not found: ${invalidIds.join(", ")}`,
        });
      }

      // Create classifications and update statuses
      const operations = input.items.flatMap((item) => [
        ctx.db.txClassification.create({
          data: {
            transactionId: item.transactionId,
            ctType: item.ctType,
            buyAmount: item.buyAmount ?? null,
            buyCurrency: item.buyCurrency ?? null,
            sellAmount: item.sellAmount ?? null,
            sellCurrency: item.sellCurrency ?? null,
            fee: item.fee ?? null,
            feeCurrency: item.feeCurrency ?? null,
            priceSource: item.priceSource,
            modelChoice: item.modelChoice ?? null,
            isManual: true,
            comment: item.comment ?? null,
          },
        }),
        ctx.db.transaction.update({
          where: { id: item.transactionId },
          data: { status: "GREEN" },
        }),
      ]);

      await ctx.db.$transaction(operations);

      await invalidateCache(ctx.user.id, ["transaction.*", "dashboard.*"]);

      return { count: input.items.length };
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      // Count by status
      const byStatus = await ctx.db.transaction.groupBy({
        by: ["status"],
        where: { wallet: { userId: ctx.user.id } },
        _count: { _all: true },
      });

      // Count by protocol
      const byProtocol = await ctx.db.transaction.groupBy({
        by: ["protocol"],
        where: { wallet: { userId: ctx.user.id } },
        _count: { _all: true },
      });

      // Total count
      const total = await ctx.db.transaction.count({
        where: { wallet: { userId: ctx.user.id } },
      });

      const statusCounts: Record<string, number> = {
        GREEN: 0,
        YELLOW: 0,
        RED: 0,
        GRAY: 0,
      };
      for (const item of byStatus) {
        statusCounts[item.status] = item._count._all;
      }

      const protocolCounts: Record<string, number> = {};
      for (const item of byProtocol) {
        const key = item.protocol ?? "Unknown";
        protocolCounts[key] = item._count._all;
      }

      return {
        total,
        byStatus: statusCounts,
        byProtocol: protocolCounts,
      };
    }),
});
