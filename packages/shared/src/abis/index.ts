// ---------------------------------------------------------------------------
// @defi-tracker/shared — ABI event fragments for on-chain event decoding
// ---------------------------------------------------------------------------
// Each export is a minimal ABI array containing only the event definitions
// required for decoding logs from the respective protocol contracts.
// The format follows the standard Ethereum JSON-ABI specification.
// ---------------------------------------------------------------------------

/** Ethereum ABI event input descriptor */
interface AbiEventInput {
  readonly name: string;
  readonly type: string;
  readonly indexed: boolean;
  readonly components?: readonly AbiEventInput[];
}

/** Ethereum ABI event fragment */
interface AbiEventFragment {
  readonly type: 'event';
  readonly name: string;
  readonly inputs: readonly AbiEventInput[];
  readonly anonymous?: boolean;
}

// ---------------------------------------------------------------------------
// SparkDEX V3 (Uniswap V3 compatible)
// ---------------------------------------------------------------------------

export const SPARKDEX_V3_EVENTS: readonly AbiEventFragment[] = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount0', type: 'int256', indexed: false },
      { name: 'amount1', type: 'int256', indexed: false },
      { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
      { name: 'liquidity', type: 'uint128', indexed: false },
      { name: 'tick', type: 'int24', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Mint',
    inputs: [
      { name: 'sender', type: 'address', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'amount', type: 'uint128', indexed: false },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Burn',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'amount', type: 'uint128', indexed: false },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Collect',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: false },
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'amount0', type: 'uint128', indexed: false },
      { name: 'amount1', type: 'uint128', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// SparkDEX V4 (V3 compatible + additional events)
// ---------------------------------------------------------------------------

export const SPARKDEX_V4_EVENTS: readonly AbiEventFragment[] = [
  // Inherit V3-compatible events
  ...SPARKDEX_V3_EVENTS,
  {
    type: 'event',
    name: 'Flash',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
      { name: 'paid0', type: 'uint256', indexed: false },
      { name: 'paid1', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Rebalance',
    inputs: [
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'liquidity', type: 'uint128', indexed: false },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Compound',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'liquidity', type: 'uint128', indexed: false },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Enosys DEX (Uniswap V3 compatible)
// ---------------------------------------------------------------------------

export const ENOSYS_DEX_EVENTS: readonly AbiEventFragment[] = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount0', type: 'int256', indexed: false },
      { name: 'amount1', type: 'int256', indexed: false },
      { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
      { name: 'liquidity', type: 'uint128', indexed: false },
      { name: 'tick', type: 'int24', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Mint',
    inputs: [
      { name: 'sender', type: 'address', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'amount', type: 'uint128', indexed: false },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Burn',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tickLower', type: 'int24', indexed: true },
      { name: 'tickUpper', type: 'int24', indexed: true },
      { name: 'amount', type: 'uint128', indexed: false },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Enosys CDP (Collateralized Debt Position)
// ---------------------------------------------------------------------------

export const ENOSYS_CDP_EVENTS: readonly AbiEventFragment[] = [
  {
    type: 'event',
    name: 'CDPOpened',
    inputs: [
      { name: 'cdpId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'collateralAmount', type: 'uint256', indexed: false },
      { name: 'debtAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CDPClosed',
    inputs: [
      { name: 'cdpId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'collateralReturned', type: 'uint256', indexed: false },
      { name: 'debtRepaid', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CDPLiquidated',
    inputs: [
      { name: 'cdpId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'liquidator', type: 'address', indexed: true },
      { name: 'collateralSeized', type: 'uint256', indexed: false },
      { name: 'debtRepaid', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StablecoinMinted',
    inputs: [
      { name: 'cdpId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CollateralAdded',
    inputs: [
      { name: 'cdpId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CollateralRemoved',
    inputs: [
      { name: 'cdpId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Kinetic Market (Compound / cToken style)
// ---------------------------------------------------------------------------

export const KINETIC_EVENTS: readonly AbiEventFragment[] = [
  {
    type: 'event',
    name: 'Supply',
    inputs: [
      { name: 'supplier', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Borrow',
    inputs: [
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'borrowAmount', type: 'uint256', indexed: false },
      { name: 'accountBorrows', type: 'uint256', indexed: false },
      { name: 'totalBorrows', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Repay',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'repayAmount', type: 'uint256', indexed: false },
      { name: 'accountBorrows', type: 'uint256', indexed: false },
      { name: 'totalBorrows', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Liquidation',
    inputs: [
      { name: 'liquidator', type: 'address', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'repayAmount', type: 'uint256', indexed: false },
      { name: 'cTokenCollateral', type: 'address', indexed: true },
      { name: 'seizeTokens', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AccrueInterest',
    inputs: [
      { name: 'cashPrior', type: 'uint256', indexed: false },
      { name: 'interestAccumulated', type: 'uint256', indexed: false },
      { name: 'borrowIndex', type: 'uint256', indexed: false },
      { name: 'totalBorrows', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Flare Staking / Distribution events
// ---------------------------------------------------------------------------

export const FLARE_STAKING_EVENTS: readonly AbiEventFragment[] = [
  {
    type: 'event',
    name: 'DelegationRewardClaimed',
    inputs: [
      { name: 'whoClaimed', type: 'address', indexed: true },
      { name: 'sentTo', type: 'address', indexed: true },
      { name: 'rewardEpoch', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FlareDropClaimed',
    inputs: [
      { name: 'whoClaimed', type: 'address', indexed: true },
      { name: 'sentTo', type: 'address', indexed: true },
      { name: 'month', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// ERC-20 standard events
// ---------------------------------------------------------------------------

export const ERC20_EVENTS: readonly AbiEventFragment[] = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;
