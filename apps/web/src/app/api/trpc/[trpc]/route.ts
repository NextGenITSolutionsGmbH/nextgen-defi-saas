import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
    responseMeta({ paths, errors, type }) {
      // Only cache successful GET queries
      if (type !== "query" || errors.length > 0) return {};

      const cacheable: Record<string, number> = {
        "dashboard.monthlyActivity": 300,
        "dashboard.haltefristUpcoming": 300,
        "dashboard.portfolioSummary": 60,
        "dashboard.kpis": 60,
        "dashboard.ampelBreakdown": 60,
        "dashboard.classificationProgress": 60,
        "dashboard.summary": 30,
        "user.me": 60,
        "wallet.list": 30,
        "export.list": 30,
        "transaction.stats": 60,
        "notification.getPreferences": 120,
      };

      const allPaths = paths ?? [];
      const ttl = Math.min(...allPaths.map(p => cacheable[p] ?? 0));

      if (ttl > 0) {
        return {
          headers: new Headers({
            "Cache-Control": `private, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
          }),
        };
      }
      return {};
    },
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
          }
        : undefined,
  });
}

export { handler as GET, handler as POST };
