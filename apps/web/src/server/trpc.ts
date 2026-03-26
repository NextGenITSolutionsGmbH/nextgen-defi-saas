import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "@/lib/auth";
import { prisma } from "@defi-tracker/db";
import superjson from "superjson";

export interface TRPCContext {
  session: {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan?: string;
    };
    expires: string;
  } | null;
  db: typeof prisma;
}

export async function createTRPCContext(
  _opts?: FetchCreateContextFnOptions // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<TRPCContext> {
  const session = await auth();
  return {
    session,
    db: prisma,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  const user = { ...ctx.session.user, id: ctx.session.user.id };

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user,
    },
  });
});
