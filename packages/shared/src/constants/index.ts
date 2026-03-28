// ---------------------------------------------------------------------------
// @defi-tracker/shared — Constants & configuration values
//
// @spec EP-01..EP-09 — Flare Network constants, token registry, protocol addresses, BMF tax constants
// ---------------------------------------------------------------------------

import type { FlareChainConfig } from '../types';

// ---------------------------------------------------------------------------
// Chain configurations
// ---------------------------------------------------------------------------

export const FLARE_MAINNET: FlareChainConfig = {
  chainId: 14,
  rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
  explorerUrl: 'https://flarescan.com',
  name: 'Flare Mainnet',
} as const;

export const FLARE_TESTNET: FlareChainConfig = {
  chainId: 114,
  rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
  explorerUrl: 'https://coston2-explorer.flare.network',
  name: 'Flare Coston2 Testnet',
} as const;

// ---------------------------------------------------------------------------
// Token registry (Flare Mainnet)
// ---------------------------------------------------------------------------

export interface FlareTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export const FLARE_TOKENS: ReadonlyMap<string, FlareTokenInfo> = new Map<string, FlareTokenInfo>([
  [
    'WFLR',
    {
      address: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
      symbol: 'WFLR',
      decimals: 18,
      name: 'Wrapped Flare',
    },
  ],
  [
    'FLR',
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'FLR',
      decimals: 18,
      name: 'Flare',
    },
  ],
  [
    'FXRP',
    {
      address: '0x70Ad1F72F4b935AC63bB54dB107B8E15dFd93298',
      symbol: 'FXRP',
      decimals: 18,
      name: 'FAssets XRP',
    },
  ],
  [
    'USDT',
    {
      address: '0x96B41289D90444B8adD57e6F265DB5aE8651c472',
      symbol: 'USDT',
      decimals: 6,
      name: 'Tether USD',
    },
  ],
  [
    'SPRK',
    {
      address: '0x6Bb4025Dc157e4C68D6D23a0D1d2E3e08C29eBD6',
      symbol: 'SPRK',
      decimals: 18,
      name: 'SparkDEX Token',
    },
  ],
  [
    'kFLR',
    {
      address: '0xB348E39080fCE8A97147ADf16A5cBe43E85AE430',
      symbol: 'kFLR',
      decimals: 18,
      name: 'Kinetic FLR',
    },
  ],
  [
    'kUSDT',
    {
      address: '0xA30FA3D22d5E4E7b03B34060F3436d8e0A75A4b2',
      symbol: 'kUSDT',
      decimals: 6,
      name: 'Kinetic USDT',
    },
  ],
  [
    'rFLR',
    {
      address: '0x26d460c3Cf931Fb2014fA41728C28e68F1D590B7',
      symbol: 'rFLR',
      decimals: 18,
      name: 'Reward FLR',
    },
  ],
  [
    'APS',
    {
      address: '0xA40c0e83DE5bAf3836CfCe6e34C9005D27a31bC3',
      symbol: 'APS',
      decimals: 18,
      name: 'Aperture Finance',
    },
  ],
  [
    'HLN',
    {
      address: '0x4Be0B26Af6D431DA97FBb9De3E0D6B3ed5dCA643',
      symbol: 'HLN',
      decimals: 18,
      name: 'Helion',
    },
  ],
  [
    'ENSY',
    {
      address: '0x2dB6b55Cf365BCef0b3dBC82e41ec7F6e443C8E8',
      symbol: 'ENSY',
      decimals: 18,
      name: 'Enosys Token',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Protocol contract addresses (Flare Mainnet)
// ---------------------------------------------------------------------------

export interface ProtocolAddressEntry {
  name: string;
  addresses: readonly string[];
}

export const PROTOCOL_ADDRESSES: ReadonlyMap<string, ProtocolAddressEntry> = new Map<
  string,
  ProtocolAddressEntry
>([
  [
    'SparkDEX V3 Router',
    {
      name: 'SparkDEX V3 Router',
      addresses: ['0x8a1E35F5c98C4E85500f079e0B2Bd83bDf23e9cd'],
    },
  ],
  [
    'SparkDEX V4 Router',
    {
      name: 'SparkDEX V4 Router',
      addresses: ['0x1b4e2E8B6D5b2c90e4B0cE5A38B7dF8C1264e8E'],
    },
  ],
  [
    'Enosys DEX Router',
    {
      name: 'Enosys DEX Router',
      addresses: ['0x4cA1326bC2776f5D2F5a2f77bF6C076ce7B7d8A1'],
    },
  ],
  [
    'Enosys CDP',
    {
      name: 'Enosys CDP',
      addresses: ['0x9D3c4A2Bb1E6bf45DBc3b1F2A1cD9E1b43c8A5D2'],
    },
  ],
  [
    'Kinetic Market Comptroller',
    {
      name: 'Kinetic Market Comptroller',
      addresses: ['0x5bC2E3f7A2b1c93eDa8A6dF8b23E3f1c9D4a5B6C'],
    },
  ],
  [
    'FTSO Registry',
    {
      name: 'FTSO Registry',
      addresses: ['0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019'],
    },
  ],
]);

// ---------------------------------------------------------------------------
// CoinTracking transaction types
// ---------------------------------------------------------------------------

export const COINTRACKING_TYPES = [
  'Trade',
  'Deposit',
  'Withdrawal',
  'Staking',
  'LP Rewards',
  'Lending Einnahme',
  'Airdrop',
  'Mining',
  'Add Liquidity',
  'Remove Liquidity',
  'Transfer (intern)',
  'Margin Trade',
  'Borrowing Fee',
  'Liquidation',
  'Lost',
  'Stolen',
  'Spend',
  'Donation',
  'Gift',
  'Income (non-taxable)',
  'Income (taxable)',
  'Other Fee',
  'Other Income',
  'Other Expense',
] as const;

export type CoinTrackingType = (typeof COINTRACKING_TYPES)[number];

// ---------------------------------------------------------------------------
// German BMF tax constants
// ---------------------------------------------------------------------------

export const TAX_CONSTANTS = {
  /** Section 23 EStG — private Veraeusserungsgeschaefte Freigrenze */
  paragraph23FreigrenzeEur: 1000,
  /** Section 22 Nr. 3 EStG — sonstige Einkuenfte Freigrenze */
  paragraph22Nr3FreigrenzeEur: 256,
  /** Holding period in days after which private disposals are tax-free */
  holdingPeriodDays: 365,
} as const;

// ---------------------------------------------------------------------------
// Price source priority order
// ---------------------------------------------------------------------------

export const PRICE_SOURCE_PRIORITY = ['FTSO', 'COINGECKO', 'CMC', 'MANUAL'] as const;
