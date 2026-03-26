import { router } from "../trpc";
import { userRouter } from "./user";
import { walletRouter } from "./wallet";
import { transactionRouter } from "./transaction";
import { exportRouter } from "./export";
import { dashboardRouter } from "./dashboard";

export const appRouter = router({
  user: userRouter,
  wallet: walletRouter,
  transaction: transactionRouter,
  export: exportRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
