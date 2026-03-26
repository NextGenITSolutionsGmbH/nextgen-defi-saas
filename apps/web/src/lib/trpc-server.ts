import "server-only";

import { appRouter } from "@/server/routers/_app";
import { createTRPCContext, createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);

export async function getServerCaller() {
  const context = await createTRPCContext();
  return createCaller(context);
}
