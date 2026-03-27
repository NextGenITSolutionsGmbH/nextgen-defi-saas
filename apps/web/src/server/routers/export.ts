import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { addExportJob } from '../queue';
import { enforceExportFormat } from "../lib/plan-limits";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const currentYear = new Date().getFullYear();

const createExportSchema = z.object({
  taxYear: z
    .number()
    .int()
    .min(2020, "Tax year must be 2020 or later")
    .max(currentYear, `Tax year cannot exceed ${currentYear}`),
  method: z.enum(["FIFO", "LIFO"]),
  format: z.enum(["CSV", "XLSX", "PDF"]),
  walletIds: z.array(z.string().uuid()).optional(),
});

const downloadExportSchema = z.object({
  exportId: z.string().uuid(),
});

const previewCountSchema = z.object({
  taxYear: z
    .number()
    .int()
    .min(2020, "Tax year must be 2020 or later")
    .max(currentYear, `Tax year cannot exceed ${currentYear}`),
  walletIds: z.array(z.string().uuid()).optional(),
});

const regenerateExportSchema = z.object({
  exportId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const exportRouter = router({
  /**
   * Create a new export.
   * Validates inputs, creates the Export record, and returns metadata.
   */
  create: protectedProcedure
    .input(createExportSchema)
    .mutation(async ({ ctx, input }) => {
      enforceExportFormat(ctx.user.plan, input.format);

      // Validate wallet ownership if specific wallets were selected
      if (input.walletIds && input.walletIds.length > 0) {
        const ownedWallets = await ctx.db.wallet.count({
          where: {
            id: { in: input.walletIds },
            userId: ctx.user.id,
          },
        });

        if (ownedWallets !== input.walletIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more selected wallets do not belong to your account.",
          });
        }
      }

      // Count the transactions that will be included
      const txStartTimestamp = Math.floor(
        new Date(`${input.taxYear}-01-01T00:00:00Z`).getTime() / 1000
      );
      const txEndTimestamp = Math.floor(
        new Date(`${input.taxYear + 1}-01-01T00:00:00Z`).getTime() / 1000
      );

      const walletFilter = input.walletIds && input.walletIds.length > 0
        ? { id: { in: input.walletIds }, userId: ctx.user.id }
        : { userId: ctx.user.id };

      const estimatedRowCount = await ctx.db.transaction.count({
        where: {
          wallet: walletFilter,
          blockTimestamp: {
            gte: txStartTimestamp,
            lt: txEndTimestamp,
          },
        },
      });

      // Create the export record
      const exportRecord = await ctx.db.export.create({
        data: {
          userId: ctx.user.id,
          format: input.format,
          status: "PENDING",
          taxYear: input.taxYear,
          method: input.method,
          rowCount: estimatedRowCount,
          generatedAt: new Date(),
        },
      });

      await addExportJob(exportRecord.id, ctx.user.id, input.taxYear, input.method, input.format);

      return {
        id: exportRecord.id,
        status: "PENDING" as const,
        estimatedRowCount,
        message: "Export has been queued for processing",
      };
    }),

  /**
   * List all exports for the current user with full metadata.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const exports = await ctx.db.export.findMany({
      where: { userId: ctx.user.id },
      orderBy: { generatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        format: true,
        status: true,
        filePath: true,
        fileHash: true,
        taxYear: true,
        method: true,
        rowCount: true,
        generatedAt: true,
      },
    });

    return exports;
  }),

  /**
   * Download a completed export.
   */
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Export not found",
        });
      }

      if (exportRecord.status !== "COMPLETED" || !exportRecord.filePath) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Export is not yet ready for download",
        });
      }

      return {
        url: `/api/exports/${exportRecord.id}`,
        format: exportRecord.format,
        fileHash: exportRecord.fileHash,
      };
    }),

  /**
   * Preview the number of transactions that would be included in an export.
   */
  previewCount: protectedProcedure
    .input(previewCountSchema)
    .query(async ({ ctx, input }) => {
      const txStartTimestamp = Math.floor(
        new Date(`${input.taxYear}-01-01T00:00:00Z`).getTime() / 1000
      );
      const txEndTimestamp = Math.floor(
        new Date(`${input.taxYear + 1}-01-01T00:00:00Z`).getTime() / 1000
      );

      const walletFilter = input.walletIds && input.walletIds.length > 0
        ? { id: { in: input.walletIds }, userId: ctx.user.id }
        : { userId: ctx.user.id };

      // Verify wallet ownership
      if (input.walletIds && input.walletIds.length > 0) {
        const ownedWallets = await ctx.db.wallet.count({
          where: {
            id: { in: input.walletIds },
            userId: ctx.user.id,
          },
        });

        if (ownedWallets !== input.walletIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more selected wallets do not belong to your account.",
          });
        }
      }

      const count = await ctx.db.transaction.count({
        where: {
          wallet: walletFilter,
          blockTimestamp: {
            gte: txStartTimestamp,
            lt: txEndTimestamp,
          },
        },
      });

      return { count, taxYear: input.taxYear };
    }),

  /**
   * Re-generate a previously created export.
   */
  regenerate: protectedProcedure
    .input(regenerateExportSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.export.findFirst({
        where: {
          id: input.exportId,
          userId: ctx.user.id,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Export not found",
        });
      }

      // Create a new export with the same parameters
      const newExport = await ctx.db.export.create({
        data: {
          userId: ctx.user.id,
          format: existing.format,
          status: "PENDING",
          taxYear: existing.taxYear,
          method: existing.method,
          rowCount: existing.rowCount,
          generatedAt: new Date(),
        },
      });

      await addExportJob(newExport.id, ctx.user.id, existing.taxYear, existing.method as "FIFO" | "LIFO", existing.format as "CSV" | "XLSX" | "PDF");

      return {
        id: newExport.id,
        status: "PENDING" as const,
        message: "Export re-generation has been queued",
      };
    }),
});
