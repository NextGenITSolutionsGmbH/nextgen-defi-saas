// ---------------------------------------------------------------------------
// Wallet Sync Worker -- fetches on-chain transactions for a wallet from
// Flare Network, decodes event logs, classifies them for tax purposes,
// and persists Transaction + TxLeg + TxClassification records.
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  WALLET_SYNC_QUEUE,
  type WalletSyncJobData,
} from "@defi-tracker/shared/queue";
import { prisma } from "@defi-tracker/db";
import {
  FlareRpcClient,
  FLARE_MAINNET_CONFIG,
  decodeTransactionLogs,
  ClassificationEngine,
  FLARE_TOKENS,
} from "@defi-tracker/shared";
import type {
  DecodedTransaction,
  DecodedEvent,
  ClassificationResult,
  AmpelStatus,
} from "@defi-tracker/shared";
import { addPriceFetchJob } from "../index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Process blocks in batches of 2048 (Flare RPC limit) */
const BLOCK_BATCH_SIZE = 2048;

// ---------------------------------------------------------------------------
// Reverse token lookup: lowercase address -> FlareTokenInfo
// ---------------------------------------------------------------------------

const ADDRESS_TO_TOKEN = new Map<
  string,
  { symbol: string; decimals: number }
>();
for (const [, info] of FLARE_TOKENS) {
  ADDRESS_TO_TOKEN.set(info.address.toLowerCase(), {
    symbol: info.symbol,
    decimals: info.decimals,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a classification AmpelStatus string to the Prisma TxStatus enum value.
 * Falls back to GRAY for any unrecognised status.
 */
function ampelToDbStatus(
  ampel: AmpelStatus | string,
): "GREEN" | "YELLOW" | "RED" | "GRAY" {
  switch (ampel) {
    case "GREEN":
      return "GREEN";
    case "YELLOW":
      return "YELLOW";
    case "RED":
      return "RED";
    case "GRAY":
    default:
      return "GRAY";
  }
}

/**
 * Resolve a token contract address to a known symbol + decimals.
 * Returns a fallback with the truncated address as symbol when unknown.
 */
function resolveToken(contractAddress: string): {
  symbol: string;
  decimals: number;
} {
  const addr = contractAddress.toLowerCase();
  const known = ADDRESS_TO_TOKEN.get(addr);
  if (known) return known;

  // Unknown token -- use the first 10 chars of the address as a placeholder symbol
  return {
    symbol: `UNK-${addr.slice(0, 10)}`,
    decimals: 18, // assume 18 decimals for unknown ERC20
  };
}

/**
 * Extract Transfer-event token movements from decoded events that involve
 * the synced wallet address. Returns TxLeg creation data.
 */
function extractTokenMovements(
  events: DecodedEvent[],
  walletAddress: string,
  transactionId: string,
): Array<{
  transactionId: string;
  legIndex: number;
  direction: "IN" | "OUT";
  tokenAddress: string;
  tokenSymbol: string;
  amount: string; // raw amount as decimal string
}> {
  const legs: Array<{
    transactionId: string;
    legIndex: number;
    direction: "IN" | "OUT";
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
  }> = [];
  const addr = walletAddress.toLowerCase();
  let legIndex = 0;

  for (const event of events) {
    if (event.eventName !== "Transfer") continue;

    const from = String(event.args["from"] ?? "").toLowerCase();
    const to = String(event.args["to"] ?? "").toLowerCase();
    const value = String(event.args["value"] ?? "0");

    // Skip zero-value transfers
    if (value === "0") continue;

    const token = resolveToken(event.contractAddress);

    if (to === addr) {
      // Incoming transfer
      legs.push({
        transactionId,
        legIndex: legIndex++,
        direction: "IN",
        tokenAddress: event.contractAddress.toLowerCase(),
        tokenSymbol: token.symbol,
        amount: value,
      });
    }

    if (from === addr) {
      // Outgoing transfer
      legs.push({
        transactionId,
        legIndex: legIndex++,
        direction: "OUT",
        tokenAddress: event.contractAddress.toLowerCase(),
        tokenSymbol: token.symbol,
        amount: value,
      });
    }
  }

  return legs;
}

/**
 * Determine the "worst" ampel status across all classification results.
 * Priority: RED > YELLOW > GREEN > GRAY
 */
function worstAmpelStatus(results: ClassificationResult[]): AmpelStatus {
  const priority: Record<string, number> = {
    RED: 3,
    YELLOW: 2,
    GREEN: 1,
    GRAY: 0,
  };
  let worst: AmpelStatus = "GRAY";
  let worstPriority = 0;

  for (const r of results) {
    const p = priority[r.ampelStatus] ?? 0;
    if (p > worstPriority) {
      worstPriority = p;
      worst = r.ampelStatus;
    }
  }

  return worst;
}

// ---------------------------------------------------------------------------
// Core processing logic
// ---------------------------------------------------------------------------

/**
 * Processes a single wallet-sync job:
 * 1. Verifies the wallet exists, sets status to SYNCING
 * 2. Fetches real transactions from Flare RPC in batches
 * 3. Decodes event logs and classifies transactions
 * 4. Creates Transaction + TxLeg + TxClassification records
 * 5. Queues price-fetch jobs for each token movement
 * 6. Updates wallet with lastSyncBlock + COMPLETED status
 */
async function processWalletSync(job: Job<WalletSyncJobData>): Promise<void> {
  const { walletId, chainId, fromBlock } = job.data;

  // -----------------------------------------------------------------------
  // 1. Validate wallet exists
  // -----------------------------------------------------------------------
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new Error(`Wallet ${walletId} not found in database`);
  }

  const walletAddress = wallet.address.toLowerCase();

  try {
    // ---------------------------------------------------------------------
    // 2. Set sync status to SYNCING
    // ---------------------------------------------------------------------
    await prisma.wallet.update({
      where: { id: walletId },
      data: { syncStatus: "SYNCING" },
    });

    // ---------------------------------------------------------------------
    // 3. Initialise RPC client and determine block range
    // ---------------------------------------------------------------------
    const rpc = new FlareRpcClient(FLARE_MAINNET_CONFIG);
    const classifier = new ClassificationEngine();

    const startBlock = fromBlock ?? Number(wallet.lastSyncBlock ?? 0);
    const latestBlock = await rpc.getBlockNumber();
    const toBlock = latestBlock;

    console.log(
      `[wallet-sync] Starting sync for ${walletAddress} from block ${startBlock} to ${toBlock} (${toBlock - startBlock} blocks)`,
    );

    let totalTxProcessed = 0;
    let totalEventsDecoded = 0;
    let totalPriceJobsQueued = 0;

    // ---------------------------------------------------------------------
    // 4. Process in batches of BLOCK_BATCH_SIZE blocks
    // ---------------------------------------------------------------------
    let currentFrom = startBlock;

    while (currentFrom <= toBlock) {
      const currentTo = Math.min(
        currentFrom + BLOCK_BATCH_SIZE - 1,
        toBlock,
      );

      // Report progress if the job supports it
      if (typeof job.updateProgress === "function") {
        const percentage =
          toBlock > startBlock
            ? Math.round(
                ((currentFrom - startBlock) / (toBlock - startBlock)) * 100,
              )
            : 100;
        await job.updateProgress({
          currentBlock: currentFrom,
          toBlock,
          percentage,
          txProcessed: totalTxProcessed,
        });
      }

      // -------------------------------------------------------------------
      // 4a. Fetch transactions from Flare RPC
      // -------------------------------------------------------------------
      let transactions: DecodedTransaction[];
      try {
        transactions = await rpc.getWalletTransactions(
          walletAddress,
          currentFrom,
          currentTo,
        );
      } catch (rpcError) {
        const msg =
          rpcError instanceof Error ? rpcError.message : String(rpcError);
        console.error(
          `[wallet-sync] RPC error in block range ${currentFrom}-${currentTo}: ${msg}`,
        );
        // Continue to next batch rather than failing the entire job
        currentFrom = currentTo + 1;
        continue;
      }

      // -------------------------------------------------------------------
      // 4b. Process each transaction
      // -------------------------------------------------------------------
      for (const tx of transactions) {
        // Skip reverted transactions
        if (tx.status === "reverted") {
          console.log(
            `[wallet-sync] Skipping reverted tx ${tx.txHash}`,
          );
          continue;
        }

        // Decode event logs
        const decodedEvents = decodeTransactionLogs(
          tx.logs,
          tx.blockTimestamp,
        );
        totalEventsDecoded += decodedEvents.length;

        // Classify each decoded event
        const classifications: ClassificationResult[] = [];
        for (const event of decodedEvents) {
          try {
            const result = classifier.classify(event);
            classifications.push(result);
          } catch (classifyError) {
            console.warn(
              `[wallet-sync] Classification error for event ${event.eventName} in tx ${tx.txHash}: ${
                classifyError instanceof Error
                  ? classifyError.message
                  : String(classifyError)
              }`,
            );
            // Push a RED fallback classification
            classifications.push({
              ctType: "Other",
              buyAmount: null,
              buyCurrency: null,
              sellAmount: null,
              sellCurrency: null,
              fee: null,
              feeCurrency: null,
              exchange: "Unknown",
              tradeGroup: "DeFi-Flare",
              ampelStatus: "RED",
              isGraubereich: false,
              modelChoice: null,
              comment: `Classification error: ${
                classifyError instanceof Error
                  ? classifyError.message
                  : "Unknown error"
              }`,
            });
          }
        }

        // Determine overall TX status from the worst ampel across events
        const overallStatus =
          classifications.length > 0
            ? worstAmpelStatus(classifications)
            : "GRAY";

        // Determine protocol from decoded events (first non-null)
        let protocol: string | null = null;
        for (const evt of decodedEvents) {
          if (evt.protocol) {
            protocol = evt.protocol;
            break;
          }
        }

        // -----------------------------------------------------------------
        // 4c. Persist to DB in a Prisma transaction (upsert for re-sync)
        // -----------------------------------------------------------------
        try {
          await prisma.$transaction(async (prismaTx) => {
            // Upsert the Transaction record
            const txRecord = await prismaTx.transaction.upsert({
              where: { txHash: tx.txHash },
              create: {
                walletId,
                txHash: tx.txHash,
                blockNumber: BigInt(tx.blockNumber),
                blockTimestamp: BigInt(tx.blockTimestamp),
                protocol,
                status: ampelToDbStatus(overallStatus),
                rawData: {
                  from: tx.from,
                  to: tx.to,
                  status: tx.status,
                  logCount: tx.logs.length,
                  chainId,
                },
              },
              update: {
                // On re-sync, update classification status and raw data
                protocol,
                status: ampelToDbStatus(overallStatus),
                rawData: {
                  from: tx.from,
                  to: tx.to,
                  status: tx.status,
                  logCount: tx.logs.length,
                  chainId,
                },
              },
            });

            // Delete existing legs and classifications for re-sync
            await prismaTx.txLeg.deleteMany({
              where: { transactionId: txRecord.id },
            });
            await prismaTx.txClassification.deleteMany({
              where: { transactionId: txRecord.id },
            });

            // Create TxLeg records from Transfer events
            const legs = extractTokenMovements(
              decodedEvents,
              walletAddress,
              txRecord.id,
            );

            if (legs.length > 0) {
              await prismaTx.txLeg.createMany({
                data: legs.map((leg) => ({
                  transactionId: leg.transactionId,
                  legIndex: leg.legIndex,
                  direction: leg.direction,
                  tokenAddress: leg.tokenAddress,
                  tokenSymbol: leg.tokenSymbol,
                  amount: leg.amount,
                  // eurValue will be filled in by the price-fetch worker
                  eurValue: null,
                })),
              });
            }

            // Create TxClassification records
            if (classifications.length > 0) {
              await prismaTx.txClassification.createMany({
                data: classifications.map((cls) => ({
                  transactionId: txRecord.id,
                  ctType: cls.ctType,
                  buyAmount: cls.buyAmount ?? undefined,
                  buyCurrency: cls.buyCurrency ?? undefined,
                  sellAmount: cls.sellAmount ?? undefined,
                  sellCurrency: cls.sellCurrency ?? undefined,
                  fee: cls.fee ?? undefined,
                  feeCurrency: cls.feeCurrency ?? undefined,
                  priceSource: "FTSO" as const, // default; price-fetch worker will update
                  modelChoice: cls.modelChoice ?? undefined,
                  isManual: false,
                  comment: cls.comment,
                })),
              });
            }
          });

          // ---------------------------------------------------------------
          // 4d. Queue price-fetch jobs for each unique token/timestamp
          // ---------------------------------------------------------------
          const priceFetchKeys = new Set<string>();
          const legs = extractTokenMovements(
            decodedEvents,
            walletAddress,
            "", // transactionId not needed here, we just need token info
          );

          for (const leg of legs) {
            const key = `${leg.tokenSymbol}-${tx.blockTimestamp}`;
            if (!priceFetchKeys.has(key)) {
              priceFetchKeys.add(key);
              try {
                await addPriceFetchJob(
                  leg.tokenSymbol,
                  leg.tokenAddress,
                  chainId,
                  tx.blockTimestamp,
                );
                totalPriceJobsQueued++;
              } catch (priceJobError) {
                console.warn(
                  `[wallet-sync] Failed to queue price fetch for ${leg.tokenSymbol} at ${tx.blockTimestamp}: ${
                    priceJobError instanceof Error
                      ? priceJobError.message
                      : String(priceJobError)
                  }`,
                );
              }
            }
          }

          totalTxProcessed++;
        } catch (dbError) {
          const msg =
            dbError instanceof Error ? dbError.message : String(dbError);
          console.error(
            `[wallet-sync] DB error persisting tx ${tx.txHash}: ${msg}`,
          );
          // Continue processing remaining transactions
        }
      }

      currentFrom = currentTo + 1;
    }

    // ---------------------------------------------------------------------
    // 5. Update wallet with final sync state
    // ---------------------------------------------------------------------
    await prisma.wallet.update({
      where: { id: walletId },
      data: {
        syncStatus: "COMPLETED",
        lastSyncAt: new Date(),
        lastSyncBlock: BigInt(toBlock),
      },
    });

    // Final progress report
    if (typeof job.updateProgress === "function") {
      await job.updateProgress({
        currentBlock: toBlock,
        toBlock,
        percentage: 100,
        txProcessed: totalTxProcessed,
      });
    }

    console.log(
      `[wallet-sync] Completed sync for ${walletAddress}: ` +
        `${totalTxProcessed} TX processed, ${totalEventsDecoded} events decoded, ` +
        `${totalPriceJobsQueued} price jobs queued`,
    );
  } catch (error) {
    // -----------------------------------------------------------------
    // 6. Error handling -- set wallet sync status to ERROR
    // -----------------------------------------------------------------
    try {
      await prisma.wallet.update({
        where: { id: walletId },
        data: { syncStatus: "ERROR" },
      });
    } catch (updateError) {
      console.error(
        `[wallet-sync] Failed to set ERROR status for wallet ${walletId}: ${
          updateError instanceof Error
            ? updateError.message
            : String(updateError)
        }`,
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error during wallet sync";
    console.error(`[wallet-sync] Sync failed for ${walletAddress}: ${message}`);

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
