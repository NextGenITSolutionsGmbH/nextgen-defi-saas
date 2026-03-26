// ---------------------------------------------------------------------------
// Wallet Sync Worker — fetches on-chain transactions for a wallet
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  WALLET_SYNC_QUEUE,
  type WalletSyncJobData,
} from "@defi-tracker/shared/queue";
import { prisma } from "@defi-tracker/db";

/**
 * Processes a single wallet-sync job:
 * 1. Looks up the wallet in the database
 * 2. Sets sync status to SYNCING
 * 3. Fetches transactions from the Flare RPC (placeholder)
 * 4. Creates a demonstration transaction record
 * 5. Updates wallet sync status to COMPLETED
 */
async function processWalletSync(job: Job<WalletSyncJobData>): Promise<void> {
  const { walletId, chainId, fromBlock } = job.data;

  // 1. Look up wallet in DB
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new Error(`Wallet ${walletId} not found in database`);
  }

  try {
    // 2. Update sync status to SYNCING
    await prisma.wallet.update({
      where: { id: walletId },
      data: { syncStatus: "SYNCING" },
    });

    const startBlock = fromBlock ?? Number(wallet.lastSyncBlock ?? 0);

    // 3. Fetch transactions from Flare RPC (placeholder)
    console.log(
      `Fetching transactions from Flare RPC for wallet ${wallet.address} from block ${startBlock}`,
    );

    // TODO: Replace with actual Flare RPC call
    // const transactions = await flareRpc.getTransactions(wallet.address, startBlock);

    // 4. Create a placeholder transaction record for demonstration
    const placeholderTxHash = `0x${Date.now().toString(16).padStart(64, "0")}`;
    const now = Math.floor(Date.now() / 1000);

    await prisma.transaction.create({
      data: {
        walletId,
        txHash: placeholderTxHash,
        blockNumber: BigInt(startBlock + 1),
        blockTimestamp: BigInt(now),
        protocol: "flare-native",
        status: "GRAY",
        rawData: {
          placeholder: true,
          chainId,
          note: "Placeholder transaction created during sync worker development",
        },
      },
    });

    console.log(
      `Created placeholder transaction ${placeholderTxHash} for wallet ${wallet.address}`,
    );

    // 5. Update wallet sync status to COMPLETED
    await prisma.wallet.update({
      where: { id: walletId },
      data: {
        syncStatus: "COMPLETED",
        lastSyncAt: new Date(),
        lastSyncBlock: BigInt(startBlock + 1),
      },
    });

    console.log(`Wallet sync completed for ${wallet.address}`);
  } catch (error) {
    // 6. Error handling — set status to ERROR
    await prisma.wallet.update({
      where: { id: walletId },
      data: { syncStatus: "ERROR" },
    });

    const message =
      error instanceof Error ? error.message : "Unknown error during wallet sync";
    console.error(`Wallet sync failed for ${wallet.address}: ${message}`);

    throw error; // re-throw so BullMQ marks the job as failed and can retry
  }
}

// ---------------------------------------------------------------------------
// Worker instance (created when this module is imported)
// ---------------------------------------------------------------------------

export const walletSyncWorker = new Worker<WalletSyncJobData>(
  WALLET_SYNC_QUEUE,
  processWalletSync,
  {
    connection: createRedisConnection(),
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60_000, // max 10 jobs per minute
    },
  },
);

walletSyncWorker.on("completed", (job) => {
  console.log(`[wallet-sync] Job ${job.id} completed for wallet ${job.data.walletId}`);
});

walletSyncWorker.on("failed", (job, error) => {
  console.error(
    `[wallet-sync] Job ${job?.id} failed for wallet ${job?.data.walletId}: ${error.message}`,
  );
});

export default walletSyncWorker;
