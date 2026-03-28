// ---------------------------------------------------------------------------
// Price Fetch Worker — retrieves EUR token prices with waterfall fallback
//
// @spec FR-05-01..FR-05-05, EP-05 — Background price fetch with waterfall fallback
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  PRICE_FETCH_QUEUE,
  type PriceFetchJobData,
} from "@defi-tracker/shared/queue";
import {
  getFtsoPrice,
  isFtsoSupported,
  getCoinGeckoPrice,
  isCoinGeckoSupported,
  getCmcPrice,
  isCmcSupported,
} from "@defi-tracker/shared";
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
// Price source implementations (4-tier waterfall: FTSO → CoinGecko → CMC → Manual)
// ---------------------------------------------------------------------------

async function fetchFromFTSO(
  tokenSymbol: string,
  _chainId: number,
  timestampUnix: number,
): Promise<PriceLookupResult> {
  if (!isFtsoSupported(tokenSymbol)) {
    throw new Error(`Token ${tokenSymbol} is not supported by FTSO`);
  }

  const rpcUrl = process.env.FLARE_RPC_URL ?? 'https://flare-api.flare.network/ext/C/rpc';
  const result = await getFtsoPrice(
    tokenSymbol,
    timestampUnix,
    rpcUrl,
  );

  if (!result) {
    throw new Error(`FTSO returned no price for ${tokenSymbol}`);
  }

  return {
    eurPrice: result.eurPrice,
    source: "FTSO",
    sourceUrl: "ftso://flare-mainnet",
    fallbackReason: null,
  };
}

async function fetchFromCoinGecko(
  tokenSymbol: string,
  timestampUnix: number,
): Promise<PriceLookupResult> {
  if (!isCoinGeckoSupported(tokenSymbol)) {
    throw new Error(`Token ${tokenSymbol} is not supported by CoinGecko`);
  }

  const result = await getCoinGeckoPrice(tokenSymbol, timestampUnix);

  if (!result) {
    throw new Error(`CoinGecko returned no price for ${tokenSymbol}`);
  }

  return {
    eurPrice: result.eurPrice,
    source: "COINGECKO",
    sourceUrl: "https://api.coingecko.com",
    fallbackReason: null,
  };
}

async function fetchFromCMC(
  tokenSymbol: string,
  timestampUnix: number,
): Promise<PriceLookupResult> {
  if (!isCmcSupported(tokenSymbol)) {
    throw new Error(`Token ${tokenSymbol} is not supported by CoinMarketCap`);
  }

  if (!process.env.CMC_API_KEY) {
    throw new Error("CMC_API_KEY environment variable is not set");
  }

  const result = await getCmcPrice(tokenSymbol, timestampUnix, process.env.CMC_API_KEY);

  if (!result) {
    throw new Error(`CMC returned no price for ${tokenSymbol}`);
  }

  return {
    eurPrice: result.eurPrice,
    source: "CMC",
    sourceUrl: "https://pro-api.coinmarketcap.com",
    fallbackReason: null,
  };
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
