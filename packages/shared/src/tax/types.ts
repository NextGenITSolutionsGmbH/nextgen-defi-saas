// ---------------------------------------------------------------------------
// @defi-tracker/shared — Tax Calculation Engine types
// German BMF 2025 compliant type definitions
// ---------------------------------------------------------------------------

/**
 * Tax lot accounting method.
 * - FIFO: First-In-First-Out (default, most common for German tax)
 * - LIFO: Last-In-First-Out (alternative permitted by BMF)
 */
export type TaxMethod = 'FIFO' | 'LIFO';

/**
 * Tax event classification per German income tax law (EStG).
 * - PARAGRAPH_23: Private Veraeusserungsgeschaefte (Section 23 Abs. 1 S. 1 Nr. 2 EStG)
 * - PARAGRAPH_22_NR3: Sonstige Einkuenfte (Section 22 Nr. 3 EStG) — staking, LP rewards, lending
 */
export type TaxEventType = 'PARAGRAPH_23' | 'PARAGRAPH_22_NR3';

/**
 * A tax lot represents a batch of tokens acquired at a specific cost basis and date.
 * Used for FIFO/LIFO lot matching when computing gains/losses on disposal.
 *
 * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — Holding period & private disposal rules
 */
export interface TaxLot {
  /** Unique identifier for this lot */
  id: string;
  /** Token ticker symbol (e.g. 'FLR', 'WFLR') */
  tokenSymbol: string;
  /** On-chain contract address of the token */
  tokenAddress: string;
  /** Total amount acquired, stored as decimal string for precision */
  amount: string;
  /** Total acquisition cost in EUR, stored as decimal string */
  acquisitionCostEur: string;
  /** Date/time the tokens were acquired */
  acquisitionDate: Date;
  /** Remaining un-disposed amount, stored as decimal string */
  remainingAmount: string;
  /** Accounting method used for this lot */
  method: TaxMethod;
  /** Date/time of full disposal, null if still open or partially open */
  disposalDate: Date | null;
  /** Current status of the lot */
  status: 'OPEN' | 'CLOSED' | 'PARTIAL';
}

/**
 * Represents a disposal (sale, trade, spend) of tokens.
 * Used as input to the lot matcher to compute gains/losses.
 */
export interface Disposal {
  /** Token ticker symbol being disposed */
  tokenSymbol: string;
  /** Amount being disposed, stored as decimal string */
  amount: string;
  /** Date/time of the disposal */
  disposalDate: Date;
  /** Total proceeds in EUR from the disposal, stored as decimal string */
  disposalProceedsEur: string;
  /** On-chain transaction hash */
  txHash: string;
}

/**
 * Result of matching a disposal against one or more tax lots.
 * One disposal can produce multiple results if it spans multiple lots.
 *
 * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — 365-day holding period
 * @see Section 23 Abs. 3 S. 5 EStG — Freigrenze of EUR 1,000
 * @see Section 22 Nr. 3 EStG — Sonstige Einkuenfte (staking, LP, lending)
 */
export interface TaxGainLossResult {
  /** Which tax paragraph applies to this event */
  eventType: TaxEventType;
  /** Gain (positive) or loss (negative) in EUR, stored as decimal string */
  gainLossEur: string;
  /** Number of days between acquisition and disposal */
  holdingPeriodDays: number;
  /**
   * Whether this disposal is tax-free due to holding period.
   * For Section 23: true if holdingPeriodDays > 365.
   * For Section 22 Nr. 3: always false (no holding period exemption).
   */
  isTaxFree: boolean;
  /** Calendar year of the disposal for Freigrenze calculation */
  taxYear: number;
  /** ID of the tax lot that was (partially) consumed */
  lotId: string;
  /** Amount consumed from this specific lot, stored as decimal string */
  disposalAmount: string;
  /** Proportional acquisition cost for the consumed amount, stored as decimal string */
  acquisitionCostEur: string;
  /** Proportional disposal proceeds for the consumed amount, stored as decimal string */
  disposalProceedsEur: string;
}

/**
 * BMF Freigrenze (exemption limit) status for a given tax year.
 *
 * CRITICAL: These are Freigrenzen (exemption limits), NOT Freibetraege (allowances).
 * If the limit is exceeded, the ENTIRE amount becomes taxable, not just the excess.
 *
 * @see Section 23 Abs. 3 S. 5 EStG — EUR 1,000 Freigrenze for private disposals
 * @see Section 22 Nr. 3 S. 2 EStG — EUR 256 Freigrenze for misc. income
 */
export interface FreigrenzeStatus {
  paragraph23: {
    /** Sum of all taxable gains (excludes tax-free gains from holding > 365 days) */
    totalGainsEur: number;
    /** Sum of all losses (negative values become positive here) */
    totalLossesEur: number;
    /** Net gain after offsetting losses: totalGainsEur - totalLossesEur */
    netGainEur: number;
    /** Statutory limit in EUR */
    limit: 1000;
    /** Remaining headroom: max(0, limit - netGainEur) */
    remaining: number;
    /** Whether the Freigrenze is exceeded — if true, ALL gains are taxable */
    isExceeded: boolean;
    /** Traffic light: GREEN < EUR 800, YELLOW EUR 800-1000, RED > EUR 1000 */
    ampel: 'GREEN' | 'YELLOW' | 'RED';
  };
  paragraph22Nr3: {
    /** Total income from staking, LP rewards, lending, etc. */
    totalIncomeEur: number;
    /** Statutory limit in EUR */
    limit: 256;
    /** Remaining headroom: max(0, limit - totalIncomeEur) */
    remaining: number;
    /** Whether the Freigrenze is exceeded — if true, ALL income is taxable */
    isExceeded: boolean;
    /** Traffic light: GREEN < EUR 200, YELLOW EUR 200-256, RED > EUR 256 */
    ampel: 'GREEN' | 'YELLOW' | 'RED';
  };
}

/**
 * Holding period (Haltefrist) tracking entry for a single tax lot.
 * Used to display upcoming tax-free dates and remaining holding periods.
 *
 * @see Section 23 Abs. 1 S. 1 Nr. 2 EStG — 365-day holding period
 */
export interface HaltefristEntry {
  /** ID of the underlying tax lot */
  lotId: string;
  /** Token ticker symbol */
  tokenSymbol: string;
  /** Remaining amount in the lot, stored as decimal string */
  amount: string;
  /** Date the tokens were acquired */
  acquisitionDate: Date;
  /** Date when the holding period completes: acquisitionDate + 365 days */
  taxFreeDate: Date;
  /** Days remaining until the lot becomes tax-free (0 if already expired) */
  daysRemaining: number;
  /** Whether the holding period has completed (disposal would be tax-free) */
  isExpired: boolean;
  /** EUR value at the time of acquisition, stored as decimal string */
  eurValueAtAcquisition: string;
}
