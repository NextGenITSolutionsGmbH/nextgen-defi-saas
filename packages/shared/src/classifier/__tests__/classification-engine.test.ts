import { describe, it, expect } from 'vitest';
import { ClassificationEngine } from '../classification-engine';
import type { DecodedEvent, ClassificationResult, AmpelStatus } from '../types';

describe('ClassificationEngine', () => {
  const engine = new ClassificationEngine();

  function makeEvent(overrides: Partial<DecodedEvent> = {}): DecodedEvent {
    return {
      txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef12345678',
      blockNumber: 12345678,
      blockTimestamp: Math.floor(new Date('2025-06-01T12:00:00Z').getTime() / 1000),
      logIndex: 0,
      contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
      eventName: 'Transfer',
      args: {},
      protocol: null,
      ...overrides,
    };
  }

  // ---- Layer 1: Protocol ABI Match ----

  it('should classify SparkDEX Swap via protocol field', () => {
    const event = makeEvent({
      eventName: 'Swap',
      protocol: 'sparkdex',
      args: {
        sender: '0xuser',
        recipient: '0xuser',
        amount0: '1000000000000000000',
        amount1: '-500000',
        sqrtPriceX96: '123456',
        liquidity: '789',
        tick: '-100',
      },
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('Trade');
    expect(result.ampelStatus).toBe('GREEN');
    expect(result.exchange).toContain('SparkDEX');
  });

  it('should classify Enosys events via protocol field', () => {
    const event = makeEvent({
      eventName: 'Swap',
      protocol: 'enosys',
      args: {
        sender: '0xuser',
        amount0In: '1000',
        amount1Out: '500',
      },
    });

    const result = engine.classify(event);
    // Should be routed to enosys classifier
    expect(result.ampelStatus).not.toBeUndefined();
  });

  it('should classify Kinetic events via protocol field', () => {
    const event = makeEvent({
      eventName: 'Mint',
      protocol: 'kinetic',
      args: {
        minter: '0xuser',
        mintAmount: '1000',
        mintTokens: '500',
      },
    });

    const result = engine.classify(event);
    expect(result.ampelStatus).not.toBeUndefined();
  });

  it('should classify Flare native events via protocol field', () => {
    const event = makeEvent({
      eventName: 'RewardClaimed',
      protocol: 'flare',
      args: {
        beneficiary: '0xuser',
        amount: '1000',
      },
    });

    const result = engine.classify(event);
    expect(result.ampelStatus).not.toBeUndefined();
  });

  // ---- Layer 2: Contract Address Match ----

  it('should classify events from known SparkDEX contract address', () => {
    const event = makeEvent({
      eventName: 'Swap',
      contractAddress: '0x8a1e35f5c98c4e85500f079e0b2bd83bdf23e9cd', // SparkDEX V3 Router
      protocol: null,
      args: {
        sender: '0xuser',
        amount0: '1000',
        amount1: '500',
      },
    });

    const result = engine.classify(event);
    // Should be routed to SparkDEX classifier via address lookup
    expect(result.ampelStatus).not.toBeUndefined();
  });

  it('should classify events from known Kinetic Market address', () => {
    const event = makeEvent({
      eventName: 'Mint',
      contractAddress: '0xb348e39080fce8a97147adf16a5cbe43e85ae430', // kFLR
      protocol: null,
      args: {
        minter: '0xuser',
        mintAmount: '1000',
      },
    });

    const result = engine.classify(event);
    expect(result.ampelStatus).not.toBeUndefined();
  });

  // ---- Layer 3: Event Pattern Heuristic ----

  it('should classify Swap events heuristically when no protocol known', () => {
    const event = makeEvent({
      eventName: 'Swap',
      contractAddress: '0x0000000000000000000000000000000000000099', // unknown address
      protocol: null,
      args: {
        amountIn: '1000',
        amountOut: '500',
        tokenIn: 'FLR',
        tokenOut: 'USDT',
      },
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('Trade');
    expect(result.ampelStatus).toBe('YELLOW');
    expect(result.comment).toContain('heuristisch');
  });

  it('should classify Mint/AddLiquidity events heuristically as Add Liquidity', () => {
    const event = makeEvent({
      eventName: 'AddLiquidity',
      contractAddress: '0x0000000000000000000000000000000000000099',
      protocol: null,
      args: {
        amount0: '1000',
        liquidity: '500',
      },
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('Add Liquidity');
    expect(result.ampelStatus).toBe('YELLOW');
    expect(result.isGraubereich).toBe(true);
  });

  it('should classify Burn/RemoveLiquidity events heuristically as Remove Liquidity', () => {
    const event = makeEvent({
      eventName: 'RemoveLiquidity',
      contractAddress: '0x0000000000000000000000000000000000000099',
      protocol: null,
      args: {
        amount0: '1000',
        liquidity: '500',
      },
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('Remove Liquidity');
    expect(result.ampelStatus).toBe('YELLOW');
    expect(result.isGraubereich).toBe(true);
  });

  it('should classify RewardClaimed/Collect events heuristically as LP Rewards', () => {
    const event = makeEvent({
      eventName: 'Collect',
      contractAddress: '0x0000000000000000000000000000000000000099',
      protocol: null,
      args: {
        amount: '1000',
        token: 'FLR',
      },
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('LP Rewards');
    expect(result.ampelStatus).toBe('YELLOW');
    expect(result.tradeGroup).toBe('Farming');
  });

  // ---- Layer 4: ERC20 Transfer Fallback ----

  it('should classify Transfer events as internal transfer (GRAY)', () => {
    const event = makeEvent({
      eventName: 'Transfer',
      contractAddress: '0x0000000000000000000000000000000000000099',
      protocol: null,
      args: {
        from: '0xuser1',
        to: '0xuser2',
        value: '1000',
      },
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('Transfer (intern)');
    expect(result.ampelStatus).toBe('GRAY');
    expect(result.isGraubereich).toBe(false);
  });

  // ---- Layer 5: Unknown ----

  it('should classify completely unknown events as RED', () => {
    const event = makeEvent({
      eventName: 'SomeUnknownEvent',
      contractAddress: '0x0000000000000000000000000000000000000099',
      protocol: null,
      args: {},
    });

    const result = engine.classify(event);

    expect(result.ctType).toBe('Other');
    expect(result.ampelStatus).toBe('RED');
    expect(result.isGraubereich).toBe(false);
    expect(result.comment).toContain('Unbekanntes Event');
    expect(result.comment).toContain('SomeUnknownEvent');
  });

  // ---- classifyBatch ----

  it('should classify a batch of events', () => {
    const events: DecodedEvent[] = [
      makeEvent({
        eventName: 'Swap',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { amountIn: '1000', amountOut: '500' },
      }),
      makeEvent({
        eventName: 'Transfer',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { value: '1000' },
      }),
      makeEvent({
        eventName: 'UnknownEvent',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: {},
      }),
    ];

    const results = engine.classifyBatch(events);

    expect(results).toHaveLength(3);
    expect(results[0].ctType).toBe('Trade');
    expect(results[1].ctType).toBe('Transfer (intern)');
    expect(results[2].ctType).toBe('Other');
  });

  // ---- Ampel status coverage ----

  it('should produce all four Ampel statuses across different event types', () => {
    const statuses = new Set<AmpelStatus>();

    // GREEN: SparkDEX Swap via protocol
    const greenResult = engine.classify(
      makeEvent({
        eventName: 'Swap',
        protocol: 'sparkdex',
        args: { sender: '0x', recipient: '0x', amount0: '1', amount1: '-1' },
      }),
    );
    statuses.add(greenResult.ampelStatus);

    // YELLOW: Heuristic Swap
    const yellowResult = engine.classify(
      makeEvent({
        eventName: 'Swap',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { amountIn: '1' },
      }),
    );
    statuses.add(yellowResult.ampelStatus);

    // GRAY: Transfer fallback
    const grayResult = engine.classify(
      makeEvent({
        eventName: 'Transfer',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { value: '1' },
      }),
    );
    statuses.add(grayResult.ampelStatus);

    // RED: Unknown event
    const redResult = engine.classify(
      makeEvent({
        eventName: 'UnknownEvent',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: {},
      }),
    );
    statuses.add(redResult.ampelStatus);

    expect(statuses.has('GREEN')).toBe(true);
    expect(statuses.has('YELLOW')).toBe(true);
    expect(statuses.has('GRAY')).toBe(true);
    expect(statuses.has('RED')).toBe(true);
  });

  // ---- ClassificationResult structure ----

  it('should return all required fields in ClassificationResult', () => {
    const result = engine.classify(makeEvent({ eventName: 'SomeEvent' }));

    expect(result).toHaveProperty('ctType');
    expect(result).toHaveProperty('buyAmount');
    expect(result).toHaveProperty('buyCurrency');
    expect(result).toHaveProperty('sellAmount');
    expect(result).toHaveProperty('sellCurrency');
    expect(result).toHaveProperty('fee');
    expect(result).toHaveProperty('feeCurrency');
    expect(result).toHaveProperty('exchange');
    expect(result).toHaveProperty('tradeGroup');
    expect(result).toHaveProperty('ampelStatus');
    expect(result).toHaveProperty('isGraubereich');
    expect(result).toHaveProperty('modelChoice');
    expect(result).toHaveProperty('comment');
  });

  // ---- Graubereich / isGraubereich flag ----

  it('should set isGraubereich for LP-related heuristic events', () => {
    const mintResult = engine.classify(
      makeEvent({
        eventName: 'Mint',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { liquidity: '100' },
      }),
    );
    expect(mintResult.isGraubereich).toBe(true);

    const burnResult = engine.classify(
      makeEvent({
        eventName: 'Burn',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { liquidity: '100' },
      }),
    );
    expect(burnResult.isGraubereich).toBe(true);
  });

  it('should NOT set isGraubereich for swap or transfer events', () => {
    const swapResult = engine.classify(
      makeEvent({
        eventName: 'Swap',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { amountIn: '100' },
      }),
    );
    expect(swapResult.isGraubereich).toBe(false);

    const transferResult = engine.classify(
      makeEvent({
        eventName: 'Transfer',
        contractAddress: '0x0000000000000000000000000000000000000099',
        args: { value: '100' },
      }),
    );
    expect(transferResult.isGraubereich).toBe(false);
  });
});
