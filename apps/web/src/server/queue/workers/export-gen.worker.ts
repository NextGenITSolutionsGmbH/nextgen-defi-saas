// ---------------------------------------------------------------------------
// Export Generation Worker — produces CoinTracking CSV / XLSX / PDF files
// Uses shared export modules for CSV generation, file hashing, and audit logging.
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  EXPORT_QUEUE,
  type ExportJobData,
} from "@defi-tracker/shared/queue";
import {
  generateCoinTrackingCsvBuffer,
  generateCoinTrackingXlsxBuffer,
  computeFileHash,
  createExportAuditEntry,
  generateTaxReportHtml,
  formatDecimalDE,
  formatDateCT,
  type CoinTrackingCsvRow,
  type TaxReportData,
} from "@defi-tracker/shared";
import { prisma } from "@defi-tracker/db";
import { writeExportFile } from "../../../lib/storage";
import { convertHtmlToPdf } from "../../../lib/pdf-converter";

/**
 * Processes a single export-gen job:
 * 1. Looks up the export record in the database
 * 2. Updates status to GENERATING
 * 3. Fetches all classified transactions for the user / tax year
 * 4. Maps classifications to CoinTrackingCsvRow format
 * 5. Generates file buffer (CSV / PDF / XLSX)
 * 6. Computes SHA-256 file hash for GoBD integrity
 * 7. Writes file to local storage
 * 8. Creates audit log entry
 * 9. Updates export record with COMPLETED status, filePath, fileHash, and rowCount
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
      `[export-gen] Generating ${format} export for user ${userId}, tax year ${taxYear}, method ${method}`,
    );

    // 3. Fetch all classified transactions for the user/year
    //    Filter by blockTimestamp falling within the tax year boundaries
    const yearStart = BigInt(Math.floor(new Date(`${taxYear}-01-01T00:00:00Z`).getTime() / 1000));
    const yearEnd = BigInt(Math.floor(new Date(`${taxYear + 1}-01-01T00:00:00Z`).getTime() / 1000));

    const classifications = await prisma.txClassification.findMany({
      where: {
        transaction: {
          wallet: {
            userId,
          },
          blockTimestamp: {
            gte: yearStart,
            lt: yearEnd,
          },
        },
      },
      include: {
        transaction: {
          select: {
            txHash: true,
            blockTimestamp: true,
            protocol: true,
          },
        },
      },
      orderBy: {
        transaction: {
          blockTimestamp: "asc",
        },
      },
    });

    // 4. Map each classification to a CoinTrackingCsvRow
    const rows: CoinTrackingCsvRow[] = classifications.map((classification) => {
      const tx = classification.transaction;

      return {
        type: classification.ctType,
        buyAmount: classification.buyAmount != null
          ? formatDecimalDE(classification.buyAmount.toString())
          : null,
        buyCurrency: classification.buyCurrency ?? null,
        sellAmount: classification.sellAmount != null
          ? formatDecimalDE(classification.sellAmount.toString())
          : null,
        sellCurrency: classification.sellCurrency ?? null,
        fee: classification.fee != null
          ? formatDecimalDE(classification.fee.toString())
          : null,
        feeCurrency: classification.feeCurrency ?? null,
        exchange: "DeFi Tracker",
        tradeGroup: "",
        comment: classification.comment ?? "",
        date: formatDateCT(Number(tx.blockTimestamp)),
        liquidityPool: null,
        txId: tx.txHash,
        buyValueInAccountCurrency: classification.eurBuyValue != null
          ? formatDecimalDE(classification.eurBuyValue.toString())
          : null,
        sellValueInAccountCurrency: classification.eurSellValue != null
          ? formatDecimalDE(classification.eurSellValue.toString())
          : null,
      };
    });

    const rowCount = rows.length;

    // 5. Generate the file buffer based on format
    let buffer: Buffer;
    let fileExtension: string;

    switch (format) {
      case "CSV": {
        buffer = generateCoinTrackingCsvBuffer(rows);
        fileExtension = "csv";
        break;
      }

      case "PDF": {
        // Generate HTML report and convert to PDF via Playwright
        const reportData: TaxReportData = {
          userName: userId, // Will be replaced with actual user name lookup
          taxYear,
          method,
          totalTransactions: rowCount,
          classifiedCount: rowCount,
          paragraph23Summary: {
            totalGainLossEur: "0,00",
            taxableCount: 0,
            taxFreeCount: 0,
          },
          paragraph22Nr3Summary: {
            totalIncomeEur: "0,00",
            stakingEur: "0,00",
            lpRewardsEur: "0,00",
            otherEur: "0,00",
          },
          freigrenzeStatus: {
            paragraph23: { used: 0, limit: 1000, remaining: 1000, status: "GREEN" },
            paragraph22Nr3: { used: 0, limit: 256, remaining: 256, status: "GREEN" },
          },
          haltefristEntries: [],
          exportDate: formatDateCT(Math.floor(Date.now() / 1000)),
          disclaimer:
            "Dieses Dokument ersetzt keine professionelle Steuerberatung. Bitte konsultieren Sie einen Steuerberater.",
        };

        const htmlContent = generateTaxReportHtml(reportData);
        buffer = await convertHtmlToPdf(htmlContent);
        fileExtension = "pdf";
        break;
      }

      case "XLSX": {
        buffer = await generateCoinTrackingXlsxBuffer(rows);
        fileExtension = "xlsx";
        break;
      }

      default: {
        throw new Error(`Unsupported export format: ${format}`);
      }
    }

    // 6. Compute SHA-256 file hash for GoBD integrity verification
    const fileHash = computeFileHash(buffer);

    // 7. Write the file to local storage
    const filename = `${taxYear}_${method}_${exportId}.${fileExtension}`;
    const filePath = writeExportFile(userId, filename, buffer);

    console.log(
      `[export-gen] Export file written: ${filePath} (${rowCount} rows, hash=${fileHash.slice(0, 12)}...)`,
    );

    // 8. Create GoBD-compliant audit log entry
    const lastAuditLog = await prisma.auditLog.findFirst({
      orderBy: { id: "desc" },
      select: { sha256Hash: true },
    });

    const auditEntry = createExportAuditEntry(
      exportId,
      userId,
      format,
      rowCount,
      fileHash,
      lastAuditLog?.sha256Hash ?? undefined,
    );

    await prisma.auditLog.create({
      data: {
        entityType: auditEntry.entityType,
        entityId: auditEntry.entityId,
        action: auditEntry.action,
        fieldChanged: auditEntry.fieldChanged,
        oldValue: auditEntry.oldValue,
        newValue: auditEntry.newValue,
        changedBy: auditEntry.changedBy,
        changedAt: auditEntry.changedAt,
        sha256Hash: auditEntry.sha256Hash,
        prevHash: auditEntry.prevHash,
      },
    });

    // 9. Update export record with completion details
    await prisma.export.update({
      where: { id: exportId },
      data: {
        status: "COMPLETED",
        filePath,
        fileHash,
        rowCount,
        generatedAt: new Date(),
      },
    });

    console.log(
      `[export-gen] Export ${exportId} completed: ${rowCount} rows, format=${format}, method=${method}`,
    );

    // 10. Queue email notification for completed export
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) {
        const { addEmailJob } = await import("../index");
        const { exportCompletedEmail } = await import("@/lib/email-templates");
        const { subject, html } = exportCompletedEmail({
          userName: user.email,
          taxYear,
          format,
        });
        await addEmailJob(
          user.email,
          subject,
          html,
          userId,
          "EXPORT_COMPLETE",
        );
      }
    } catch (emailErr) {
      console.warn(`[export-gen] Failed to queue email notification:`, emailErr);
    }
  } catch (error) {
    // Error handling — set status to FAILED
    await prisma.export.update({
      where: { id: exportId },
      data: { status: "FAILED" },
    });

    const message =
      error instanceof Error ? error.message : "Unknown error during export generation";
    console.error(`[export-gen] Export generation failed for ${exportId}: ${message}`);

    throw error; // re-throw so BullMQ marks the job as failed and can retry
  }
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
