// @defi-tracker/db — database client and schema exports
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Appends connection pool parameters to the DATABASE_URL.
 * Tuned for a 4-core Hetzner server with PostgreSQL 16 max_connections=100.
 */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=25&pool_timeout=10`;
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: getDatasourceUrl(),
});

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
