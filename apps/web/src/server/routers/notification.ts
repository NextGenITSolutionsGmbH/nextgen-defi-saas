import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { invalidateCache } from "../lib/cache";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updatePreferencesSchema = z.object({
  exportComplete: z.boolean().optional(),
  syncError: z.boolean().optional(),
  taxReminder: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const notificationRouter = router({
  /**
   * Get or create notification preferences for the current user.
   * Uses upsert to ensure a row always exists with defaults.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.notificationPreference.upsert({
      where: { userId: ctx.user.id },
      create: {
        userId: ctx.user.id,
        exportComplete: false,
        syncError: false,
        taxReminder: false,
      },
      update: {},
      select: {
        id: true,
        exportComplete: true,
        syncError: true,
        taxReminder: true,
      },
    });

    return prefs;
  }),

  /**
   * Update notification preferences for the current user.
   * Uses upsert so the row is created if it doesn't exist yet.
   */
  updatePreferences: protectedProcedure
    .input(updatePreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const prefs = await ctx.db.notificationPreference.upsert({
        where: { userId: ctx.user.id },
        create: {
          userId: ctx.user.id,
          exportComplete: input.exportComplete ?? false,
          syncError: input.syncError ?? false,
          taxReminder: input.taxReminder ?? false,
        },
        update: {
          ...(input.exportComplete !== undefined && {
            exportComplete: input.exportComplete,
          }),
          ...(input.syncError !== undefined && {
            syncError: input.syncError,
          }),
          ...(input.taxReminder !== undefined && {
            taxReminder: input.taxReminder,
          }),
        },
        select: {
          id: true,
          exportComplete: true,
          syncError: true,
          taxReminder: true,
        },
      });

      await invalidateCache(ctx.user.id, ["notification.*"]);

      return prefs;
    }),
});
