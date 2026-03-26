import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const planSchema = z.enum(["STARTER", "PRO", "BUSINESS", "KANZLEI"]);

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }),

  updatePlan: protectedProcedure
    .input(z.object({ plan: planSchema }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { plan: input.plan },
        select: {
          id: true,
          plan: true,
        },
      });

      return updated;
    }),
});
