// ---------------------------------------------------------------------------
// GoBD-compliant Audit Log with SHA-256 Hash Chain
// Per Section 147 AO and BMF-Schreiben 28.11.2019
// Hash chain ensures immutability and tamper detection
//
// @spec NFR-S09, NFR-C04 — GoBD SHA-256 hash chain audit log (§147 AO)
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';

/**
 * A single audit log entry with hash-chain linkage.
 * The sha256Hash field is computed from the entry's payload concatenated
 * with the previous entry's hash, forming a tamper-evident chain.
 */
export interface AuditLogEntry {
  /** Entity type: 'transaction', 'classification', 'export', 'price' */
  entityType: string;
  /** Entity identifier (e.g., transaction ID, export ID) */
  entityId: string;
  /** Action performed: 'create', 'update', 'classify', 'export', 'price_fetch' */
  action: string;
  /** Name of the field that was changed, or null for non-update actions */
  fieldChanged: string | null;
  /** Previous value of the field, or null */
  oldValue: string | null;
  /** New value of the field, or null */
  newValue: string | null;
  /** User ID of the person who made the change */
  changedBy: string;
  /** Timestamp of the change */
  changedAt: Date;
  /** SHA-256 hash of this entry's payload (hex-encoded) */
  sha256Hash: string;
  /** SHA-256 hash of the previous entry, or null for the first entry in the chain */
  prevHash: string | null;
}

/**
 * Computes the SHA-256 hash for an audit log entry.
 *
 * The hash is computed by concatenating (with pipe separator):
 *   prevHash | entityType | entityId | action | fieldChanged | oldValue | newValue | changedBy | changedAt (ISO 8601)
 *
 * Null values are represented as the string "null" in the concatenation.
 *
 * @param entry - The audit log entry (without sha256Hash)
 * @param prevHash - The SHA-256 hash of the previous entry, or null for the first entry
 * @returns Hex-encoded SHA-256 hash string
 */
export function computeAuditHash(
  entry: Omit<AuditLogEntry, 'sha256Hash'>,
  prevHash: string | null,
): string {
  const parts: string[] = [
    prevHash ?? 'null',
    entry.entityType,
    entry.entityId,
    entry.action,
    entry.fieldChanged ?? 'null',
    entry.oldValue ?? 'null',
    entry.newValue ?? 'null',
    entry.changedBy,
    entry.changedAt.toISOString(),
  ];

  const payload = parts.join('|');
  return createHash('sha256').update(payload, 'utf-8').digest('hex');
}

/**
 * Creates a complete audit log entry with computed SHA-256 hash.
 *
 * @param params - Entry parameters
 * @param params.entityType - Entity type (e.g., 'transaction', 'classification')
 * @param params.entityId - Entity identifier
 * @param params.action - Action performed (e.g., 'create', 'update', 'classify')
 * @param params.fieldChanged - Optional field name that changed
 * @param params.oldValue - Optional previous value
 * @param params.newValue - Optional new value
 * @param params.changedBy - User ID who made the change
 * @param params.prevHash - Optional hash of the previous audit entry
 * @returns Complete AuditLogEntry with computed sha256Hash
 */
export function createAuditLogEntry(params: {
  entityType: string;
  entityId: string;
  action: string;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy: string;
  prevHash?: string | null;
}): AuditLogEntry {
  const now = new Date();

  const entry: Omit<AuditLogEntry, 'sha256Hash'> = {
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    fieldChanged: params.fieldChanged ?? null,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    changedBy: params.changedBy,
    changedAt: now,
    prevHash: params.prevHash ?? null,
  };

  const sha256Hash = computeAuditHash(entry, entry.prevHash);

  return {
    ...entry,
    sha256Hash,
  };
}

/**
 * Verifies the integrity of an audit log hash chain.
 *
 * For each entry in the chain:
 * - Entry 0: prevHash should be null, sha256Hash should match computeAuditHash(entry, null)
 * - Entry N: prevHash should equal entries[N-1].sha256Hash, sha256Hash should match
 *
 * @param entries - Ordered array of audit log entries (oldest first)
 * @returns Object with valid=true if chain is intact, or brokenAt=index where it breaks
 */
export function verifyAuditChain(
  entries: AuditLogEntry[],
): { valid: boolean; brokenAt: number | null } {
  if (entries.length === 0) {
    return { valid: true, brokenAt: null };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? null : entries[i - 1].sha256Hash;

    // Verify the prevHash linkage
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAt: i };
    }

    // Recompute the hash and verify it matches
    const computedHash = computeAuditHash(entry, expectedPrevHash);
    if (entry.sha256Hash !== computedHash) {
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true, brokenAt: null };
}

/**
 * Convenience function to create an audit log entry for export operations.
 *
 * @param exportId - The export job identifier
 * @param userId - The user who initiated the export
 * @param format - Export format (CSV, XLSX, PDF)
 * @param rowCount - Number of rows in the export
 * @param fileHash - SHA-256 hash of the exported file content
 * @param prevHash - Optional hash of the previous audit entry
 * @returns Complete AuditLogEntry for the export action
 */
export function createExportAuditEntry(
  exportId: string,
  userId: string,
  format: string,
  rowCount: number,
  fileHash: string,
  prevHash?: string,
): AuditLogEntry {
  return createAuditLogEntry({
    entityType: 'export',
    entityId: exportId,
    action: 'export',
    fieldChanged: 'file',
    oldValue: null,
    newValue: JSON.stringify({ format, rowCount, fileHash }),
    changedBy: userId,
    prevHash: prevHash ?? null,
  });
}

/**
 * Computes the SHA-256 hash of file content for export verification.
 * This hash is stored in the audit log to verify export file integrity.
 *
 * @param content - File content as string or Buffer
 * @returns Hex-encoded SHA-256 hash string
 */
export function computeFileHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
