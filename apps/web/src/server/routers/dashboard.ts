import { router, protectedProcedure } from "../trpc";

export const dashboardRouter = router({
  /**
   * Summary — wallet/tx/export/sync overview counts
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const [walletCount, totalTxCount, classifiedTxCount, pendingExports, syncingWallets] =
      await Promise.all([
        ctx.db.wallet.count({ where: { userId: ctx.user.id } }),
        ctx.db.transaction.count({
          where: { wallet: { userId: ctx.user.id } },
        }),
        ctx.db.transaction.count({
          where: {
            wallet: { userId: ctx.user.id },
            classifications: { some: {} },
          },
        }),
        ctx.db.export.count({
          where: { userId: ctx.user.id, status: "PENDING" },
        }),
        ctx.db.wallet.count({
          where: { userId: ctx.user.id, syncStatus: "SYNCING" },
        }),
      ]);

    return {
      walletCount,
      totalTxCount,
      classifiedTxCount,
      pendingExports,
      syncingWallets,
    };
  }),

  /**
   * KPIs — classified %, Freigrenze usage, recent tx count
   */
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoUnix = Math.floor(thirtyDaysAgo.getTime() / 1000);

    const currentYear = new Date().getFullYear();

    const [
      totalTransactions,
      classifiedTxCount,
      recentTxCount,
      paragraph23Events,
      paragraph22Nr3Events,
    ] = await Promise.all([
      ctx.db.transaction.count({
        where: { wallet: { userId: ctx.user.id } },
      }),
      ctx.db.transaction.count({
        where: {
          wallet: { userId: ctx.user.id },
          classifications: { some: {} },
        },
      }),
      ctx.db.transaction.count({
        where: {
          wallet: { userId: ctx.user.id },
          blockTimestamp: { gte: thirtyDaysAgoUnix },
        },
      }),
      ctx.db.taxEvent.aggregate({
        _sum: { gainLossEur: true },
        where: {
          userId: ctx.user.id,
          eventType: "PARAGRAPH_23",
          taxYear: currentYear,
        },
      }),
      ctx.db.taxEvent.aggregate({
        _sum: { gainLossEur: true },
        where: {
          userId: ctx.user.id,
          eventType: "PARAGRAPH_22_NR3",
          taxYear: currentYear,
        },
      }),
    ]);

    const classifiedPercentage =
      totalTransactions > 0
        ? Math.round((classifiedTxCount / totalTransactions) * 10000) / 100
        : 0;

    const paragraph23Used = paragraph23Events._sum.gainLossEur
      ? Number(paragraph23Events._sum.gainLossEur)
      : 0;

    const paragraph22Nr3Used = paragraph22Nr3Events._sum.gainLossEur
      ? Number(paragraph22Nr3Events._sum.gainLossEur)
      : 0;

    return {
      totalTransactions,
      classifiedTxCount,
      classifiedPercentage,
      paragraph23Used,
      paragraph23Limit: 1000,
      paragraph22Nr3Used,
      paragraph22Nr3Limit: 256,
      recentTxCount,
    };
  }),

  /**
   * Ampel breakdown — GROUP BY status with counts and percentages
   */
  ampelBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const grouped = await ctx.db.transaction.groupBy({
      by: ["status"],
      where: { wallet: { userId: ctx.user.id } },
      _count: { id: true },
    });

    const total = grouped.reduce((sum, g) => sum + g._count.id, 0);

    const statusOrder = ["GREEN", "YELLOW", "RED", "GRAY"] as const;
    return statusOrder.map((status) => {
      const found = grouped.find((g) => g.status === status);
      const count = found?._count.id ?? 0;
      return {
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      };
    });
  }),

  /**
   * Recent transactions — last 10 with classification status
   */
  recentTransactions: protectedProcedure.query(async ({ ctx }) => {
    const transactions = await ctx.db.transaction.findMany({
      where: { wallet: { userId: ctx.user.id } },
      orderBy: { blockTimestamp: "desc" },
      take: 10,
      select: {
        id: true,
        txHash: true,
        blockTimestamp: true,
        protocol: true,
        status: true,
        classifications: {
          select: {
            ctType: true,
          },
          take: 1,
        },
      },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      txHash: tx.txHash,
      blockTimestamp: Number(tx.blockTimestamp),
      protocol: tx.protocol,
      status: tx.status,
      classificationType: tx.classifications[0]?.ctType ?? null,
    }));
  }),

  /**
   * Monthly activity — tx count per month for the last 12 months
   */
  monthlyActivity: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const months: { month: string; txCount: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = Math.floor(date.getTime() / 1000);

      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const endOfMonth = Math.floor(nextMonth.getTime() / 1000);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const label = `${year}-${month}`;

      const count = await ctx.db.transaction.count({
        where: {
          wallet: { userId: ctx.user.id },
          blockTimestamp: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
      });

      months.push({ month: label, txCount: count });
    }

    return months;
  }),

  /**
   * Haltefrist upcoming — tax lots approaching 365-day holding period within 30 days
   */
  haltefristUpcoming: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setDate(oneYearFromNow.getDate() + 365);

    // Lots where acquisitionDate + 365 days falls within the next 30 days
    // i.e., acquisitionDate is between (now - 365 days) and (now - 365 days + 30 days)
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 365);

    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 30);

    const lots = await ctx.db.taxLot.findMany({
      where: {
        userId: ctx.user.id,
        lotStatus: { in: ["OPEN", "PARTIAL"] },
        acquisitionDate: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      orderBy: { acquisitionDate: "asc" },
      select: {
        id: true,
        tokenSymbol: true,
        remainingAmount: true,
        acquisitionDate: true,
      },
    });

    return lots.map((lot) => {
      const taxFreeDate = new Date(lot.acquisitionDate);
      taxFreeDate.setDate(taxFreeDate.getDate() + 365);

      const daysRemaining = Math.max(
        0,
        Math.ceil((taxFreeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      return {
        id: lot.id,
        tokenSymbol: lot.tokenSymbol,
        amount: Number(lot.remainingAmount),
        daysRemaining,
        taxFreeDate: taxFreeDate.toISOString(),
      };
    });
  }),
});
