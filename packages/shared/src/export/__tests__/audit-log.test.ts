import { describe, it, expect } from 'vitest';
import {
  computeAuditHash,
  createAuditLogEntry,
  verifyAuditChain,
  createExportAuditEntry,
  computeFileHash,
} from '../audit-log';
import type { AuditLogEntry } from '../audit-log';

describe('computeAuditHash', () => {
  it('should compute a 64-character hex hash', () => {
    const entry: Omit<AuditLogEntry, 'sha256Hash'> = {
      entityType: 'transaction',
      entityId: 'tx-1',
      action: 'create',
      fieldChanged: null,
      oldValue: null,
      newValue: 'test',
      changedBy: 'user-1',
      changedAt: new Date('2026-01-01T00:00:00Z'),
      prevHash: null,
    };

    const hash = computeAuditHash(entry, null);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should include all fields in hash computation', () => {
    const baseEntry: Omit<AuditLogEntry, 'sha256Hash'> = {
      entityType: 'transaction',
      entityId: 'tx-1',
      action: 'create',
      fieldChanged: null,
      oldValue: null,
      newValue: 'test',
      changedBy: 'user-1',
      changedAt: new Date('2026-01-01T00:00:00Z'),
      prevHash: null,
    };

    const base = computeAuditHash(baseEntry, null);

    // Changing any field should produce a different hash
    const diffId = computeAuditHash({ ...baseEntry, entityId: 'tx-2' }, null);
    const diffType = computeAuditHash({ ...baseEntry, entityType: 'export' }, null);
    const diffAction = computeAuditHash({ ...baseEntry, action: 'update' }, null);
    const diffBy = computeAuditHash({ ...baseEntry, changedBy: 'user-2' }, null);
    const diffTime = computeAuditHash(
      { ...baseEntry, changedAt: new Date('2026-01-02T00:00:00Z') },
      null,
    );

    expect(diffId).not.toBe(base);
    expect(diffType).not.toBe(base);
    expect(diffAction).not.toBe(base);
    expect(diffBy).not.toBe(base);
    expect(diffTime).not.toBe(base);
  });

  it('should incorporate prevHash for chaining', () => {
    const entry: Omit<AuditLogEntry, 'sha256Hash'> = {
      entityType: 'transaction',
      entityId: 'tx-1',
      action: 'create',
      fieldChanged: null,
      oldValue: null,
      newValue: null,
      changedBy: 'user-1',
      changedAt: new Date('2026-01-01T00:00:00Z'),
      prevHash: null,
    };

    const hashWithNull = computeAuditHash(entry, null);
    const hashWithPrev = computeAuditHash(
      { ...entry, prevHash: 'abc123' },
      'abc123',
    );
    expect(hashWithNull).not.toBe(hashWithPrev);
  });

  it('should produce consistent hashes for same input', () => {
    const entry: Omit<AuditLogEntry, 'sha256Hash'> = {
      entityType: 'transaction',
      entityId: 'tx-1',
      action: 'create',
      fieldChanged: null,
      oldValue: null,
      newValue: null,
      changedBy: 'user-1',
      changedAt: new Date('2026-01-01T00:00:00Z'),
      prevHash: null,
    };

    const hash1 = computeAuditHash(entry, null);
    const hash2 = computeAuditHash(entry, null);
    expect(hash1).toBe(hash2);
  });
});

describe('createAuditLogEntry', () => {
  it('should create an entry with computed sha256Hash', () => {
    const entry = createAuditLogEntry({
      entityType: 'export',
      entityId: 'exp-1',
      action: 'export',
      changedBy: 'user-1',
    });

    expect(entry.entityType).toBe('export');
    expect(entry.entityId).toBe('exp-1');
    expect(entry.action).toBe('export');
    expect(entry.changedBy).toBe('user-1');
    expect(entry.prevHash).toBeNull();
    expect(entry.fieldChanged).toBeNull();
    expect(entry.oldValue).toBeNull();
    expect(entry.newValue).toBeNull();
    expect(entry.sha256Hash).toHaveLength(64);
    expect(entry.changedAt).toBeInstanceOf(Date);
  });

  it('should chain hashes -- each entry includes previous hash', () => {
    const entry1 = createAuditLogEntry({
      entityType: 'transaction',
      entityId: 'tx-1',
      action: 'classify',
      changedBy: 'user-1',
    });

    const entry2 = createAuditLogEntry({
      entityType: 'export',
      entityId: 'exp-1',
      action: 'export',
      changedBy: 'user-1',
      prevHash: entry1.sha256Hash,
    });

    expect(entry2.prevHash).toBe(entry1.sha256Hash);
    expect(entry2.sha256Hash).not.toBe(entry1.sha256Hash);
  });

  it('should produce a verifiable hash', () => {
    const entry = createAuditLogEntry({
      entityType: 'export',
      entityId: 'exp-1',
      action: 'export',
      changedBy: 'user-1',
    });

    // Recompute and verify
    const expectedHash = computeAuditHash(entry, entry.prevHash);
    expect(entry.sha256Hash).toBe(expectedHash);
  });

  it('should set optional fields from params', () => {
    const entry = createAuditLogEntry({
      entityType: 'transaction',
      entityId: 'tx-1',
      action: 'update',
      fieldChanged: 'classification',
      oldValue: 'Trade',
      newValue: 'Staking',
      changedBy: 'user-1',
    });

    expect(entry.fieldChanged).toBe('classification');
    expect(entry.oldValue).toBe('Trade');
    expect(entry.newValue).toBe('Staking');
  });
});

describe('verifyAuditChain', () => {
  function buildChain(count: number): AuditLogEntry[] {
    const chain: AuditLogEntry[] = [];
    for (let i = 0; i < count; i++) {
      const prevHash = i === 0 ? undefined : chain[i - 1].sha256Hash;
      chain.push(
        createAuditLogEntry({
          entityType: 'transaction',
          entityId: `tx-${i + 1}`,
          action: `action_${i + 1}`,
          newValue: `{"step":${i + 1}}`,
          changedBy: 'user-1',
          prevHash,
        }),
      );
    }
    return chain;
  }

  it('should verify a valid single-entry chain', () => {
    const chain = buildChain(1);
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it('should verify a valid multi-entry chain', () => {
    const chain = buildChain(5);
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it('should verify an empty chain as valid', () => {
    const result = verifyAuditChain([]);
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it('should detect tampered entry hash', () => {
    const chain = buildChain(3);

    // Tamper with the second entry's hash
    chain[1] = {
      ...chain[1],
      sha256Hash: 'tampered_hash_value_000000000000000000000000000000000000000000000',
    };

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('should detect tampered entry fields', () => {
    const chain = buildChain(3);

    // Tamper with the second entry's action (hash won't match anymore)
    chain[1] = { ...chain[1], action: 'tampered_action' };

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('should detect broken chain linkage', () => {
    const chain = buildChain(3);

    // Break the chain by changing entry 2's prevHash and recomputing its hash
    const entry2 = { ...chain[1] };
    entry2.prevHash = 'wrong_previous_hash_000000000000000000000000000000000000000000';
    // Recompute hash with wrong prevHash to pass self-hash check
    entry2.sha256Hash = computeAuditHash(entry2, entry2.prevHash);
    chain[1] = entry2;

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    // Should break at index 1 because prevHash doesn't match chain[0].sha256Hash
    expect(result.brokenAt).toBe(1);
  });
});

describe('createExportAuditEntry', () => {
  it('should create an audit entry for export operations', () => {
    const entry = createExportAuditEntry(
      'exp-1',
      'user-1',
      'CSV',
      100,
      'filehash123',
    );

    expect(entry.entityType).toBe('export');
    expect(entry.entityId).toBe('exp-1');
    expect(entry.action).toBe('export');
    expect(entry.changedBy).toBe('user-1');
    expect(entry.fieldChanged).toBe('file');
    expect(entry.sha256Hash).toHaveLength(64);

    // newValue should be JSON with format, rowCount, fileHash
    const parsed = JSON.parse(entry.newValue!);
    expect(parsed.format).toBe('CSV');
    expect(parsed.rowCount).toBe(100);
    expect(parsed.fileHash).toBe('filehash123');
  });

  it('should chain with previous hash', () => {
    const entry1 = createExportAuditEntry('exp-1', 'user-1', 'CSV', 50, 'hash1');
    const entry2 = createExportAuditEntry(
      'exp-2',
      'user-1',
      'PDF',
      75,
      'hash2',
      entry1.sha256Hash,
    );

    expect(entry2.prevHash).toBe(entry1.sha256Hash);
  });
});

describe('computeFileHash', () => {
  it('should compute SHA-256 hash of file content', () => {
    const content = 'CSV file content here';
    const hash = computeFileHash(content);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce consistent hash for same content', () => {
    const content = '"Type","Buy Amount"\n"Trade","100"';
    expect(computeFileHash(content)).toBe(computeFileHash(content));
  });

  it('should produce different hash for different content', () => {
    expect(computeFileHash('version1')).not.toBe(computeFileHash('version2'));
  });

  it('should detect any modification to file content', () => {
    const original = 'original content';
    const tampered = 'original content '; // extra space
    expect(computeFileHash(original)).not.toBe(computeFileHash(tampered));
  });

  it('should work with Buffer input', () => {
    const content = 'test data';
    const stringHash = computeFileHash(content);
    const bufferHash = computeFileHash(Buffer.from(content, 'utf-8'));
    expect(stringHash).toBe(bufferHash);
  });
});
