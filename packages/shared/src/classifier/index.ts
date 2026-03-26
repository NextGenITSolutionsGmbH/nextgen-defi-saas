// ---------------------------------------------------------------------------
// @defi-tracker/shared — Classification Engine barrel export
// ---------------------------------------------------------------------------

// Core types
export type {
  AmpelStatus,
  ModelChoice,
  PriceSource,
  DecodedEvent,
  ClassificationResult,
} from './types';

// Classification engine
export { ClassificationEngine } from './classification-engine';

// Protocol-specific rule classifiers
export { classifySparkDex } from './rules/sparkdex';
export { classifyEnosys } from './rules/enosys';
export { classifyKinetic } from './rules/kinetic';
export { classifyFlareNative } from './rules/flare-native';
