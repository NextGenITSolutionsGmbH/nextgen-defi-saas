import { describe, it, expect } from 'vitest';
import {
  decodeLog,
  decodeTransactionLogs,
  EVENT_TOPICS,
  type DecodedEvent,
} from '../event-decoder';
import type { RpcLog } from '../flare-rpc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BLOCK_TIMESTAMP = 1710244473; // 2024-03-12T12:34:33Z

function makeMockLog(overrides: Partial<RpcLog> = {}): RpcLog {
  return {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    topics: [],
    data: '0x',
    blockNumber: '0xbeef',
    transactionHash: '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    logIndex: '0x0',
    blockHash: '0xblockhash1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    removed: false,
    ...overrides,
  };
}

/**
 * Encode a uint256 value as a 64-char hex string (no 0x prefix).
 */
function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

/**
 * Encode an int256 value as a 64-char hex string (no 0x prefix).
 * Negative values use two's complement.
 */
function encodeInt256(value: bigint): string {
  if (value >= 0n) {
    return value.toString(16).padStart(64, '0');
  }
  // Two's complement for negative
  const twosComplement = (1n << 256n) + value;
  return twosComplement.toString(16).padStart(64, '0');
}

/**
 * Pad an address to 32-byte topic format.
 */
function padAddress(address: string): string {
  return '0x' + address.slice(2).toLowerCase().padStart(64, '0');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Event Decoder', () => {
  // ---- ERC20 Transfer ----

  describe('ERC20 Transfer', () => {
    it('should decode Transfer(address,address,uint256) event', () => {
      const from = '0x1111111111111111111111111111111111111111';
      const to = '0x2222222222222222222222222222222222222222';
      const value = 1_000_000_000_000_000_000n; // 1e18

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress(from),
          padAddress(to),
        ],
        data: '0x' + encodeUint256(value),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result).not.toBeNull();
      expect(result!.eventName).toBe('Transfer');
      expect(result!.args.from).toBe(from);
      expect(result!.args.to).toBe(to);
      expect(result!.args.value).toBe(value.toString());
      expect(result!.blockTimestamp).toBe(BLOCK_TIMESTAMP);
    });

    it('should decode Transfer with zero value', () => {
      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Transfer');
      expect(result!.args.value).toBe('0');
    });

    it('should decode Transfer with large value (max uint256-like)', () => {
      const largeValue = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(largeValue),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.args.value).toBe(largeValue.toString());
    });
  });

  // ---- Approval ----

  describe('Approval', () => {
    it('should decode Approval(address,address,uint256) event', () => {
      const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const spender = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const value = 50_000_000n;

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Approval(address,address,uint256)'],
          padAddress(owner),
          padAddress(spender),
        ],
        data: '0x' + encodeUint256(value),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Approval');
      expect(result!.args.owner).toBe(owner);
      expect(result!.args.spender).toBe(spender);
      expect(result!.args.value).toBe(value.toString());
    });
  });

  // ---- Swap (V3 format) ----

  describe('Swap (V3)', () => {
    it('should decode Swap event with positive and negative int256 amounts', () => {
      const sender = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const amount0 = 1_000_000_000_000_000_000n; // positive
      const amount1 = -500_000_000n; // negative

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)'],
          padAddress(sender),
          padAddress(recipient),
        ],
        data:
          '0x' +
          encodeInt256(amount0) +
          encodeInt256(amount1) +
          encodeUint256(79228162514264337593543950336n) + // sqrtPriceX96
          encodeInt256(-100n), // tick
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Swap');
      expect(result!.args.sender).toBe(sender);
      expect(result!.args.recipient).toBe(recipient);
      expect(result!.args.amount0).toBe(amount0.toString());
      expect(result!.args.amount1).toBe(amount1.toString());
      expect(result!.args.sqrtPriceX96).toBe('79228162514264337593543950336');
      expect(result!.args.tick).toBe('-100');
    });

    it('should decode Swap with both amounts negative', () => {
      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)'],
          padAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          padAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ],
        data:
          '0x' +
          encodeInt256(-1_000_000n) +
          encodeInt256(-2_000_000n) +
          encodeUint256(0n) +
          encodeInt256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.args.amount0).toBe('-1000000');
      expect(result!.args.amount1).toBe('-2000000');
    });
  });

  // ---- Mint Events ----

  describe('Mint events', () => {
    it('should decode V3 Mint with 3+ topics (LP position)', () => {
      const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      // tickLower as topic (e.g., tick -887220)
      const tickLowerHex = '0x' + encodeInt256(-887220n);

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Mint(address,address,int24,int24,uint128,uint256,uint256)'],
          padAddress(owner),
          tickLowerHex,
        ],
        data:
          '0x' +
          encodeUint256(500_000_000_000_000_000n) + // amount0
          encodeUint256(1_000_000_000_000_000_000n), // amount1
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Mint');
      expect(result!.args.owner).toBe(owner);
      expect(result!.args.amount0).toBe('500000000000000000');
      expect(result!.args.amount1).toBe('1000000000000000000');
    });

    it('should decode Compound-style Mint with 2 topics (supply)', () => {
      const minter = '0xcccccccccccccccccccccccccccccccccccccccc';

      const log = makeMockLog({
        address: '0x5bc2e3f7a2b1c93eda8a6df8b23e3f1c9d4a5b6c', // Kinetic Market
        topics: [
          EVENT_TOPICS['Mint(address,uint256,uint256)'],
          padAddress(minter),
        ],
        data:
          '0x' +
          encodeUint256(100_000_000n) + // mintAmount
          encodeUint256(99_500_000n),    // mintTokens
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Mint');
      expect(result!.args.minter).toBe(minter);
      expect(result!.args.mintAmount).toBe('100000000');
      expect(result!.args.mintTokens).toBe('99500000');
      expect(result!.protocol).toBe('Kinetic Market');
    });
  });

  // ---- Burn Event ----

  describe('Burn', () => {
    it('should decode Burn event (LP removal)', () => {
      const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Burn(address,int24,int24,uint128,uint256,uint256)'],
          padAddress(owner),
        ],
        data:
          '0x' +
          encodeUint256(250_000_000_000_000_000n) + // amount0
          encodeUint256(750_000_000_000_000_000n),   // amount1
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Burn');
      expect(result!.args.owner).toBe(owner);
      expect(result!.args.amount0).toBe('250000000000000000');
      expect(result!.args.amount1).toBe('750000000000000000');
    });
  });

  // ---- Collect Event ----

  describe('Collect', () => {
    it('should decode Collect event (fee collection)', () => {
      const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Collect(address,address,int24,int24,uint128,uint128)'],
          padAddress(owner),
          padAddress(recipient),
        ],
        data:
          '0x' +
          encodeUint256(1_000_000n) + // amount0
          encodeUint256(2_000_000n),   // amount1
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Collect');
      expect(result!.args.owner).toBe(owner);
      expect(result!.args.recipient).toBe(recipient);
      expect(result!.args.amount0).toBe('1000000');
      expect(result!.args.amount1).toBe('2000000');
    });
  });

  // ---- Compound-style Events (Borrow, RepayBorrow, Redeem) ----

  describe('Compound / Kinetic Market events', () => {
    it('should decode Borrow event', () => {
      const borrower = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Borrow(address,uint256,uint256,uint256)'],
          padAddress(borrower),
        ],
        data:
          '0x' +
          encodeUint256(500_000_000n) +  // borrowAmount
          encodeUint256(500_000_000n) +   // accountBorrows
          encodeUint256(10_000_000_000n), // totalBorrows
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Borrow');
      expect(result!.args.borrower).toBe(borrower);
      expect(result!.args.borrowAmount).toBe('500000000');
      expect(result!.args.accountBorrows).toBe('500000000');
      expect(result!.args.totalBorrows).toBe('10000000000');
    });

    it('should decode RepayBorrow event', () => {
      const payer = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const borrower = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['RepayBorrow(address,address,uint256,uint256,uint256)'],
          padAddress(payer),
          padAddress(borrower),
        ],
        data: '0x' + encodeUint256(250_000_000n), // repayAmount
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('RepayBorrow');
      expect(result!.args.payer).toBe(payer);
      expect(result!.args.borrower).toBe(borrower);
      expect(result!.args.repayAmount).toBe('250000000');
    });

    it('should decode Redeem event', () => {
      const redeemer = '0xcccccccccccccccccccccccccccccccccccccccc';

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Redeem(address,uint256,uint256)'],
          padAddress(redeemer),
        ],
        data:
          '0x' +
          encodeUint256(100_000_000n) + // redeemAmount
          encodeUint256(99_000_000n),    // redeemTokens
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('Redeem');
      expect(result!.args.redeemer).toBe(redeemer);
      expect(result!.args.redeemAmount).toBe('100000000');
      expect(result!.args.redeemTokens).toBe('99000000');
    });

    it('should decode LiquidateBorrow event', () => {
      const liquidator = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const borrower = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['LiquidateBorrow(address,address,uint256,address,uint256)'],
          padAddress(liquidator),
          padAddress(borrower),
        ],
        data: '0x' + encodeUint256(300_000_000n), // repayAmount
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.eventName).toBe('LiquidateBorrow');
      expect(result!.args.liquidator).toBe(liquidator);
      expect(result!.args.borrower).toBe(borrower);
      expect(result!.args.repayAmount).toBe('300000000');
    });
  });

  // ---- Unknown Event ----

  describe('Unknown event', () => {
    it('should return Unknown for unrecognized topic0', () => {
      const unknownTopic = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      const log = makeMockLog({
        topics: [unknownTopic, padAddress('0x1111111111111111111111111111111111111111')],
        data: '0x1234',
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result).not.toBeNull();
      expect(result!.eventName).toBe('Unknown');
      expect(result!.args.topic0).toBe(unknownTopic);
    });
  });

  // ---- No Topics ----

  describe('No topics', () => {
    it('should return null for log with no topics', () => {
      const log = makeMockLog({ topics: [] });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result).toBeNull();
    });

    it('should return null for log with undefined-like topics', () => {
      const log = makeMockLog({ topics: [] });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result).toBeNull();
    });
  });

  // ---- decodeTransactionLogs ----

  describe('decodeTransactionLogs()', () => {
    it('should decode multiple logs and filter nulls', () => {
      const transferLog = makeMockLog({
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(1_000n),
        logIndex: '0x0',
      });

      const emptyTopicsLog = makeMockLog({
        topics: [],
        logIndex: '0x1',
      });

      const approvalLog = makeMockLog({
        topics: [
          EVENT_TOPICS['Approval(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x3333333333333333333333333333333333333333'),
        ],
        data: '0x' + encodeUint256(999_999n),
        logIndex: '0x2',
      });

      const result = decodeTransactionLogs(
        [transferLog, emptyTopicsLog, approvalLog],
        BLOCK_TIMESTAMP,
      );

      // emptyTopicsLog should be filtered out
      expect(result).toHaveLength(2);
      expect(result[0].eventName).toBe('Transfer');
      expect(result[1].eventName).toBe('Approval');
    });

    it('should return empty array for empty logs', () => {
      const result = decodeTransactionLogs([], BLOCK_TIMESTAMP);
      expect(result).toEqual([]);
    });

    it('should preserve log ordering', () => {
      const logs = [0, 1, 2, 3].map((i) =>
        makeMockLog({
          topics: [
            EVENT_TOPICS['Transfer(address,address,uint256)'],
            padAddress('0x1111111111111111111111111111111111111111'),
            padAddress('0x2222222222222222222222222222222222222222'),
          ],
          data: '0x' + encodeUint256(BigInt(i * 100)),
          logIndex: '0x' + i.toString(16),
        }),
      );

      const result = decodeTransactionLogs(logs, BLOCK_TIMESTAMP);

      expect(result).toHaveLength(4);
      expect(result[0].logIndex).toBe(0);
      expect(result[1].logIndex).toBe(1);
      expect(result[2].logIndex).toBe(2);
      expect(result[3].logIndex).toBe(3);
    });
  });

  // ---- decodeInt256 / decodeUint256 edge cases ----

  describe('int256 / uint256 decoding edge cases', () => {
    it('should decode int256 positive values correctly via Swap event', () => {
      const amount0 = 42n;

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)'],
          padAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          padAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ],
        data:
          '0x' +
          encodeInt256(amount0) +
          encodeInt256(0n) +
          encodeUint256(0n) +
          encodeInt256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.args.amount0).toBe('42');
    });

    it('should decode int256 negative values correctly (two\'s complement)', () => {
      const amount0 = -1n;

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)'],
          padAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          padAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ],
        data:
          '0x' +
          encodeInt256(amount0) +
          encodeInt256(0n) +
          encodeUint256(0n) +
          encodeInt256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.args.amount0).toBe('-1');
    });

    it('should decode int256 zero correctly', () => {
      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)'],
          padAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          padAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ],
        data:
          '0x' +
          encodeInt256(0n) +
          encodeInt256(0n) +
          encodeUint256(0n) +
          encodeInt256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.args.amount0).toBe('0');
      expect(result!.args.amount1).toBe('0');
    });

    it('should decode uint256 zero correctly', () => {
      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.args.value).toBe('0');
    });

    it('should decode large negative int256 correctly', () => {
      // Large negative number: -(2^255)
      const minInt256 = -(1n << 255n);

      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)'],
          padAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          padAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ],
        data:
          '0x' +
          encodeInt256(minInt256) +
          encodeInt256(0n) +
          encodeUint256(0n) +
          encodeInt256(0n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.args.amount0).toBe(minInt256.toString());
    });
  });

  // ---- Protocol Detection ----

  describe('protocol detection', () => {
    it('should detect SparkDEX protocol from known contract address', () => {
      const log = makeMockLog({
        address: '0x8a1e35f5c98c4e85500f079e0b2bd83bdf23e9cd', // SparkDEX V3 Router
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.protocol).toBe('SparkDEX');
    });

    it('should detect Enosys protocol', () => {
      const log = makeMockLog({
        address: '0x4ca1326bc2776f5d2f5a2f77bf6c076ce7b7d8a1', // Enosys DEX Router
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.protocol).toBe('\u0112nosys');
    });

    it('should detect Kinetic Market protocol', () => {
      const log = makeMockLog({
        address: '0x5bc2e3f7a2b1c93eda8a6df8b23e3f1c9d4a5b6c', // Kinetic Market
        topics: [
          EVENT_TOPICS['Mint(address,uint256,uint256)'],
          padAddress('0xcccccccccccccccccccccccccccccccccccccccc'),
        ],
        data:
          '0x' +
          encodeUint256(100n) +
          encodeUint256(99n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.protocol).toBe('Kinetic Market');
    });

    it('should detect Flare Network protocol from system contract', () => {
      const log = makeMockLog({
        address: '0x1000000000000000000000000000000000000003', // Distribution Treasury
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.protocol).toBe('Flare Network');
    });

    it('should return null protocol for unknown contract', () => {
      const log = makeMockLog({
        address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.protocol).toBeNull();
    });
  });

  // ---- Metadata Fields ----

  describe('metadata fields', () => {
    it('should correctly parse blockNumber and logIndex from hex', () => {
      const log = makeMockLog({
        blockNumber: '0x1a2b3c',
        logIndex: '0x5',
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.blockNumber).toBe(0x1a2b3c);
      expect(result!.logIndex).toBe(5);
    });

    it('should lowercase contractAddress', () => {
      const log = makeMockLog({
        address: '0xAbCdEf1234567890ABCDEF1234567890AbCdEf12',
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);

      expect(result!.contractAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should include raw log reference', () => {
      const log = makeMockLog({
        topics: [
          EVENT_TOPICS['Transfer(address,address,uint256)'],
          padAddress('0x1111111111111111111111111111111111111111'),
          padAddress('0x2222222222222222222222222222222222222222'),
        ],
        data: '0x' + encodeUint256(100n),
      });

      const result = decodeLog(log, BLOCK_TIMESTAMP);
      expect(result!.raw).toBe(log);
    });
  });

  // ---- EVENT_TOPICS ----

  describe('EVENT_TOPICS', () => {
    it('should have correct Transfer topic hash', () => {
      expect(EVENT_TOPICS['Transfer(address,address,uint256)']).toBe(
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      );
    });

    it('should have correct Swap topic hash', () => {
      expect(EVENT_TOPICS['Swap(address,address,int256,int256,uint160,int24)']).toBe(
        '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
      );
    });

    it('should have all topics in lowercase in reverse lookup', () => {
      // Verify each topic is lowercase when used in decoding
      for (const [sig, topic] of Object.entries(EVENT_TOPICS)) {
        const log = makeMockLog({
          topics: [topic.toLowerCase()],
          data: '0x',
        });

        // Should at least not return null (some events decoded generically)
        const result = decodeLog(log, BLOCK_TIMESTAMP);
        // All known topics should be decodable (even if generic)
        expect(result).not.toBeNull();
        expect(result!.eventName).toBeTruthy();
      }
    });
  });
});
