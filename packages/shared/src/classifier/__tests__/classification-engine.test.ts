import { describe, it, expect } from 'vitest';
import { ClassificationEngine } from '../classification-engine';
import { EVENT_SIGNATURES } from '../../types/classifier';
import type { EventLog } from '../../types/classifier';

describe('ClassificationEngine', () => {
  const engine = new ClassificationEngine();

  function makeEvent(overrides: Partial<EventLog> = {}): EventLog {
    return {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      topics: [],
      data: '0x',
      transactionHash: '0xabc123',
      ...overrides,
    };
  }

  // ─── ERC20 TRANSFER ───

  it('should classify ERC20 Transfer as Trade', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.ERC20_TRANSFER, '0xfrom', '0xto'],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Trade');
    expect(result.status).toBe('GREEN');
    expect(result.taxReference).toContain('§ 23 EStG');
    expect(result.method).toBe('EVENT_PATTERN');
  });

  // ─── V3 SWAP ───

  it('should classify V3 Swap event correctly', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_SWAP, '0xsender', '0xrecipient'],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Trade');
    expect(result.status).toBe('GREEN');
    expect(result.taxReference).toContain('§ 23 EStG');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should classify V3 Swap from known protocol as ABI_MATCH', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_SWAP, '0xsender', '0xrecipient'],
      protocolName: 'SparkDEX',
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Trade');
    expect(result.status).toBe('GREEN');
    expect(result.method).toBe('ABI_MATCH');
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toContain('SparkDEX');
  });

  // ─── V3 MINT (ADD LIQUIDITY) ───

  it('should classify V3 Mint as Provide Liquidity (YELLOW)', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_MINT],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Provide Liquidity');
    expect(result.status).toBe('YELLOW');
    expect(result.taxReference).toContain('Graubereich');
  });

  it('should classify V3 Mint from known protocol as ABI_MATCH', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_MINT],
      protocolName: 'Enosys DEX',
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Provide Liquidity');
    expect(result.status).toBe('YELLOW');
    expect(result.method).toBe('ABI_MATCH');
    expect(result.dualScenario).toBe('MODEL_A');
  });

  // ─── V3 BURN (REMOVE LIQUIDITY) ───

  it('should classify V3 Burn as Remove Liquidity (YELLOW)', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_BURN],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Remove Liquidity');
    expect(result.status).toBe('YELLOW');
    expect(result.taxReference).toContain('Graubereich');
  });

  it('should classify V3 Burn from known protocol as ABI_MATCH', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_BURN],
      protocolName: 'SparkDEX',
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Remove Liquidity');
    expect(result.status).toBe('YELLOW');
    expect(result.method).toBe('ABI_MATCH');
  });

  // ─── V3 COLLECT (LP REWARDS) ───

  it('should classify V3 Collect as LP Rewards (GREEN)', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_COLLECT],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('LP Rewards');
    expect(result.status).toBe('GREEN');
    expect(result.taxReference).toContain('§ 22 Nr. 3 EStG');
    expect(result.method).toBe('EVENT_PATTERN');
  });

  // ─── UNKNOWN EVENTS ───

  it('should classify unknown events as RED status', () => {
    const unknownSignature = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const event = makeEvent({
      topics: [unknownSignature],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Unknown');
    expect(result.status).toBe('RED');
    expect(result.confidence).toBe(0);
    expect(result.taxReference).toContain('Manual review');
  });

  // ─── GRAY (IRRELEVANT) ───

  it('should classify events with no topic as GRAY (internal transfer)', () => {
    const event = makeEvent({
      topics: [],
    });

    const result = engine.classify(event);

    expect(result.type).toBe('Transfer intern');
    expect(result.status).toBe('GRAY');
    expect(result.taxReference).toContain('Kein steuerliches Ereignis');
    expect(result.method).toBe('HEURISTIC');
  });

  // ─── YELLOW / GRAUBEREICH ───

  it('should set YELLOW for Graubereich LP operations', () => {
    // Mint = Provide Liquidity → Graubereich
    const mintEvent = makeEvent({
      topics: [EVENT_SIGNATURES.V3_MINT],
    });
    const mintResult = engine.classify(mintEvent);
    expect(mintResult.status).toBe('YELLOW');

    // Burn = Remove Liquidity → Graubereich
    const burnEvent = makeEvent({
      topics: [EVENT_SIGNATURES.V3_BURN],
    });
    const burnResult = engine.classify(burnEvent);
    expect(burnResult.status).toBe('YELLOW');
  });

  // ─── DUAL SCENARIO MODEL ───

  it('should provide MODEL_A (conservative) by default for dual scenarios', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_MINT],
    });

    const result = engine.classify(event);

    expect(result.dualScenario).toBe('MODEL_A');
    expect(result.reason).toContain('konservativ');
  });

  it('should provide MODEL_B (liberal) when requested for dual scenarios', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_MINT],
    });

    const result = engine.classify(event, 'MODEL_B');

    expect(result.dualScenario).toBe('MODEL_B');
    expect(result.reason).toContain('liberal');
    expect(result.taxReference).toContain('§ 22 Nr. 3 EStG');
  });

  it('should not include dualScenario for non-Graubereich events', () => {
    const event = makeEvent({
      topics: [EVENT_SIGNATURES.V3_SWAP],
    });

    const result = engine.classify(event);

    expect(result.dualScenario).toBeUndefined();
  });

  // ─── isGraubereich ───

  it('should identify Graubereich types correctly', () => {
    expect(engine.isGraubereich('Provide Liquidity')).toBe(true);
    expect(engine.isGraubereich('Remove Liquidity')).toBe(true);
    expect(engine.isGraubereich('Receive LP Token')).toBe(true);
    expect(engine.isGraubereich('Return LP Token')).toBe(true);
    expect(engine.isGraubereich('Add Collateral')).toBe(true);
    expect(engine.isGraubereich('Remove Collateral')).toBe(true);
    expect(engine.isGraubereich('Darlehen erhalten')).toBe(true);
    expect(engine.isGraubereich('Darlehen zurückgezahlt')).toBe(true);
  });

  it('should NOT identify non-Graubereich types', () => {
    expect(engine.isGraubereich('Trade')).toBe(false);
    expect(engine.isGraubereich('Staking')).toBe(false);
    expect(engine.isGraubereich('LP Rewards')).toBe(false);
    expect(engine.isGraubereich('Unknown')).toBe(false);
  });

  // ─── CONFIDENCE LEVELS ───

  it('should have higher confidence for ABI_MATCH than EVENT_PATTERN', () => {
    // Known protocol V3 Swap → ABI_MATCH
    const knownEvent = makeEvent({
      topics: [EVENT_SIGNATURES.V3_SWAP],
      protocolName: 'SparkDEX',
    });
    const knownResult = engine.classify(knownEvent);

    // Unknown protocol V3 Swap → EVENT_PATTERN
    const unknownEvent = makeEvent({
      topics: [EVENT_SIGNATURES.V3_SWAP],
    });
    const unknownResult = engine.classify(unknownEvent);

    expect(knownResult.confidence).toBeGreaterThan(unknownResult.confidence);
    expect(knownResult.method).toBe('ABI_MATCH');
    expect(unknownResult.method).toBe('EVENT_PATTERN');
  });

  it('should have lowest confidence for unclassifiable events', () => {
    const event = makeEvent({
      topics: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
    });

    const result = engine.classify(event);
    expect(result.confidence).toBe(0);
  });
});
