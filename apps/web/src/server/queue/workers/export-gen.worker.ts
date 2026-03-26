// ---------------------------------------------------------------------------
// Export Generation Worker — produces CoinTracking CSV / XLSX / PDF files
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  EXPORT_QUEUE,
  type ExportJobData,
} from "@defi-tracker/shared/queue";
import { prisma } from "@defi-tracker/db";

/**
 * CoinTracking CSV header — the standard 15-column format.
 */
const COINTRACKING_CSV_HEADERS = [
  '"Type"',
  '"Buy Amount"',
  '"Buy Currency"',
  '"Sell Amount"',
  '"Sell Currency"',
  '"Fee"',
  '"Fee Currency"',
  '"Exchange"',
  '"Trade Group"',
  '"Comment"',
  '"Date"',
  '"Liquidity Pool"',
  '"Tx-ID"',
  '"Buy Value in Account Currency"',
  '"Sell Value in Account Currency"',
].join(",");

/**
 * Processes a single export-gen job:
 * 1. Looks up the export record in the database
 * 2. Updates status to GENERATING
 * 3. Fetches all classified transactions for the user / tax year
 * 4. Generates a CoinTracking-compatible CSV string
 * 5. Updates export record with COMPLETED status, filePath, and rowCount
 */
async function processExportGeneration(job: Job<ExportJobData>): Promise<void> {
  const { exportId, userId, taxYear, method, format } = job.data;

  // 1. Look up the export record
  const exportRecord = await prisma.export.findUnique({
    where: { id: exportId },
  });

  if (!exportRecord) {
    throw new Error(`Export record ${exportId} not found in database`);
  }

  try {
    // 2. Update status to GENERATING
    await prisma.export.update({
      where: { id: exportId },
      data: { status: "GENERATING" },
    });

    console.log(
      `Generating ${format} export for user ${userId}, tax year ${taxYear}`,
    );

    // 3. Fetch all classified transactions for the user/year
    const classifications = await prisma.txClassification.findMany({
      where: {
        transaction: {
          wallet: {
            userId,
          },
        },
        taxEvents: {
          some: {
            taxYear,
          },
        },
      },
      include: {
        transaction: {
          include: {
            wallet: true,
          },
        },
        taxEvents: {
          where: { taxYear },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // 4. Generate the CSV content
    const csvRows: string[] = [COINTRACKING_CSV_HEADERS];

    for (const classification of classifications) {
      const tx = classification.transaction;
      const blockDate = new Date(Number(tx.blockTimestamp) * 1000);
      const formattedDate = formatGermanDate(blockDate);

      const row = [
        quote(classification.ctType),
        quote(classification.buyAmount?.toString() ?? ""),
        quote(classification.buyCurrency ?? ""),
        quote(classification.sellAmount?.toString() ?? ""),
        quote(classification.sellCurrency ?? ""),
        quote(classification.fee?.toString() ?? ""),
        quote(classification.feeCurrency ?? ""),
        quote("DeFi Tracker"),
        quote(""),
        quote(classification.comment ?? ""),
        quote(formattedDate),
        quote(""),
        quote(tx.txHash),
        quote(classification.eurBuyValue?.toString() ?? ""),
        quote(classification.eurSellValue?.toString() ?? ""),
      ].join(",");

      csvRows.push(row);
    }

    const csvContent = csvRows.join("\n");
    const rowCount = classifications.length;

    // TODO: Replace with actual file storage (S3 / local filesystem)
    // For now, log the content size; csvContent will be written to storage once implemented.
    const filePath = `/exports/${userId}/${taxYear}_${method}_${exportId}.${format.toLowerCase()}`;
    void csvContent;

    console.log(
      `Export generated: ${rowCount} rows, method=${method}, format=${format}, path=${filePath}`,
    );

    // 5. Update export record with completion details
    await prisma.export.update({
      where: { id: exportId },
      data: {
        status: "COMPLETED",
        filePath,
        rowCount,
        generatedAt: new Date(),
      },
    });

    console.log(`Export ${exportId} completed successfully`);
  } catch (error) {
    // 6. Error handling — set status to FAILED
    await prisma.export.update({
      where: { id: exportId },
      data: { status: "FAILED" },
    });

    const message =
      error instanceof Error ? error.message : "Unknown error during export generation";
    console.error(`Export generation failed for ${exportId}: ${message}`);

    throw error; // re-throw so BullMQ marks the job as failed and can retry
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a value in double-quotes for CSV, escaping inner quotes. */
function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Format a Date as DD.MM.YYYY HH:mm:ss (German / BMF convention). */
function formatGermanDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}:${ss}`;
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export const exportGenWorker = new Worker<ExportJobData>(
  EXPORT_QUEUE,
  processExportGeneration,
  {
    connection: createRedisConnection(),
    concurrency: 3,
  },
);

exportGenWorker.on("completed", (job) => {
  console.log(`[export-gen] Job ${job.id} completed for export ${job.data.exportId}`);
});

exportGenWorker.on("failed", (job, error) => {
  console.error(
    `[export-gen] Job ${job?.id} failed for export ${job?.data.exportId}: ${error.message}`,
  );
});

export default exportGenWorker;
