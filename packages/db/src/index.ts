// @defi-tracker/db — database client and schema exports
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { PrismaClient } from "@prisma/client";
export type {
  User,
  Wallet,
  Transaction,
  TxLeg,
  TxClassification,
  TokenPrice,
  TaxLot,
  TaxEvent,
  AuditLog,
  Export,
  PriceAuditLog,
  Subscription,
} from "@prisma/client";

export {
  PlanTier,
  SyncStatus,
  TxStatus,
  Direction,
  PriceSource,
  ModelChoice,
  TaxMethod,
  TaxEventType,
  LotStatus,
  ExportFormat,
  ExportStatus,
  SubStatus,
} from "@prisma/client";
