// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

/**
 * @spec FR-04-01 — Stripe subscription billing
 * @spec FR-04-02 — Webhook-driven plan lifecycle (checkout, update, cancel, payment failure)
 */

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock("../../../../../lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  })),
  STRIPE_PRICE_IDS: {
    PRO: "price_pro_123",
    BUSINESS: "price_business_456",
    KANZLEI: "price_kanzlei_789",
  },
}));

const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockSubscriptionUpsert = vi.fn();
const mockSubscriptionFindUnique = vi.fn();
const mockSubscriptionUpdate = vi.fn();

vi.mock("@defi-tracker/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    subscription: {
      upsert: mockSubscriptionUpsert,
      findUnique: mockSubscriptionFindUnique,
      update: mockSubscriptionUpdate,
    },
  },
}));

// Import the handler AFTER mocks are set up
const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWebhookRequest(body: string, signature = "valid-sig"): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

function createStripeEvent(
  type: string,
  dataObject: Record<string, unknown>,
): Stripe.Event {
  return {
    id: "evt_test_123",
    object: "event",
    type,
    data: { object: dataObject },
  } as unknown as Stripe.Event;
}

function makeSubscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test_123",
    status: "active",
    items: { data: [{ price: { id: "price_pro_123" } }] },
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    cancel_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
});

// -------------------- Signature validation --------------------

describe("Stripe webhook — signature validation", () => {
  it("returns 400 when constructEvent throws (invalid signature)", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = createWebhookRequest('{"type":"test"}', "bad-sig");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Webhook signature verification failed");
  });

  it('returns 200 with { received: true } for a valid event', async () => {
    const event = createStripeEvent("unknown.event.type", {});
    mockConstructEvent.mockReturnValue(event);

    const req = createWebhookRequest('{"type":"unknown.event.type"}');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
  });
});

// -------------------- checkout.session.completed --------------------

describe("Stripe webhook — checkout.session.completed", () => {
  it("creates subscription and updates user plan for valid session", async () => {
    const session = {
      customer: "cus_abc123",
      subscription: "sub_test_123",
    };
    const event = createStripeEvent("checkout.session.completed", session);
    mockConstructEvent.mockReturnValue(event);

    const sub = makeSubscriptionObject();
    mockSubscriptionsRetrieve.mockResolvedValue(sub);
    mockUserFindUnique.mockResolvedValue({ id: "user_1" });
    mockSubscriptionUpsert.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });

    // Verify subscription retrieval
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_test_123");

    // Verify user lookup by Stripe customer ID
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_abc123" },
      select: { id: true },
    });

    // Verify subscription upsert with correct plan
    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubId: "sub_test_123" },
        create: expect.objectContaining({
          userId: "user_1",
          plan: "PRO",
          status: "ACTIVE",
        }),
        update: expect.objectContaining({
          plan: "PRO",
          status: "ACTIVE",
        }),
      }),
    );

    // Verify user plan update
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { plan: "PRO" },
    });
  });

  it("handles missing customer ID gracefully (returns 200, no DB writes)", async () => {
    const session = { customer: null, subscription: "sub_test_123" };
    const event = createStripeEvent("checkout.session.completed", session);
    mockConstructEvent.mockReturnValue(event);

    const req = createWebhookRequest("{}");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it("handles user not found (returns 200, no crash)", async () => {
    const session = {
      customer: "cus_unknown",
      subscription: "sub_test_123",
    };
    const event = createStripeEvent("checkout.session.completed", session);
    mockConstructEvent.mockReturnValue(event);

    const sub = makeSubscriptionObject();
    mockSubscriptionsRetrieve.mockResolvedValue(sub);
    mockUserFindUnique.mockResolvedValue(null);

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });

    // Should NOT attempt to upsert subscription or update user
    expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

// -------------------- customer.subscription.updated --------------------

describe("Stripe webhook — customer.subscription.updated", () => {
  it("updates subscription status and plan tier", async () => {
    const sub = makeSubscriptionObject({
      status: "active",
    });
    const event = createStripeEvent("customer.subscription.updated", sub);
    mockConstructEvent.mockReturnValue(event);

    mockSubscriptionFindUnique.mockResolvedValue({ userId: "user_1" });
    mockSubscriptionUpdate.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const req = createWebhookRequest("{}");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubId: "sub_test_123" },
        data: expect.objectContaining({
          plan: "PRO",
          status: "ACTIVE",
        }),
      }),
    );
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { plan: "PRO" },
    });
  });

  it.each([
    ["active", "ACTIVE"],
    ["canceled", "CANCELED"],
    ["past_due", "PAST_DUE"],
    ["trialing", "TRIALING"],
  ] as const)(
    "maps Stripe status '%s' to SubStatus '%s'",
    async (stripeStatus, expectedStatus) => {
      const sub = makeSubscriptionObject({ status: stripeStatus });
      const event = createStripeEvent("customer.subscription.updated", sub);
      mockConstructEvent.mockReturnValue(event);

      mockSubscriptionFindUnique.mockResolvedValue({ userId: "user_1" });
      mockSubscriptionUpdate.mockResolvedValue({});
      mockUserUpdate.mockResolvedValue({});

      const req = createWebhookRequest("{}");
      await POST(req);

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: expectedStatus,
          }),
        }),
      );
    },
  );

  it("handles unknown subscription gracefully", async () => {
    const sub = makeSubscriptionObject();
    const event = createStripeEvent("customer.subscription.updated", sub);
    mockConstructEvent.mockReturnValue(event);

    mockSubscriptionFindUnique.mockResolvedValue(null);

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

// -------------------- customer.subscription.deleted --------------------

describe("Stripe webhook — customer.subscription.deleted", () => {
  it("sets subscription to CANCELED and downgrades user to STARTER", async () => {
    const sub = makeSubscriptionObject();
    const event = createStripeEvent("customer.subscription.deleted", sub);
    mockConstructEvent.mockReturnValue(event);

    mockSubscriptionFindUnique.mockResolvedValue({ userId: "user_1" });
    mockSubscriptionUpdate.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const req = createWebhookRequest("{}");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { stripeSubId: "sub_test_123" },
      data: { status: "CANCELED" },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { plan: "STARTER" },
    });
  });

  it("handles unknown subscription gracefully", async () => {
    const sub = makeSubscriptionObject();
    const event = createStripeEvent("customer.subscription.deleted", sub);
    mockConstructEvent.mockReturnValue(event);

    mockSubscriptionFindUnique.mockResolvedValue(null);

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

// -------------------- invoice.payment_failed --------------------

describe("Stripe webhook — invoice.payment_failed", () => {
  it("sets subscription status to PAST_DUE", async () => {
    const invoice = { subscription: "sub_test_123" };
    const event = createStripeEvent("invoice.payment_failed", invoice);
    mockConstructEvent.mockReturnValue(event);

    mockSubscriptionFindUnique.mockResolvedValue({ id: "sub_db_1" });
    mockSubscriptionUpdate.mockResolvedValue({});

    const req = createWebhookRequest("{}");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { stripeSubId: "sub_test_123" },
      data: { status: "PAST_DUE" },
    });
  });

  it("handles missing subscription ID gracefully", async () => {
    const invoice = { subscription: null };
    const event = createStripeEvent("invoice.payment_failed", invoice);
    mockConstructEvent.mockReturnValue(event);

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });
});

// -------------------- Price-to-plan mapping --------------------

describe("Stripe webhook — price-to-plan mapping", () => {
  it.each([
    ["price_pro_123", "PRO"],
    ["price_business_456", "BUSINESS"],
    ["price_kanzlei_789", "KANZLEI"],
  ] as const)(
    "maps price ID %s to plan %s via checkout.session.completed",
    async (priceId, expectedPlan) => {
      const session = {
        customer: "cus_abc123",
        subscription: "sub_test_123",
      };
      const event = createStripeEvent("checkout.session.completed", session);
      mockConstructEvent.mockReturnValue(event);

      const sub = makeSubscriptionObject({
        items: { data: [{ price: { id: priceId } }] },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);
      mockUserFindUnique.mockResolvedValue({ id: "user_1" });
      mockSubscriptionUpsert.mockResolvedValue({});
      mockUserUpdate.mockResolvedValue({});

      const req = createWebhookRequest("{}");
      await POST(req);

      expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: expectedPlan }),
          update: expect.objectContaining({ plan: expectedPlan }),
        }),
      );
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user_1" },
        data: { plan: expectedPlan },
      });
    },
  );

  it("returns STARTER for unknown price ID", async () => {
    const session = {
      customer: "cus_abc123",
      subscription: "sub_test_123",
    };
    const event = createStripeEvent("checkout.session.completed", session);
    mockConstructEvent.mockReturnValue(event);

    const sub = makeSubscriptionObject({
      items: { data: [{ price: { id: "price_unknown_000" } }] },
    });
    mockSubscriptionsRetrieve.mockResolvedValue(sub);
    mockUserFindUnique.mockResolvedValue({ id: "user_1" });
    mockSubscriptionUpsert.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});

    const req = createWebhookRequest("{}");
    await POST(req);

    expect(mockSubscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "STARTER" }),
        update: expect.objectContaining({ plan: "STARTER" }),
      }),
    );
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { plan: "STARTER" },
    });
  });
});

// -------------------- Unhandled event --------------------

describe("Stripe webhook — unhandled event type", () => {
  it('returns 200 with { received: true } for unknown event type', async () => {
    const event = createStripeEvent("some.random.event", { foo: "bar" });
    mockConstructEvent.mockReturnValue(event);

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
  });
});

// -------------------- Error handling --------------------

describe("Stripe webhook — error handling", () => {
  it("returns 500 when handler throws", async () => {
    const session = {
      customer: "cus_abc123",
      subscription: "sub_test_123",
    };
    const event = createStripeEvent("checkout.session.completed", session);
    mockConstructEvent.mockReturnValue(event);

    mockSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe API down"));

    const req = createWebhookRequest("{}");
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Webhook handler failed");
  });
});
