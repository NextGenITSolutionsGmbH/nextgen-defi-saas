import { describe, it, expect } from 'vitest';
import {
  computeSha256,
  computeAuditHash,
  createAuditLogEntry,
  verifyAuditChain,
  computeFileHash,
} from '../audit-log';
import type { AuditLogEntry } from '../../types/export';

describe('computeSha256', () => {
  it('should compute SHA-256 hash correctly', () => {
    // Known SHA-256 of empty string
    const emptyHash = computeSha256('');
    expect(emptyHash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('should compute SHA-256 of known input', () => {
    // SHA-256("hello") is well-known
    const hash = computeSha256('hello');
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('should return 64-character hex string', () => {
    const hash = computeSha256('test data');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = computeSha256('input1');
    const hash2 = computeSha256('input2');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce consistent hashes for same input', () => {
    const hash1 = computeSha256('consistent');
    const hash2 = computeSha256('consistent');
    expect(hash1).toBe(hash2);
  });
});

describe('computeAuditHash', () => {
  it('should compute hash from entry fields', () => {
    const hash = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'EXPORT', '{}', '');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should include all fields in hash computation', () => {
    const base = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'EXPORT', '{}', '');

    // Changing any field should produce a different hash
    const diffId = computeAuditHash('id-2', '2026-01-01T00:00:00Z', 'EXPORT', '{}', '');
    const diffTime = computeAuditHash('id-1', '2026-01-02T00:00:00Z', 'EXPORT', '{}', '');
    const diffAction = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'DELETE', '{}', '');
    const diffPayload = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'EXPORT', '{"x":1}', '');
    const diffPrev = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'EXPORT', '{}', 'abc');

    expect(diffId).not.toBe(base);
    expect(diffTime).not.toBe(base);
    expect(diffAction).not.toBe(base);
    expect(diffPayload).not.toBe(base);
    expect(diffPrev).not.toBe(base);
  });

  it('should incorporate previousHash for chaining', () => {
    const hashWithEmpty = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'EXPORT', '{}', '');
    const hashWithPrev = computeAuditHash('id-1', '2026-01-01T00:00:00Z', 'EXPORT', '{}', 'prevhash123');
    expect(hashWithEmpty).not.toBe(hashWithPrev);
  });
});

describe('createAuditLogEntry', () => {
  it('should create an entry with computed hash', () => {
    const entry = createAuditLogEntry(
      'entry-1',
      '2026-01-01T00:00:00Z',
      'EXPORT_CREATED',
      '{"exportId":"exp-1"}',
      '',
    );

    expect(entry.id).toBe('entry-1');
    expect(entry.timestamp).toBe('2026-01-01T00:00:00Z');
    expect(entry.action).toBe('EXPORT_CREATED');
    expect(entry.payload).toBe('{"exportId":"exp-1"}');
    expect(entry.previousHash).toBe('');
    expect(entry.hash).toHaveLength(64);
  });

  it('should chain hashes — each entry includes previous hash', () => {
    const entry1 = createAuditLogEntry(
      'entry-1',
      '2026-01-01T00:00:00Z',
      'TX_CLASSIFIED',
      '{"txId":"0xabc"}',
      '',
    );

    const entry2 = createAuditLogEntry(
      'entry-2',
      '2026-01-01T00:01:00Z',
      'EXPORT_CREATED',
      '{"exportId":"exp-1"}',
      entry1.hash,
    );

    expect(entry2.previousHash).toBe(entry1.hash);
    expect(entry2.hash).not.toBe(entry1.hash);
  });

  it('should produce a verifiable hash', () => {
    const entry = createAuditLogEntry(
      'entry-1',
      '2026-01-01T00:00:00Z',
      'EXPORT_CREATED',
      '{}',
      '',
    );

    // Recompute and verify
    const expectedHash = computeAuditHash(
      entry.id,
      entry.timestamp,
      entry.action,
      entry.payload,
      entry.previousHash,
    );
    expect(entry.hash).toBe(expectedHash);
  });
});

describe('verifyAuditChain', () => {
  function buildChain(count: number): AuditLogEntry[] {
    const chain: AuditLogEntry[] = [];
    for (let i = 0; i < count; i++) {
      const previousHash = i === 0 ? '' : chain[i - 1].hash;
      chain.push(
        createAuditLogEntry(
          `entry-${i + 1}`,
          `2026-01-0${i + 1}T00:00:00Z`,
          `ACTION_${i + 1}`,
          `{"step":${i + 1}}`,
          previousHash,
        ),
      );
    }
    return chain;
  }

  it('should verify a valid single-entry chain', () => {
    const chain = buildChain(1);
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should verify a valid multi-entry chain', () => {
    const chain = buildChain(5);
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(true);
  });

  it('should verify an empty chain as valid', () => {
    const result = verifyAuditChain([]);
    expect(result.valid).toBe(true);
  });

  it('should detect tampered entry hash', () => {
    const chain = buildChain(3);

    // Tamper with the second entry's hash
    chain[1] = { ...chain[1], hash: 'tampered_hash_value_000000000000000000000000000000000' };

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hash mismatch');
  });

  it('should detect tampered entry payload', () => {
    const chain = buildChain(3);

    // Tamper with the second entry's payload (hash won't match)
    chain[1] = { ...chain[1], payload: '{"tampered":true}' };

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hash mismatch');
  });

  it('should detect broken chain linkage', () => {
    const chain = buildChain(3);

    // Break the chain by changing entry 2's previousHash
    const entry2 = { ...chain[1] };
    entry2.previousHash = 'wrong_previous_hash_00000000000000000000000000000000';
    // Recompute hash with wrong previousHash to pass self-hash check
    entry2.hash = computeAuditHash(
      entry2.id,
      entry2.timestamp,
      entry2.action,
      entry2.payload,
      entry2.previousHash,
    );
    chain[1] = entry2;

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('previousHash does not match');
  });

  it('should detect non-empty previousHash on first entry', () => {
    const chain = buildChain(2);

    // Tamper first entry to have non-empty previousHash
    const entry0 = { ...chain[0] };
    entry0.previousHash = 'should_be_empty';
    entry0.hash = computeAuditHash(
      entry0.id,
      entry0.timestamp,
      entry0.action,
      entry0.payload,
      entry0.previousHash,
    );
    chain[0] = entry0;

    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty previousHash');
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
});
