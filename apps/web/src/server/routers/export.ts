import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const createExportSchema = z.object({
  format: z.enum(["csv", "pdf", "json"]),
  walletIds: z.array(z.string().uuid()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  classifications: z.array(z.string()).optional(),
});

const downloadExportSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportRouter = router({
  create: protectedProcedure
    .input(createExportSchema)
    .mutation(async ({ ctx, input }) => {
      const exportRecord = await ctx.db.export.create({
        data: {
          userId: ctx.user.id,
          format: input.format,
          status: "pending",
          filters: {
            walletIds: input.walletIds,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            classifications: input.classifications,
          },
        },
      });

      // TODO: Dispatch export job to BullMQ queue
      // await exportQueue.add('generate-export', { exportId: exportRecord.id });

      return {
        id: exportRecord.id,
        status: "pending" as const,
        message: "Export has been queued for processing",
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const exports = await ctx.db.export.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        format: true,
        status: true,
        fileUrl: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return exports;
  }),

  download: protectedProcedure
    .input(downloadExportSchema)
    .query(async ({ ctx, input }) => {
      const exportRecord = await ctx.db.export.findFirst({
        where: {
          id: input.exportId,
          userId: ctx.user.id,
        },
      });

      if (!exportRecord) {
        throw new Error("Export not found");
      }

      if (exportRecord.status !== "completed" || !exportRecord.fileUrl) {
        throw new Error("Export is not yet ready for download");
      }

      return {
        url: exportRecord.fileUrl,
        format: exportRecord.format,
      };
    }),
});
