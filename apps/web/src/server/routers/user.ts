import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  verifyPassword,
  hashPassword,
  generateTOTPSecret,
  verifyTOTP,
} from "@/lib/auth-utils";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { encrypt, decrypt } from "@/lib/crypto";
import { invalidateCache } from "../lib/cache";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const planSchema = z.enum(["STARTER", "PRO", "BUSINESS", "KANZLEI"]);

const taxMethodSchema = z.enum(["FIFO", "LIFO"]);

const setup2faOutputSchema = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
});

const verify2faSchema = z.object({
  token: z.string().length(6, "TOTP token must be 6 digits"),
  secret: z.string().min(1, "Secret is required"),
});

const disable2faSchema = z.object({
  token: z.string().length(6, "TOTP token must be 6 digits"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmation: z.literal("DELETE"),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const userRouter = router({
  /**
   * Get current user profile with aggregated counts.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
        totpEnabled: true,
        _count: {
          select: {
            wallets: true,
            exports: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Count total transactions across all wallets
    const txCount = await ctx.db.transaction.count({
      where: {
        wallet: { userId: ctx.user.id },
      },
    });

    return {
      id: user.id,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt,
      totpEnabled: user.totpEnabled,
      walletCount: user._count.wallets,
      exportCount: user._count.exports,
      txCount,
    };
  }),

  /**
   * Update the user's subscription plan.
   */
  updatePlan: protectedProcedure
    .input(z.object({ plan: planSchema }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { plan: input.plan },
        select: { id: true, plan: true },
      });

      await invalidateCache(ctx.user.id, ["user.*"]);

      return updated;
    }),

  /**
   * Update the user's default tax method preference.
   * Stored client-side for now (returned for confirmation).
   */
  updateTaxMethod: protectedProcedure
    .input(z.object({ method: taxMethodSchema }))
    .mutation(async ({ input }) => {
      // Tax method is per-export (stored on Export model).
      // This endpoint validates the choice and returns it for client-side persistence.
      return { method: input.method };
    }),

  // =========================================================================
  // Password — Change password
  // =========================================================================

  /**
   * Change the user's password.
   * Requires the current password for verification.
   */
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const passwordValid = await verifyPassword(
        input.currentPassword,
        user.passwordHash
      );

      if (!passwordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect.",
        });
      }

      const newHash = await hashPassword(input.newPassword);

      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { passwordHash: newHash },
        select: { id: true },
      });

      return { success: true };
    }),

  // =========================================================================
  // 2FA — Two-Factor Authentication (TOTP / RFC 6238)
  // =========================================================================

  /**
   * Step 1: Generate a TOTP secret and otpauth URI for QR code display.
   */
  setup2fa: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: { totpEnabled: true, email: true },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    if (user.totpEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA is already enabled on this account",
      });
    }

    const { secret, otpauthUrl } = generateTOTPSecret();

    // Store the secret temporarily (encrypted at rest, not yet enabled until verified)
    await ctx.db.user.update({
      where: { id: ctx.user.id },
      data: { totpSecret: encrypt(secret) },
      select: { id: true },
    });

    return setup2faOutputSchema.parse({ secret, otpauthUrl });
  }),

  /**
   * Step 2: Verify the TOTP token and enable 2FA.
   */
  verify2fa: protectedProcedure
    .input(verify2faSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { totpEnabled: true, totpSecret: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user.totpEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA is already enabled",
        });
      }

      if (!user.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No 2FA setup in progress. Call setup2fa first.",
        });
      }

      // Decrypt the stored secret before verification
      const decryptedSecret = decrypt(user.totpSecret);

      // Verify the token against the stored secret
      const isValid = verifyTOTP(input.token, decryptedSecret);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid TOTP token. Please try again.",
        });
      }

      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { totpEnabled: true },
        select: { id: true },
      });

      return { success: true, message: "Two-factor authentication enabled" };
    }),

  /**
   * Disable 2FA (requires a valid TOTP token for verification).
   */
  disable2fa: protectedProcedure
    .input(disable2faSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { totpEnabled: true, totpSecret: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (!user.totpEnabled || !user.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA is not enabled on this account",
        });
      }

      // Decrypt the stored secret before verification
      const decryptedSecret = decrypt(user.totpSecret);

      const isValid = verifyTOTP(input.token, decryptedSecret);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid TOTP token. Cannot disable 2FA.",
        });
      }

      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { totpEnabled: false, totpSecret: null },
        select: { id: true },
      });

      return { success: true, message: "Two-factor authentication disabled" };
    }),

  // =========================================================================
  // DSGVO / GDPR — Data Privacy
  // =========================================================================

  /**
   * DSGVO Art. 15 — Export all personal data as JSON.
   */
  exportPersonalData: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        plan: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
        wallets: {
          select: {
            id: true,
            address: true,
            chainId: true,
            label: true,
            syncStatus: true,
            lastSyncAt: true,
            createdAt: true,
            transactions: {
              select: {
                id: true,
                txHash: true,
                blockNumber: true,
                blockTimestamp: true,
                protocol: true,
                status: true,
                createdAt: true,
                legs: {
                  select: {
                    id: true,
                    direction: true,
                    tokenSymbol: true,
                    amount: true,
                    eurValue: true,
                  },
                },
                classifications: {
                  select: {
                    id: true,
                    ctType: true,
                    buyAmount: true,
                    buyCurrency: true,
                    sellAmount: true,
                    sellCurrency: true,
                    fee: true,
                    feeCurrency: true,
                    eurBuyValue: true,
                    eurSellValue: true,
                    priceSource: true,
                    isManual: true,
                    comment: true,
                  },
                },
              },
            },
          },
        },
        taxLots: {
          select: {
            id: true,
            tokenSymbol: true,
            amount: true,
            acquisitionCostEur: true,
            acquisitionDate: true,
            remainingAmount: true,
            method: true,
            disposalDate: true,
            lotStatus: true,
          },
        },
        taxEvents: {
          select: {
            id: true,
            eventType: true,
            gainLossEur: true,
            holdingPeriodDays: true,
            taxYear: true,
            createdAt: true,
          },
        },
        exports: {
          select: {
            id: true,
            taxYear: true,
            method: true,
            format: true,
            rowCount: true,
            generatedAt: true,
            status: true,
          },
        },
        subscriptions: {
          select: {
            id: true,
            plan: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      exportedAt: new Date().toISOString(),
      dsgvoArticle: "Art. 15 DSGVO — Auskunftsrecht",
      data: user,
    };
  }),

  /**
   * DSGVO Art. 17 — Delete account and all associated data.
   * Requires password confirmation for safety.
   * Cascading deletes are enforced by Prisma schema (onDelete: Cascade).
   */
  deleteAccount: protectedProcedure
    .input(deleteAccountSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the confirmation string
      if (input.confirmation !== "DELETE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: 'You must type "DELETE" to confirm account deletion.',
        });
      }

      // Verify password
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const passwordValid = await verifyPassword(
        input.password,
        user.passwordHash
      );

      if (!passwordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid password. Account deletion aborted.",
        });
      }

      // Delete audit logs first (no cascade relation to User)
      await ctx.db.auditLog.deleteMany({
        where: { changedBy: ctx.user.id },
      });

      // Delete the user — Prisma cascade will handle:
      // wallets → transactions → tx_legs, tx_classifications → tax_events
      // tax_lots, exports, subscriptions
      await ctx.db.user.delete({
        where: { id: ctx.user.id },
        select: { id: true },
      });

      return {
        success: true,
        message:
          "Account and all associated data have been permanently deleted (DSGVO Art. 17).",
      };
    }),

  // =========================================================================
  // Stripe — Checkout & Billing Portal
  // =========================================================================

  createCheckoutSession: protectedProcedure
    .input(z.object({ plan: z.enum(["PRO", "BUSINESS", "KANZLEI"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true, email: true, stripeCustomerId: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;

        await ctx.db.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
          select: { id: true },
        });
      }

      const priceId = STRIPE_PRICE_IDS[input.plan];
      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No Stripe price configured for plan: ${input.plan}`,
        });
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.AUTH_URL ??
        process.env.NEXTAUTH_URL ??
        "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/settings?checkout=success`,
        cancel_url: `${baseUrl}/settings?checkout=cancel`,
        metadata: { userId: user.id, plan: input.plan },
      });

      return { url: session.url };
    }),

  createBillingPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "No Stripe customer found. Please subscribe to a plan first.",
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.AUTH_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/settings`,
    });

    return { url: session.url };
  }),
});
