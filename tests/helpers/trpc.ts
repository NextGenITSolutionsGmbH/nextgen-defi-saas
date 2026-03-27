/**
 * tRPC test helper — creates a fully-typed caller backed by a real Prisma
 * client and a mock session.
 *
 * IMPORTANT: Each test file that imports this helper MUST declare the
 * required vi.mock() calls at its own top level so that vitest can hoist
 * them correctly.  See the integration test files for the pattern.
 */
import { prisma } from "./db";
import { createCallerFactory } from "../../apps/web/src/server/trpc";
import { appRouter } from "../../apps/web/src/server/routers/_app";
import type { TRPCContext } from "../../apps/web/src/server/trpc";

// ---------------------------------------------------------------------------
// Caller factory
// ---------------------------------------------------------------------------
const callerFactory = createCallerFactory(appRouter);

/**
 * Create a fully-typed tRPC caller with real Prisma and a mock session.
 *
 * @param userId  - The authenticated user's ID (from `createTestUser`)
 * @param plan    - Optional plan tier (defaults to "STARTER")
 * @returns A tRPC caller whose procedures hit the real test database
 */
export function createTestCaller(userId: string, plan = "STARTER") {
  const ctx: TRPCContext = {
    session: {
      user: {
        id: userId,
        email: `test-${userId}@defi-tracker.test`,
        plan,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    db: prisma,
  };

  return callerFactory(ctx);
}

/**
 * Create an unauthenticated tRPC caller (session = null).
 * Useful for verifying that protectedProcedures reject unauthenticated access.
 */
export function createUnauthenticatedCaller() {
  const ctx: TRPCContext = {
    session: null,
    db: prisma,
  };

  return callerFactory(ctx);
}

export type TestCaller = ReturnType<typeof createTestCaller>;
