// ---------------------------------------------------------------------------
// @defi-tracker/shared — Tax Calculation Engine barrel export
// ---------------------------------------------------------------------------

// Types
export type {
  TaxMethod,
  TaxEventType,
  TaxLot,
  Disposal,
  TaxGainLossResult,
  FreigrenzeStatus as TaxFreigrenzeStatus,
  HaltefristEntry,
} from './types';

// Lot Matcher
export { LotMatcher } from './lot-matcher';

// Freigrenze Monitor
export { calculateFreigrenze } from './freigrenze';

// Haltefrist Tracker
export { calculateHaltefrist, getUpcomingTaxFreeAssets } from './haltefrist';

// Tax Engine (Orchestrator)
export { TaxEngine } from './tax-engine';
