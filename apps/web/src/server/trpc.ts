import { initTRPC, TRPCError } from "@trpc/server";
import { checkRateLimit } from "@/lib/rate-limit";
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

/**
 * Creates a protected procedure with per-user rate limiting.
 * @param actionName  Unique name for rate limit key (e.g. "wallet.sync")
 * @param maxRequests Maximum requests allowed in window
 * @param windowMs    Sliding window duration in milliseconds
 */
export function createRateLimitedProcedure(
  actionName: string,
  maxRequests: number,
  windowMs: number,
) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const key = `trpc:${actionName}:${ctx.user.id}`;
    const result = await checkRateLimit(key, maxRequests, windowMs);
    if (!result.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil(result.resetInMs / 1000)} seconds.`,
      });
    }
    return next();
  });
}
