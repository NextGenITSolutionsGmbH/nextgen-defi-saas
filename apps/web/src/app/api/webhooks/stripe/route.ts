import { NextResponse } from "next/server";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { prisma } from "@defi-tracker/db";
import type { PlanTier } from "@defi-tracker/db";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a Stripe price ID back to a PlanTier enum value.
 * Returns "STARTER" if no matching price is found.
 */
function priceIdToPlan(priceId: string): PlanTier {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id && id === priceId) return plan as PlanTier;
  }
  return "STARTER";
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!customerId || !subscriptionId) return;

  // Fetch the full subscription to get price, period, etc.
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const plan = priceIdToPlan(priceId);

  // Find the user by Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!user) return;

  // Upsert the subscription record
  await prisma.subscription.upsert({
    where: { stripeSubId: subscriptionId },
    create: {
      userId: user.id,
      stripeSubId: subscriptionId,
      plan,
      status: "ACTIVE",
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    },
    update: {
      plan,
      status: "ACTIVE",
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    },
  });

  // Update the user's plan tier
  await prisma.user.update({
    where: { id: user.id },
    data: { plan },
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const subscriptionId = sub.id;
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const plan = priceIdToPlan(priceId);

  // Map Stripe status to our SubStatus enum
  let status: "ACTIVE" | "CANCELED" | "PAST_DUE" | "TRIALING";
  switch (sub.status) {
    case "active":
      status = "ACTIVE";
      break;
    case "canceled":
      status = "CANCELED";
      break;
    case "past_due":
      status = "PAST_DUE";
      break;
    case "trialing":
      status = "TRIALING";
      break;
    default:
      status = "ACTIVE";
  }

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubId: subscriptionId },
    select: { userId: true },
  });

  if (!existing) return;

  await prisma.subscription.update({
    where: { stripeSubId: subscriptionId },
    data: {
      plan,
      status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    },
  });

  // Sync the user's plan tier
  await prisma.user.update({
    where: { id: existing.userId },
    data: { plan },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const subscriptionId = sub.id;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubId: subscriptionId },
    select: { userId: true },
  });

  if (!existing) return;

  await prisma.subscription.update({
    where: { stripeSubId: subscriptionId },
    data: { status: "CANCELED" },
  });

  // Downgrade user to STARTER
  await prisma.user.update({
    where: { id: existing.userId },
    data: { plan: "STARTER" },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubId: subscriptionId },
    select: { id: true },
  });

  if (!existing) return;

  await prisma.subscription.update({
    where: { stripeSubId: subscriptionId },
    data: { status: "PAST_DUE" },
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature")!;
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Stripe webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Stripe webhook handler error (${event.type}): ${message}`);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
