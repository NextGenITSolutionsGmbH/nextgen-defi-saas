import { PrismaClient } from "@prisma/client";
import type { User, Wallet, Transaction } from "@prisma/client";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Default password for test users created via `createTestUser()`. */
export const DEFAULT_TEST_PASSWORD = "TestPassword1!";
const DEFAULT_TEST_HASH = bcrypt.hashSync(DEFAULT_TEST_PASSWORD, 10);

// -------------------- Factory helpers --------------------

export interface CreateTestUserOptions {
  email?: string;
  passwordHash?: string;
  plan?: "STARTER" | "PRO" | "BUSINESS" | "KANZLEI";
}

export async function createTestUser(
  options: CreateTestUserOptions = {},
): Promise<User> {
  const {
    email = `test-${randomUUID()}@defi-tracker.test`,
    passwordHash = DEFAULT_TEST_HASH,
    plan = "STARTER",
  } = options;

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      plan,
    },
  });
}

export interface CreateTestWalletOptions {
  userId: string;
  address?: string;
  chainId?: number;
  label?: string;
}

export async function createTestWallet(
  options: CreateTestWalletOptions,
): Promise<Wallet> {
  const {
    userId,
    address = `0x${randomUUID().replace(/-/g, "").slice(0, 40)}`,
    chainId = 14,
    label = "Test Wallet",
  } = options;

  return prisma.wallet.create({
    data: {
      userId,
      address,
      chainId,
      label,
      syncStatus: "IDLE",
    },
  });
}

export interface CreateTestTransactionOptions {
  walletId: string;
  txHash?: string;
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  protocol?: string;
  status?: "GREEN" | "YELLOW" | "RED" | "GRAY";
}

export async function createTestTransaction(
  options: CreateTestTransactionOptions,
): Promise<Transaction> {
  const {
    walletId,
    txHash = `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "").slice(0, 2)}`,
    blockNumber = BigInt(Math.floor(Math.random() * 10_000_000)),
    blockTimestamp = BigInt(Math.floor(Date.now() / 1000)),
    protocol = null,
    status = "GRAY",
  } = options;

  return prisma.transaction.create({
    data: {
      walletId,
      txHash,
      blockNumber,
      blockTimestamp,
      protocol,
      status,
    },
  });
}

// -------------------- Cleanup --------------------

/**
 * Delete all test data from the database.
 *
 * Tables are truncated in dependency order (leaves first) to respect
 * foreign-key constraints.
 */
export async function cleanupTestData(): Promise<void> {
  // Use raw SQL for speed — cascade-aware ordering
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      tax_events,
      tx_classifications,
      tx_legs,
      transactions,
      wallets,
      tax_lots,
      exports,
      subscriptions,
      audit_logs,
      price_audit_logs,
      token_prices,
      users
    CASCADE;
  `);
}

/**
 * Disconnect the Prisma client — call in afterAll hooks.
 */
export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
