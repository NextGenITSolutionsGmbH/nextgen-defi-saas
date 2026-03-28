// ---------------------------------------------------------------------------
// Unit tests for the Export Generation Worker
// All external dependencies (Prisma, export generators, storage, PDF
// converter, email) are fully mocked.
// ---------------------------------------------------------------------------

/**
 * @spec EP-07 — Export generation (CSV, XLSX, PDF)
 * @spec NFR-S09 — GoBD audit chain integration for exports
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — variables available inside vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockExport,
  mockTxClassification,
  mockAuditLog,
  mockUser,
  mockGenerateCoinTrackingCsvBuffer,
  mockGenerateCoinTrackingXlsxBuffer,
  mockComputeFileHash,
  mockCreateExportAuditEntry,
  mockGenerateTaxReportHtml,
  mockFormatDecimalDE,
  mockFormatDateCT,
  mockWriteExportFile,
  mockConvertHtmlToPdf,
} = vi.hoisted(() => ({
  mockExport: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockTxClassification: {
    findMany: vi.fn(),
  },
  mockAuditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  mockUser: {
    findUnique: vi.fn(),
  },
  mockGenerateCoinTrackingCsvBuffer: vi.fn(),
  mockGenerateCoinTrackingXlsxBuffer: vi.fn(),
  mockComputeFileHash: vi.fn(),
  mockCreateExportAuditEntry: vi.fn(),
  mockGenerateTaxReportHtml: vi.fn(),
  mockFormatDecimalDE: vi.fn().mockImplementation((val: string) => val.replace(".", ",")),
  mockFormatDateCT: vi.fn().mockReturnValue("01.01.2025 00:00:00"),
  mockWriteExportFile: vi.fn(),
  mockConvertHtmlToPdf: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

vi.mock("@defi-tracker/shared/queue", () => ({
  createRedisConnection: vi.fn(),
  EXPORT_QUEUE: "export-gen",
}));

vi.mock("@defi-tracker/db", () => ({
  prisma: {
    export: mockExport,
    txClassification: mockTxClassification,
    auditLog: mockAuditLog,
    user: mockUser,
  },
}));

vi.mock("@defi-tracker/shared", () => ({
  generateCoinTrackingCsvBuffer: (...args: unknown[]) =>
    mockGenerateCoinTrackingCsvBuffer(...args),
  generateCoinTrackingXlsxBuffer: (...args: unknown[]) =>
    mockGenerateCoinTrackingXlsxBuffer(...args),
  computeFileHash: (...args: unknown[]) => mockComputeFileHash(...args),
  createExportAuditEntry: (...args: unknown[]) => mockCreateExportAuditEntry(...args),
  generateTaxReportHtml: (...args: unknown[]) => mockGenerateTaxReportHtml(...args),
  formatDecimalDE: (...args: unknown[]) => mockFormatDecimalDE(...args),
  formatDateCT: (...args: unknown[]) => mockFormatDateCT(...args),
}));

vi.mock("../../../../lib/storage", () => ({
  writeExportFile: (...args: unknown[]) => mockWriteExportFile(...args),
}));

vi.mock("../../../../lib/pdf-converter", () => ({
  convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}));

vi.mock("../../index", () => ({
  addEmailJob: vi.fn().mockResolvedValue("email-job-1"),
}));

vi.mock("@/lib/email-templates", () => ({
  exportCompletedEmail: vi.fn().mockReturnValue({
    subject: "Export Complete",
    html: "<p>Done</p>",
  }),
}));

// ---------------------------------------------------------------------------
// Import the worker and capture the processor
// ---------------------------------------------------------------------------

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { ExportJobData } from "@defi-tracker/shared/queue";

import "../export-gen.worker";

const workerCalls = (Worker as unknown as Mock).mock.calls;
const processExportGeneration: (job: Job<ExportJobData>) => Promise<void> =
  workerCalls[workerCalls.length - 1][1];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createMockJob(data: ExportJobData): Job<ExportJobData> {
  return {
    id: "export-job-1",
    data,
    updateProgress: vi.fn(),
  } as unknown as Job<ExportJobData>;
}

const baseExportData: ExportJobData = {
  exportId: "export-abc",
  userId: "user-123",
  taxYear: 2025,
  method: "FIFO",
  format: "CSV",
};

/** Sample classification row returned by Prisma */
function sampleClassification(overrides = {}) {
  return {
    id: "cls-1",
    ctType: "Trade",
    buyAmount: 100.5,
    buyCurrency: "FLR",
    sellAmount: 50.25,
    sellCurrency: "USDT",
    fee: 0.01,
    feeCurrency: "FLR",
    eurBuyValue: 4.2,
    eurSellValue: 2.1,
    comment: "Auto-classified trade",
    modelChoice: null,
    transaction: {
      txHash: "0xtx1",
      blockTimestamp: BigInt(1704067200), // 2024-01-01 00:00:00 UTC
      protocol: "SparkDEX",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("export-gen worker — processExportGeneration [EP-07, NFR-S09]", () => {
  // -----------------------------------------------------------------------
  // Export record not found
  // -----------------------------------------------------------------------

  it("throws when the export record is not found", async () => {
    mockExport.findUnique.mockResolvedValue(null);

    const job = createMockJob(baseExportData);
    await expect(processExportGeneration(job)).rejects.toThrow(
      "Export record export-abc not found in database",
    );
  });

  // -----------------------------------------------------------------------
  // CSV happy path
  // -----------------------------------------------------------------------

  it("generates a CSV export end-to-end with correct status lifecycle", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-abc", status: "PENDING" });
    mockExport.update.mockResolvedValue({});

    mockTxClassification.findMany.mockResolvedValue([sampleClassification()]);

    const csvBuffer = Buffer.from("Type;Buy Amount;...\nTrade;100,5;...\n");
    mockGenerateCoinTrackingCsvBuffer.mockReturnValue(csvBuffer);
    mockComputeFileHash.mockReturnValue("abc123sha256hash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/2025_FIFO_export-abc.csv");

    mockAuditLog.findFirst.mockResolvedValue({ sha256Hash: "prevhash123" });
    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-abc",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "2025_FIFO_export-abc.csv",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "newhash456",
      prevHash: "prevhash123",
    });
    mockAuditLog.create.mockResolvedValue({});

    mockUser.findUnique.mockResolvedValue({ email: "user@example.com" });

    const job = createMockJob(baseExportData);
    await processExportGeneration(job);

    // Status was set to GENERATING first
    expect(mockExport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "export-abc" },
        data: { status: "GENERATING" },
      }),
    );

    // CSV generator was called with mapped rows
    expect(mockGenerateCoinTrackingCsvBuffer).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Trade",
          exchange: "DeFi Tracker",
          txId: "0xtx1",
        }),
      ]),
    );

    // File hash was computed
    expect(mockComputeFileHash).toHaveBeenCalledWith(csvBuffer);

    // File was written
    expect(mockWriteExportFile).toHaveBeenCalledWith(
      "user-123",
      "2025_FIFO_export-abc.csv",
      csvBuffer,
    );

    // Audit log created
    expect(mockAuditLog.create).toHaveBeenCalled();

    // Final status: COMPLETED with filePath, fileHash, rowCount
    const completedCall = mockExport.update.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { status: string } }).data.status === "COMPLETED",
    );
    expect(completedCall).toBeDefined();
    expect(completedCall![0].data).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        filePath: "/data/exports/user-123/2025_FIFO_export-abc.csv",
        fileHash: "abc123sha256hash",
        rowCount: 1,
      }),
    );
  });

  // -----------------------------------------------------------------------
  // XLSX generation
  // -----------------------------------------------------------------------

  it("generates an XLSX export using generateCoinTrackingXlsxBuffer", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-xlsx", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([sampleClassification()]);

    const xlsxBuffer = Buffer.from("xlsx-binary-data");
    mockGenerateCoinTrackingXlsxBuffer.mockResolvedValue(xlsxBuffer);
    mockComputeFileHash.mockReturnValue("xlsxhash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/2025_FIFO_export-xlsx.xlsx");

    mockAuditLog.findFirst.mockResolvedValue(null);
    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-xlsx",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "file.xlsx",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "hash",
      prevHash: null,
    });
    mockAuditLog.create.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue(null);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-xlsx",
      format: "XLSX",
    });
    await processExportGeneration(job);

    expect(mockGenerateCoinTrackingXlsxBuffer).toHaveBeenCalled();
    expect(mockWriteExportFile).toHaveBeenCalledWith(
      "user-123",
      "2025_FIFO_export-xlsx.xlsx",
      xlsxBuffer,
    );
  });

  // -----------------------------------------------------------------------
  // PDF generation
  // -----------------------------------------------------------------------

  it("generates a PDF export using generateTaxReportHtml + convertHtmlToPdf", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-pdf", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([sampleClassification()]);

    mockGenerateTaxReportHtml.mockReturnValue("<html>Tax Report</html>");
    const pdfBuffer = Buffer.from("pdf-binary-data");
    mockConvertHtmlToPdf.mockResolvedValue(pdfBuffer);
    mockComputeFileHash.mockReturnValue("pdfhash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/2025_FIFO_export-pdf.pdf");

    mockAuditLog.findFirst.mockResolvedValue(null);
    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-pdf",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "file.pdf",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "hash",
      prevHash: null,
    });
    mockAuditLog.create.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue(null);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-pdf",
      format: "PDF",
    });
    await processExportGeneration(job);

    expect(mockGenerateTaxReportHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        taxYear: 2025,
        method: "FIFO",
        totalTransactions: 1,
      }),
    );
    expect(mockConvertHtmlToPdf).toHaveBeenCalledWith("<html>Tax Report</html>");
    expect(mockWriteExportFile).toHaveBeenCalledWith(
      "user-123",
      "2025_FIFO_export-pdf.pdf",
      pdfBuffer,
    );
  });

  // -----------------------------------------------------------------------
  // Error handling -> FAILED status
  // -----------------------------------------------------------------------

  it("sets export status to FAILED on error and re-throws", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-fail", status: "PENDING" });
    mockExport.update.mockResolvedValue({});

    mockTxClassification.findMany.mockRejectedValue(
      new Error("DB connection lost"),
    );

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-fail",
    });

    await expect(processExportGeneration(job)).rejects.toThrow("DB connection lost");

    // Status was set to FAILED
    const failedCall = mockExport.update.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { status: string } }).data.status === "FAILED",
    );
    expect(failedCall).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // GoBD audit chain — uses previous hash
  // -----------------------------------------------------------------------

  it("passes the previous audit log hash to createExportAuditEntry", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-gobd", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([]);

    const csvBuffer = Buffer.from("");
    mockGenerateCoinTrackingCsvBuffer.mockReturnValue(csvBuffer);
    mockComputeFileHash.mockReturnValue("filehash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/2025_FIFO_export-gobd.csv");

    mockAuditLog.findFirst.mockResolvedValue({
      sha256Hash: "previous-chain-hash-abc123",
    });

    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-gobd",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "file.csv",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "new-hash",
      prevHash: "previous-chain-hash-abc123",
    });
    mockAuditLog.create.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue(null);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-gobd",
    });
    await processExportGeneration(job);

    expect(mockCreateExportAuditEntry).toHaveBeenCalledWith(
      "export-gobd",
      "user-123",
      "CSV",
      0,
      "filehash",
      "previous-chain-hash-abc123",
    );
  });

  // -----------------------------------------------------------------------
  // GoBD audit chain — no previous hash (first entry)
  // -----------------------------------------------------------------------

  it("passes undefined as prevHash when no previous audit log exists", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-first", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([]);

    const csvBuffer = Buffer.from("");
    mockGenerateCoinTrackingCsvBuffer.mockReturnValue(csvBuffer);
    mockComputeFileHash.mockReturnValue("firsthash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/2025_FIFO_export-first.csv");

    mockAuditLog.findFirst.mockResolvedValue(null);

    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-first",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "file.csv",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "hash",
      prevHash: null,
    });
    mockAuditLog.create.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue(null);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-first",
    });
    await processExportGeneration(job);

    expect(mockCreateExportAuditEntry).toHaveBeenCalledWith(
      "export-first",
      "user-123",
      "CSV",
      0,
      "firsthash",
      undefined,
    );
  });

  // -----------------------------------------------------------------------
  // Rows are correctly mapped from classifications
  // -----------------------------------------------------------------------

  it("maps classification fields to CoinTrackingCsvRow format", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-map", status: "PENDING" });
    mockExport.update.mockResolvedValue({});

    mockTxClassification.findMany.mockResolvedValue([
      sampleClassification({
        buyAmount: 250.75,
        buyCurrency: "WFLR",
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        eurBuyValue: 10.5,
        eurSellValue: null,
        comment: "Staking reward",
      }),
    ]);

    let capturedRows: unknown[] = [];
    mockGenerateCoinTrackingCsvBuffer.mockImplementation((rows: unknown[]) => {
      capturedRows = rows;
      return Buffer.from("csv");
    });
    mockComputeFileHash.mockReturnValue("hash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/file.csv");
    mockAuditLog.findFirst.mockResolvedValue(null);
    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-map",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "file.csv",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "hash",
      prevHash: null,
    });
    mockAuditLog.create.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue(null);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-map",
    });
    await processExportGeneration(job);

    expect(capturedRows).toHaveLength(1);
    expect(capturedRows[0]).toEqual(
      expect.objectContaining({
        type: "Trade",
        buyCurrency: "WFLR",
        sellAmount: null,
        sellCurrency: null,
        fee: null,
        feeCurrency: null,
        exchange: "DeFi Tracker",
        comment: "Staking reward",
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Empty classification list produces zero-row export
  // -----------------------------------------------------------------------

  it("produces a valid export with zero rows when no classifications exist", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-empty", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([]);

    mockGenerateCoinTrackingCsvBuffer.mockReturnValue(Buffer.from("header\n"));
    mockComputeFileHash.mockReturnValue("emptyhash");
    mockWriteExportFile.mockReturnValue("/data/exports/user-123/empty.csv");
    mockAuditLog.findFirst.mockResolvedValue(null);
    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-empty",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "empty.csv",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "hash",
      prevHash: null,
    });
    mockAuditLog.create.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue(null);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-empty",
    });
    await processExportGeneration(job);

    expect(mockGenerateCoinTrackingCsvBuffer).toHaveBeenCalledWith([]);

    const completedCall = mockExport.update.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { status: string } }).data.status === "COMPLETED",
    );
    expect(completedCall![0].data.rowCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Email notification queued on success
  // -----------------------------------------------------------------------

  it("queues an email notification on successful export", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-email", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([]);

    mockGenerateCoinTrackingCsvBuffer.mockReturnValue(Buffer.from(""));
    mockComputeFileHash.mockReturnValue("hash");
    mockWriteExportFile.mockReturnValue("/path");
    mockAuditLog.findFirst.mockResolvedValue(null);
    mockCreateExportAuditEntry.mockReturnValue({
      entityType: "export",
      entityId: "export-email",
      action: "export",
      fieldChanged: "file",
      oldValue: null,
      newValue: "f.csv",
      changedBy: "user-123",
      changedAt: new Date(),
      sha256Hash: "h",
      prevHash: null,
    });
    mockAuditLog.create.mockResolvedValue({});

    mockUser.findUnique.mockResolvedValue({ email: "user@example.com" });

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-email",
    });
    await processExportGeneration(job);

    expect(mockUser.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: { email: true },
    });
  });

  // -----------------------------------------------------------------------
  // Unsupported format throws
  // -----------------------------------------------------------------------

  it("throws for an unsupported export format", async () => {
    mockExport.findUnique.mockResolvedValue({ id: "export-bad", status: "PENDING" });
    mockExport.update.mockResolvedValue({});
    mockTxClassification.findMany.mockResolvedValue([]);

    const job = createMockJob({
      ...baseExportData,
      exportId: "export-bad",
      format: "XML" as ExportJobData["format"],
    });

    await expect(processExportGeneration(job)).rejects.toThrow(
      "Unsupported export format: XML",
    );

    const failedCall = mockExport.update.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { status: string } }).data.status === "FAILED",
    );
    expect(failedCall).toBeDefined();
  });
});
