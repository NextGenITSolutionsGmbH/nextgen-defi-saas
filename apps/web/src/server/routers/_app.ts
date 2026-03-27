import { router } from "../trpc";
import { userRouter } from "./user";
import { walletRouter } from "./wallet";
import { transactionRouter } from "./transaction";
import { exportRouter } from "./export";
import { dashboardRouter } from "./dashboard";
import { notificationRouter } from "./notification";

export const appRouter = router({
  user: userRouter,
  wallet: walletRouter,
  transaction: transactionRouter,
  export: exportRouter,
  dashboard: dashboardRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
