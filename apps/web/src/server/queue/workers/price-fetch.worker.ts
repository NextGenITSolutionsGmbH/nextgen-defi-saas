// ---------------------------------------------------------------------------
// Price Fetch Worker — retrieves EUR token prices with waterfall fallback
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  PRICE_FETCH_QUEUE,
  type PriceFetchJobData,
} from "@defi-tracker/shared/queue";
import { prisma } from "@defi-tracker/db";
import type { PriceSource } from "@defi-tracker/db";

/** Result of a price lookup attempt */
interface PriceLookupResult {
  eurPrice: number;
  source: PriceSource;
  sourceUrl: string | null;
  fallbackReason: string | null;
}

/**
 * Processes a single price-fetch job using waterfall fallback:
 *   FTSO -> CoinGecko -> CMC -> Manual
 *
 * 1. Logs the price lookup attempt
 * 2. Tries each source in order
 * 3. Stores result in TokenPrice table
 * 4. Creates a PriceAuditLog entry
 */
async function processPriceFetch(job: Job<PriceFetchJobData>): Promise<void> {
  const { tokenSymbol, tokenAddress, chainId, timestampUnix } = job.data;

  console.log(
    `Fetching EUR price for ${tokenSymbol} at timestamp ${timestampUnix}`,
  );

  // Check if we already have this price cached
  const existing = await prisma.tokenPrice.findFirst({
    where: {
      tokenSymbol,
      chainId,
      timestampUnix: BigInt(timestampUnix),
    },
  });

  if (existing) {
    console.log(
      `Price already cached for ${tokenSymbol} at ${timestampUnix}: ${existing.eurPrice} EUR (source: ${existing.source})`,
    );
    return;
  }

  let result: PriceLookupResult;
  let attemptedSource = "FTSO";

  try {
    // Attempt 1: FTSO (Flare Time Series Oracle)
    result = await fetchFromFTSO(tokenSymbol, chainId, timestampUnix);
    attemptedSource = "FTSO";
  } catch (ftsoError) {
    const ftsoReason =
      ftsoError instanceof Error ? ftsoError.message : "FTSO lookup failed";
    console.warn(`FTSO fallback for ${tokenSymbol}: ${ftsoReason}`);

    try {
      // Attempt 2: CoinGecko
      result = await fetchFromCoinGecko(tokenSymbol, timestampUnix);
      result.fallbackReason = ftsoReason;
      attemptedSource = "COINGECKO";
    } catch (cgError) {
      const cgReason =
        cgError instanceof Error ? cgError.message : "CoinGecko lookup failed";
      console.warn(`CoinGecko fallback for ${tokenSymbol}: ${cgReason}`);

      try {
        // Attempt 3: CoinMarketCap
        result = await fetchFromCMC(tokenSymbol, timestampUnix);
        result.fallbackReason = `FTSO: ${ftsoReason}; CoinGecko: ${cgReason}`;
        attemptedSource = "CMC";
      } catch (cmcError) {
        const cmcReason =
          cmcError instanceof Error ? cmcError.message : "CMC lookup failed";
        console.warn(`CMC fallback for ${tokenSymbol}: ${cmcReason}`);

        // Attempt 4: Manual fallback (zero price, flagged for review)
        result = {
          eurPrice: 0,
          source: "MANUAL",
          sourceUrl: null,
          fallbackReason: `FTSO: ${ftsoReason}; CoinGecko: ${cgReason}; CMC: ${cmcReason}`,
        };
        attemptedSource = "CMC";
      }
    }
  }

  // 3. Store the result in the TokenPrice table
  await prisma.tokenPrice.create({
    data: {
      tokenSymbol,
      tokenAddress,
      chainId,
      timestampUnix: BigInt(timestampUnix),
      eurPrice: result.eurPrice,
      source: result.source,
      sourceUrl: result.sourceUrl,
    },
  });

  // 4. Create a PriceAuditLog entry
  await prisma.priceAuditLog.create({
    data: {
      tokenSymbol,
      timestampUnix: BigInt(timestampUnix),
      attemptedSource,
      resultSource: result.source,
      eurPrice: result.eurPrice,
      fallbackReason: result.fallbackReason,
    },
  });

  console.log(
    `Price stored for ${tokenSymbol} at ${timestampUnix}: ${result.eurPrice} EUR (source: ${result.source})`,
  );
}

// ---------------------------------------------------------------------------
// Price source stubs (to be replaced with real API integrations)
// ---------------------------------------------------------------------------

async function fetchFromFTSO(
  tokenSymbol: string,
  chainId: number,
  timestampUnix: number,
): Promise<PriceLookupResult> {
  // TODO: Implement actual FTSO price oracle integration
  // The Flare Time Series Oracle provides on-chain price feeds
  // for native Flare ecosystem tokens.
  void tokenSymbol; void chainId; void timestampUnix;
  throw new Error("FTSO integration not yet implemented");
}

async function fetchFromCoinGecko(
  tokenSymbol: string,
  timestampUnix: number,
): Promise<PriceLookupResult> {
  // TODO: Implement CoinGecko API integration
  // GET https://api.coingecko.com/api/v3/coins/{id}/history?date={dd-mm-yyyy}
  void tokenSymbol; void timestampUnix;
  throw new Error("CoinGecko integration not yet implemented");
}

async function fetchFromCMC(
  tokenSymbol: string,
  timestampUnix: number,
): Promise<PriceLookupResult> {
  // TODO: Implement CoinMarketCap API integration
  // GET https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/historical
  void tokenSymbol; void timestampUnix;
  throw new Error("CMC integration not yet implemented");
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export const priceFetchWorker = new Worker<PriceFetchJobData>(
  PRICE_FETCH_QUEUE,
  processPriceFetch,
  {
    connection: createRedisConnection(),
    concurrency: 10,
    limiter: {
      max: 30,
      duration: 60_000, // max 30 price lookups per minute (API rate limits)
    },
  },
);

priceFetchWorker.on("completed", (job) => {
  console.log(
    `[price-fetch] Job ${job.id} completed for ${job.data.tokenSymbol} at ${job.data.timestampUnix}`,
  );
});

priceFetchWorker.on("failed", (job, error) => {
  console.error(
    `[price-fetch] Job ${job?.id} failed for ${job?.data.tokenSymbol}: ${error.message}`,
  );
});

export default priceFetchWorker;
