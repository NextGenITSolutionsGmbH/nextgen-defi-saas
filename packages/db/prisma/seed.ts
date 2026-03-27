// ---------------------------------------------------------------
// DeFi Tracker SaaS  --  Prisma Seed Script
// Run:  npx tsx prisma/seed.ts
// ---------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// -----------  helpers  ------------------------------------------

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Build a chain-linked audit-log entry. Returns the hash for the next link. */
function buildAuditEntry(
  prevHash: string | null,
  entityType: string,
  entityId: string,
  action: string,
  changedBy: string,
  fieldChanged?: string,
  oldValue?: string,
  newValue?: string,
): { data: Parameters<typeof prisma.auditLog.create>[0]["data"]; hash: string } {
  const payload = JSON.stringify({
    prevHash,
    entityType,
    entityId,
    action,
    fieldChanged,
    oldValue,
    newValue,
    changedBy,
    ts: new Date().toISOString(),
  });
  const hash = sha256(payload);

  return {
    data: {
      entityType,
      entityId,
      action,
      fieldChanged: fieldChanged ?? null,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      changedBy,
      sha256Hash: hash,
      prevHash: prevHash ?? null,
    },
    hash,
  };
}

function randomTxHash(): string {
  const bytes = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
  return `0x${bytes}`;
}

function randomAddress(): string {
  const bytes = Array.from({ length: 20 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
  return `0x${bytes}`;
}

/** Password used for all seeded users — usable in E2E tests. */
const SEED_PASSWORD = "SeedP@ssw0rd!";

// -----------  main  --------------------------------------------

async function main() {
  console.log("Seeding DeFi Tracker database ...");

  // ---- 1. Users -----------------------------------------------
  const users = await Promise.all(
    [
      { email: "alice@example.com", plan: "STARTER" as const },
      { email: "bob@example.com", plan: "PRO" as const },
      { email: "carol@example.com", plan: "BUSINESS" as const },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          id: randomUUID(),
          email: u.email,
          passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
          plan: u.plan,
          totpEnabled: false,
        },
      }),
    ),
  );

  console.log(`  Created ${users.length} users`);

  // ---- 2. Wallets ---------------------------------------------
  const walletDefs = [
    { userId: users[0].id, address: "0x" + "a1".repeat(20), label: "Alice Main" },
    { userId: users[0].id, address: "0x" + "a2".repeat(20), label: "Alice DeFi" },
    { userId: users[1].id, address: "0x" + "b1".repeat(20), label: "Bob Primary" },
    { userId: users[1].id, address: "0x" + "b2".repeat(20), label: "Bob Staking" },
    { userId: users[2].id, address: "0x" + "c1".repeat(20), label: "Carol Vault" },
  ];

  const wallets = await Promise.all(
    walletDefs.map((w) =>
      prisma.wallet.upsert({
        where: {
          address_chainId: { address: w.address, chainId: 14 },
        },
        update: {},
        create: {
          id: randomUUID(),
          userId: w.userId,
          address: w.address,
          chainId: 14,
          label: w.label,
          syncStatus: "COMPLETED",
          lastSyncAt: new Date(),
          lastSyncBlock: BigInt(50_000_000),
        },
      }),
    ),
  );

  console.log(`  Created ${wallets.length} wallets`);

  // ---- 3. Transactions (50) -----------------------------------
  const tokens = [
    { symbol: "FLR", address: "0x" + "00".repeat(20) },
    { symbol: "WFLR", address: "0x" + "11".repeat(20) },
    { symbol: "SGB", address: "0x" + "22".repeat(20) },
    { symbol: "USDC", address: "0x" + "33".repeat(20) },
    { symbol: "USDT", address: "0x" + "44".repeat(20) },
  ];

  const protocols = ["SparkDEX", "Kinetic", "Enosys", "BlazeSwap", null];
  const statuses = ["GREEN", "YELLOW", "RED", "GRAY"] as const;
  const directions = ["IN", "OUT"] as const;
  const priceSources = ["FTSO", "COINGECKO", "CMC", "MANUAL"] as const;

  const baseTimestamp = 1_700_000_000; // approx Nov 2023

  const txs = [];
  for (let i = 0; i < 50; i++) {
    const wallet = wallets[i % wallets.length];
    const token = tokens[i % tokens.length];
    const blockTs = BigInt(baseTimestamp + i * 600);

    const tx = await prisma.transaction.create({
      data: {
        id: randomUUID(),
        walletId: wallet.id,
        txHash: randomTxHash(),
        blockNumber: BigInt(49_000_000 + i * 100),
        blockTimestamp: blockTs,
        protocol: protocols[i % protocols.length],
        status: statuses[i % statuses.length],
        rawData: { seed: true, index: i },
        legs: {
          create: {
            id: randomUUID(),
            legIndex: 0,
            direction: directions[i % 2],
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            amount: (Math.random() * 10_000).toFixed(18),
            eurValue: (Math.random() * 5_000).toFixed(10),
          },
        },
        classifications: {
          create: {
            id: randomUUID(),
            ctType: i % 3 === 0 ? "swap" : i % 3 === 1 ? "transfer" : "stake",
            buyAmount: (Math.random() * 10_000).toFixed(18),
            buyCurrency: token.symbol,
            priceSource: priceSources[i % priceSources.length],
            isManual: false,
          },
        },
      },
    });
    txs.push(tx);
  }

  console.log(`  Created ${txs.length} transactions (each with 1 leg + 1 classification)`);

  // ---- 4. Token Prices (10) -----------------------------------
  const prices = [];
  for (let i = 0; i < 10; i++) {
    const token = tokens[i % tokens.length];
    const ts = BigInt(baseTimestamp + i * 3600);
    const price = await prisma.tokenPrice.upsert({
      where: {
        tokenSymbol_chainId_timestampUnix: {
          tokenSymbol: token.symbol,
          chainId: 14,
          timestampUnix: ts,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        chainId: 14,
        timestampUnix: ts,
        eurPrice: (Math.random() * 2).toFixed(10),
        source: priceSources[i % priceSources.length],
      },
    });
    prices.push(price);
  }

  console.log(`  Created ${prices.length} token prices`);

  // ---- 5. Audit Log with SHA-256 chain ------------------------
  const auditActions = [
    { entity: "Transaction", action: "CREATE" },
    { entity: "TxClassification", action: "CREATE" },
    { entity: "TxClassification", action: "UPDATE", field: "ct_type", old: "transfer", new: "swap" },
    { entity: "Wallet", action: "CREATE" },
    { entity: "Transaction", action: "UPDATE", field: "status", old: "GRAY", new: "GREEN" },
    { entity: "TaxLot", action: "CREATE" },
    { entity: "Export", action: "CREATE" },
    { entity: "User", action: "UPDATE", field: "plan", old: "STARTER", new: "PRO" },
    { entity: "Subscription", action: "CREATE" },
    { entity: "TokenPrice", action: "CREATE" },
  ];

  let prevHash: string | null = null;
  for (const a of auditActions) {
    const { data, hash } = buildAuditEntry(
      prevHash,
      a.entity,
      randomUUID(),
      a.action,
      users[0].id,
      a.field,
      a.old,
      a.new,
    );
    await prisma.auditLog.create({ data });
    prevHash = hash;
  }

  console.log(`  Created ${auditActions.length} audit log entries (SHA-256 chained)`);

  // ---- 6. Price Audit Logs ------------------------------------
  for (let i = 0; i < 5; i++) {
    const token = tokens[i];
    await prisma.priceAuditLog.create({
      data: {
        id: randomUUID(),
        tokenSymbol: token.symbol,
        timestampUnix: BigInt(baseTimestamp + i * 3600),
        attemptedSource: "FTSO",
        resultSource: i < 3 ? "FTSO" : "COINGECKO",
        eurPrice: (Math.random() * 2).toFixed(10),
        fallbackReason: i >= 3 ? "FTSO timeout after 5000ms" : null,
      },
    });
  }

  console.log("  Created 5 price audit log entries");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
