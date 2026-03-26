import { router, protectedProcedure } from "../trpc";

export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const [walletCount, transactionCount, pendingExports] = await Promise.all([
      ctx.db.wallet.count({ where: { userId: ctx.user.id } }),
      ctx.db.transaction.count({
        where: { wallet: { userId: ctx.user.id } },
      }),
      ctx.db.export.count({
        where: { userId: ctx.user.id, status: "pending" },
      }),
    ]);

    return {
      walletCount,
      transactionCount,
      pendingExports,
    };
  }),

  kpis: protectedProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentTransactions, classificationBreakdown] = await Promise.all([
      ctx.db.transaction.count({
        where: {
          wallet: { userId: ctx.user.id },
          timestamp: { gte: thirtyDaysAgo },
        },
      }),
      ctx.db.transaction.groupBy({
        by: ["classification"],
        where: {
          wallet: { userId: ctx.user.id },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
    ]);

    return {
      recentTransactionCount: recentTransactions,
      classificationBreakdown: classificationBreakdown.map((item) => ({
        classification: item.classification ?? "unclassified",
        count: item._count.id,
      })),
    };
  }),
});
