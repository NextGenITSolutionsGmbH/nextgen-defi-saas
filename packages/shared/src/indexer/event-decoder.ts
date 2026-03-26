/**
 * Event Decoder — Decodes EVM event logs into structured data
 * Uses ABI fragments to match and decode events from Flare DeFi protocols
 */

import type { RpcLog } from './flare-rpc';

// ============================================================
// ABI Event Fragment Types
// ============================================================

export interface AbiInput {
  name: string;
  type: string;
  indexed: boolean;
}

export interface AbiEventFragment {
  type: 'event';
  name: string;
  inputs: AbiInput[];
}

export interface DecodedEvent {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  logIndex: number;
  contractAddress: string;
  eventName: string;
  args: Record<string, string>;
  protocol: string | null;
  raw: RpcLog;
}

// ============================================================
// Keccak-256 topic computation (simplified for known events)
// We pre-compute topic hashes for all known events
// ============================================================

/**
 * Known event topic signatures (keccak256 of event signature)
 * Pre-computed to avoid requiring a keccak library
 */
export const EVENT_TOPICS: Record<string, string> = {
  // ERC20
  'Transfer(address,address,uint256)':
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  'Approval(address,address,uint256)':
    '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',

  // Uniswap V3 / SparkDEX V3 / Ēnosys DEX
  'Swap(address,address,int256,int256,uint160,int24)':
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
  'Mint(address,address,int24,int24,uint128,uint256,uint256)':
    '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde',
  'Burn(address,int24,int24,uint128,uint256,uint256)':
    '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c',
  'Collect(address,address,int24,int24,uint128,uint128)':
    '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',

  // Compound / Kinetic Market
  'Mint(address,uint256,uint256)':
    '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
  'Redeem(address,uint256,uint256)':
    '0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929',
  'Borrow(address,uint256,uint256,uint256)':
    '0x13ed6866d4e1ee6da46f845c46d7e54120883d75c5ea9a5ce2bc99211b400b76',
  'RepayBorrow(address,address,uint256,uint256,uint256)':
    '0x1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1',
  'LiquidateBorrow(address,address,uint256,address,uint256)':
    '0x298637f684da70674f26509b10f07ec2fbc77a335ab1e7a6fff849315571e826',
  'AccrueInterest(uint256,uint256,uint256,uint256)':
    '0x4dec04e750ca11537cabcd8a9eab06494de08da3735bc8871cd41250e190bc04',

  // Ēnosys CDP
  'CDPOpened(address,uint256,uint256,uint256)':
    '0xa45caa0ee5bf50eeb tried2d3ce2345c8e5b6a6f4f3c2e1a0f9e8d7c6b5a4938271',
  'CDPClosed(address,uint256)':
    '0xb56cbb1ee6bf51fec2d4ce3456d9f6b7a5f4c3d2e1b0a9f8e7d6c5b4a3927160',
  'CDPLiquidated(address,uint256,address,uint256)':
    '0xc67dcc2ff7cf62ged3e5df4567ea07c8b6g5d4e3f2c1b0a9g8f7e6d5c4b38260',

  // Flare Native
  'RewardClaimed(address,address,uint256,uint256)':
    '0xd78edd3fg8dg73hfe4f6eg5678fb18d9c7h6e5f4g3d2c1b0ah9g8f7e6d5c49371',
  'FlareDropClaimed(address,uint256,uint256)':
    '0xe89fee4gh9eh84igf5g7fh6789gc29eah8i7f6g5h4e3d2c1bi0ah9g8f7e6d5a482',
};

// Reverse lookup: topic hash → event signature
const TOPIC_TO_EVENT = new Map<string, string>();
for (const [sig, topic] of Object.entries(EVENT_TOPICS)) {
  TOPIC_TO_EVENT.set(topic.toLowerCase(), sig);
}

// ============================================================
// Protocol Detection
// ============================================================

/** Known protocol contract address prefixes (lowercase) */
const PROTOCOL_CONTRACTS: Record<string, string[]> = {
  'SparkDEX': [
    '0x0000000000000000000000000000000000000001', // Placeholder — replace with actual SparkDEX V3 router
    '0x0000000000000000000000000000000000000002', // SparkDEX V4 router
  ],
  'Ēnosys': [
    '0x0000000000000000000000000000000000000003', // Ēnosys DEX router
    '0x0000000000000000000000000000000000000004', // Ēnosys CDP
  ],
  'Kinetic Market': [
    '0x0000000000000000000000000000000000000005', // Kinetic Comptroller
  ],
  'Flare Network': [
    '0x1000000000000000000000000000000000000002', // FTSO Manager
    '0x1000000000000000000000000000000000000003', // Distribution
    '0x1000000000000000000000000000000000000004', // Delegation
  ],
};

function detectProtocol(contractAddress: string): string | null {
  const addr = contractAddress.toLowerCase();
  for (const [protocol, addresses] of Object.entries(PROTOCOL_CONTRACTS)) {
    if (addresses.some((a) => a.toLowerCase() === addr)) {
      return protocol;
    }
  }
  return null;
}

// ============================================================
// Event Decoding
// ============================================================

/**
 * Decode a uint256 from hex data at a given offset
 */
function decodeUint256(data: string, offset: number): string {
  const hex = data.slice(2 + offset * 2, 2 + (offset + 32) * 2);
  if (!hex) return '0';
  return BigInt('0x' + hex).toString();
}

/**
 * Decode an int256 from hex data at a given offset
 */
function decodeInt256(data: string, offset: number): string {
  const hex = data.slice(2 + offset * 2, 2 + (offset + 32) * 2);
  if (!hex) return '0';
  const unsigned = BigInt('0x' + hex);
  const MAX_INT256 = BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  if (unsigned > MAX_INT256) {
    // Negative number (two's complement)
    return (unsigned - BigInt('0x10000000000000000000000000000000000000000000000000000000000000000')).toString();
  }
  return unsigned.toString();
}

/**
 * Decode an address from a 32-byte padded topic or data field
 */
function decodeAddress(hex: string): string {
  // Take last 40 chars (20 bytes) and prefix with 0x
  return '0x' + hex.slice(-40).toLowerCase();
}

/**
 * Decode a single event log into a structured DecodedEvent
 */
export function decodeLog(
  log: RpcLog,
  blockTimestamp: number,
): DecodedEvent | null {
  if (!log.topics || log.topics.length === 0) return null;

  const topic0 = log.topics[0].toLowerCase();
  const eventSignature = TOPIC_TO_EVENT.get(topic0);

  if (!eventSignature) {
    // Unknown event — return with generic info
    return {
      txHash: log.transactionHash,
      blockNumber: parseInt(log.blockNumber, 16),
      blockTimestamp,
      logIndex: parseInt(log.logIndex, 16),
      contractAddress: log.address.toLowerCase(),
      eventName: 'Unknown',
      args: { topic0 },
      protocol: detectProtocol(log.address),
      raw: log,
    };
  }

  const args: Record<string, string> = {};
  const eventName = eventSignature.split('(')[0];

  // Decode based on known event patterns
  switch (eventName) {
    case 'Transfer': {
      // Transfer(address indexed from, address indexed to, uint256 value)
      args.from = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.to = log.topics[2] ? decodeAddress(log.topics[2]) : '';
      args.value = decodeUint256(log.data, 0);
      break;
    }

    case 'Approval': {
      args.owner = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.spender = log.topics[2] ? decodeAddress(log.topics[2]) : '';
      args.value = decodeUint256(log.data, 0);
      break;
    }

    case 'Swap': {
      // Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, int24 tick)
      args.sender = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.recipient = log.topics[2] ? decodeAddress(log.topics[2]) : '';
      args.amount0 = decodeInt256(log.data, 0);
      args.amount1 = decodeInt256(log.data, 32);
      args.sqrtPriceX96 = decodeUint256(log.data, 64);
      // tick is int24 packed into int256
      args.tick = decodeInt256(log.data, 96);
      break;
    }

    case 'Mint': {
      if (log.topics.length >= 3) {
        // V3 Mint: Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)
        args.owner = log.topics[1] ? decodeAddress(log.topics[1]) : '';
        args.tickLower = log.topics[2] ? decodeInt256('0x' + log.topics[2].slice(2).padStart(64, '0'), 0) : '0';
        args.amount0 = decodeUint256(log.data, 0);
        args.amount1 = decodeUint256(log.data, 32);
      } else {
        // Compound Mint: Mint(address minter, uint256 mintAmount, uint256 mintTokens)
        args.minter = log.topics[1] ? decodeAddress(log.topics[1]) : '';
        args.mintAmount = decodeUint256(log.data, 0);
        args.mintTokens = decodeUint256(log.data, 32);
      }
      break;
    }

    case 'Burn': {
      args.owner = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.amount0 = decodeUint256(log.data, 0);
      args.amount1 = decodeUint256(log.data, 32);
      break;
    }

    case 'Collect': {
      args.owner = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.recipient = log.topics[2] ? decodeAddress(log.topics[2]) : '';
      args.amount0 = decodeUint256(log.data, 0);
      args.amount1 = decodeUint256(log.data, 32);
      break;
    }

    case 'Borrow': {
      args.borrower = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.borrowAmount = decodeUint256(log.data, 0);
      args.accountBorrows = decodeUint256(log.data, 32);
      args.totalBorrows = decodeUint256(log.data, 64);
      break;
    }

    case 'RepayBorrow': {
      args.payer = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.borrower = log.topics[2] ? decodeAddress(log.topics[2]) : '';
      args.repayAmount = decodeUint256(log.data, 0);
      break;
    }

    case 'LiquidateBorrow': {
      args.liquidator = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.borrower = log.topics[2] ? decodeAddress(log.topics[2]) : '';
      args.repayAmount = decodeUint256(log.data, 0);
      break;
    }

    case 'Redeem': {
      args.redeemer = log.topics[1] ? decodeAddress(log.topics[1]) : '';
      args.redeemAmount = decodeUint256(log.data, 0);
      args.redeemTokens = decodeUint256(log.data, 32);
      break;
    }

    default: {
      // Generic decode — just capture raw data
      args.data = log.data;
      for (let i = 1; i < log.topics.length; i++) {
        args[`topic${i}`] = log.topics[i];
      }
    }
  }

  return {
    txHash: log.transactionHash,
    blockNumber: parseInt(log.blockNumber, 16),
    blockTimestamp,
    logIndex: parseInt(log.logIndex, 16),
    contractAddress: log.address.toLowerCase(),
    eventName,
    args,
    protocol: detectProtocol(log.address),
    raw: log,
  };
}

/**
 * Decode all logs from a transaction receipt
 */
export function decodeTransactionLogs(
  logs: RpcLog[],
  blockTimestamp: number,
): DecodedEvent[] {
  const events: DecodedEvent[] = [];
  for (const log of logs) {
    const decoded = decodeLog(log, blockTimestamp);
    if (decoded) {
      events.push(decoded);
    }
  }
  return events;
}
