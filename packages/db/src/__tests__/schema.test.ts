import { describe, it, expect } from "vitest";
import { $Enums, Prisma } from "@prisma/client";

/**
 * Schema smoke-tests — verify that Prisma generated the expected
 * models, enums, and enum values so accidental schema drift is caught
 * before it reaches a real database migration.
 */

// --------------- Enum values -----------------

describe("PlanTier enum", () => {
  const values = Object.values($Enums.PlanTier ?? {});

  it("contains STARTER", () => {
    expect(values).toContain("STARTER");
  });

  it("contains PRO", () => {
    expect(values).toContain("PRO");
  });

  it("contains BUSINESS", () => {
    expect(values).toContain("BUSINESS");
  });

  it("contains KANZLEI", () => {
    expect(values).toContain("KANZLEI");
  });

  it("has exactly 4 tiers", () => {
    expect(values).toHaveLength(4);
  });
});

describe("SyncStatus enum", () => {
  const values = Object.values($Enums.SyncStatus ?? {});

  it("contains IDLE, SYNCING, COMPLETED, ERROR", () => {
    expect(values).toEqual(
      expect.arrayContaining(["IDLE", "SYNCING", "COMPLETED", "ERROR"]),
    );
  });

  it("has exactly 4 values", () => {
    expect(values).toHaveLength(4);
  });
});

describe("TxStatus enum", () => {
  const values = Object.values($Enums.TxStatus ?? {});

  it("contains GREEN, YELLOW, RED, GRAY", () => {
    expect(values).toEqual(
      expect.arrayContaining(["GREEN", "YELLOW", "RED", "GRAY"]),
    );
  });

  it("has exactly 4 values", () => {
    expect(values).toHaveLength(4);
  });
});

describe("Direction enum", () => {
  const values = Object.values($Enums.Direction ?? {});

  it("contains IN and OUT", () => {
    expect(values).toEqual(expect.arrayContaining(["IN", "OUT"]));
  });

  it("has exactly 2 values", () => {
    expect(values).toHaveLength(2);
  });
});

describe("PriceSource enum", () => {
  const values = Object.values($Enums.PriceSource ?? {});

  it("contains FTSO, COINGECKO, CMC, MANUAL", () => {
    expect(values).toEqual(
      expect.arrayContaining(["FTSO", "COINGECKO", "CMC", "MANUAL"]),
    );
  });

  it("has exactly 4 values", () => {
    expect(values).toHaveLength(4);
  });
});

describe("TaxMethod enum", () => {
  const values = Object.values($Enums.TaxMethod ?? {});

  it("contains FIFO, LIFO, HIFO", () => {
    expect(values).toEqual(
      expect.arrayContaining(["FIFO", "LIFO", "HIFO"]),
    );
  });

  it("has exactly 3 values", () => {
    expect(values).toHaveLength(3);
  });
});

describe("TaxEventType enum", () => {
  const values = Object.values($Enums.TaxEventType ?? {});

  it("contains PARAGRAPH_23 and PARAGRAPH_22_NR3", () => {
    expect(values).toEqual(
      expect.arrayContaining(["PARAGRAPH_23", "PARAGRAPH_22_NR3"]),
    );
  });

  it("has exactly 2 values", () => {
    expect(values).toHaveLength(2);
  });
});

describe("LotStatus enum", () => {
  const values = Object.values($Enums.LotStatus ?? {});

  it("contains OPEN, CLOSED, PARTIAL", () => {
    expect(values).toEqual(
      expect.arrayContaining(["OPEN", "CLOSED", "PARTIAL"]),
    );
  });

  it("has exactly 3 values", () => {
    expect(values).toHaveLength(3);
  });
});

describe("ExportFormat enum", () => {
  const values = Object.values($Enums.ExportFormat ?? {});

  it("contains CSV, XLSX, PDF", () => {
    expect(values).toEqual(
      expect.arrayContaining(["CSV", "XLSX", "PDF"]),
    );
  });

  it("has exactly 3 values", () => {
    expect(values).toHaveLength(3);
  });
});

describe("ExportStatus enum", () => {
  const values = Object.values($Enums.ExportStatus ?? {});

  it("contains PENDING, GENERATING, COMPLETED, FAILED", () => {
    expect(values).toEqual(
      expect.arrayContaining(["PENDING", "GENERATING", "COMPLETED", "FAILED"]),
    );
  });

  it("has exactly 4 values", () => {
    expect(values).toHaveLength(4);
  });
});

describe("SubStatus enum", () => {
  const values = Object.values($Enums.SubStatus ?? {});

  it("contains ACTIVE, CANCELED, PAST_DUE, TRIALING", () => {
    expect(values).toEqual(
      expect.arrayContaining(["ACTIVE", "CANCELED", "PAST_DUE", "TRIALING"]),
    );
  });

  it("has exactly 4 values", () => {
    expect(values).toHaveLength(4);
  });
});

describe("ModelChoice enum", () => {
  const values = Object.values($Enums.ModelChoice ?? {});

  it("contains MODEL_A and MODEL_B", () => {
    expect(values).toEqual(
      expect.arrayContaining(["MODEL_A", "MODEL_B"]),
    );
  });

  it("has exactly 2 values", () => {
    expect(values).toHaveLength(2);
  });
});

// --------------- Model existence ---------------

describe("Prisma model metadata", () => {
  const modelNames = Object.values(Prisma.ModelName);

  const expectedModels = [
    "User",
    "Wallet",
    "Transaction",
    "TxLeg",
    "TxClassification",
    "TokenPrice",
    "TaxLot",
    "TaxEvent",
    "AuditLog",
    "Export",
    "PriceAuditLog",
    "Subscription",
  ];

  it.each(expectedModels)("includes model %s", (model) => {
    expect(modelNames).toContain(model);
  });

  it("has the expected total number of models", () => {
    expect(modelNames.length).toBeGreaterThanOrEqual(expectedModels.length);
  });
});
