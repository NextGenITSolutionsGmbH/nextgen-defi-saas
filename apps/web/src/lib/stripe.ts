import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazily initialised Stripe client — avoids build-time crash when env is absent. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/** Re-export for convenience — callers use `stripe` directly. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});

export const STRIPE_PRICE_IDS: Record<string, string> = {
  PRO: process.env.STRIPE_PRICE_PRO ?? "",
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS ?? "",
  KANZLEI: process.env.STRIPE_PRICE_KANZLEI ?? "",
};
