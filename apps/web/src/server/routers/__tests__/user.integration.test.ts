import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vitest hoists these to the top of the file before any imports
// ---------------------------------------------------------------------------
vi.mock("../../queue", () => ({
  addWalletSyncJob: vi.fn().mockResolvedValue("mock-job-id"),
  addExportJob: vi.fn().mockResolvedValue("mock-job-id"),
  addPriceFetchJob: vi.fn().mockResolvedValue("mock-job-id"),
  addEmailJob: vi.fn().mockResolvedValue("mock-job-id"),
  getWalletSyncQueue: vi.fn(),
  getExportQueue: vi.fn(),
  getPriceFetchQueue: vi.fn(),
  getEmailQueue: vi.fn(),
  WALLET_SYNC_QUEUE: "wallet-sync",
  EXPORT_QUEUE: "export",
  PRICE_FETCH_QUEUE: "price-fetch",
  EMAIL_QUEUE: "email",
}));

vi.mock("server-only", () => ({}));

vi.mock("../../../lib/stripe", () => ({
  stripe: {},
  getStripe: vi.fn(),
  STRIPE_PRICE_IDS: { PRO: "price_pro", BUSINESS: "price_biz", KANZLEI: "price_kanzlei" },
}));

vi.mock("../../../lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import {
  createTestUser,
  disconnectTestDb,
  DEFAULT_TEST_PASSWORD,
  prisma,
} from "../../../../../../tests/helpers/db";
import {
  createTestCaller,
  createUnauthenticatedCaller,
} from "../../../../../../tests/helpers/trpc";
import type { TestCaller } from "../../../../../../tests/helpers/trpc";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * @spec NFR-S01 — Authentication and password security
 * @spec NFR-S06 — TOTP 2FA lifecycle
 */

describe("user router — integration [NFR-S01, NFR-S06]", () => {
  let userId: string;
  let caller: TestCaller;

  beforeAll(async () => {
    const user = await createTestUser({ plan: "PRO" });
    userId = user.id;
    caller = createTestCaller(userId, "PRO");
  });

  afterAll(async () => {
    // Clean up only this suite's data
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await disconnectTestDb();
  });

  // =========================================================================
  // user.me
  // =========================================================================

  describe("user.me", () => {
    it("returns the authenticated user profile", async () => {
      const profile = await caller.user.me();

      expect(profile.id).toBe(userId);
      expect(profile.plan).toBe("PRO");
      expect(profile.totpEnabled).toBe(false);
      expect(profile).toHaveProperty("walletCount");
      expect(profile).toHaveProperty("exportCount");
      expect(profile).toHaveProperty("txCount");
    });

    it("returns correct wallet and tx counts", async () => {
      // Create a wallet and transaction for this user
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          address: "0xme00000000000000000000000000000000000001",
          chainId: 14,
          label: "Count wallet",
        },
      });

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          txHash: `0x${"a".repeat(64)}`,
          blockNumber: BigInt(1000),
          blockTimestamp: BigInt(Math.floor(Date.now() / 1000)),
          status: "GREEN",
        },
      });

      const profile = await caller.user.me();
      expect(profile.walletCount).toBeGreaterThanOrEqual(1);
      expect(profile.txCount).toBeGreaterThanOrEqual(1);

      // Clean up
      await prisma.transaction.deleteMany({ where: { walletId: wallet.id } });
      await prisma.wallet.delete({ where: { id: wallet.id } });
    });
  });

  // =========================================================================
  // user.updatePlan
  // =========================================================================

  describe("user.updatePlan", () => {
    it("updates the user plan and returns the new plan", async () => {
      const result = await caller.user.updatePlan({ plan: "BUSINESS" });
      expect(result.plan).toBe("BUSINESS");

      // Verify in DB
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(dbUser!.plan).toBe("BUSINESS");

      // Restore original plan
      await caller.user.updatePlan({ plan: "PRO" });
    });

    it("accepts all valid plan tiers", async () => {
      for (const plan of ["STARTER", "PRO", "BUSINESS", "KANZLEI"] as const) {
        const result = await caller.user.updatePlan({ plan });
        expect(result.plan).toBe(plan);
      }
      // Restore
      await caller.user.updatePlan({ plan: "PRO" });
    });
  });

  // =========================================================================
  // user.changePassword
  // =========================================================================

  describe("user.changePassword", () => {
    it("changes the password when the current password is correct", async () => {
      const newPassword = "NewSecure1!Pass";

      const result = await caller.user.changePassword({
        currentPassword: DEFAULT_TEST_PASSWORD,
        newPassword,
      });
      expect(result.success).toBe(true);

      // Verify the new hash works
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      const matches = await bcrypt.compare(newPassword, dbUser!.passwordHash);
      expect(matches).toBe(true);

      // Restore original password
      const restoredHash = bcrypt.hashSync(DEFAULT_TEST_PASSWORD, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: restoredHash },
      });
    });

    it("throws UNAUTHORIZED when the current password is wrong", async () => {
      await expect(
        caller.user.changePassword({
          currentPassword: "WrongPassword99!",
          newPassword: "DoesNotMatter1!",
        }),
      ).rejects.toThrow(/current password is incorrect/i);
    });

    it("rejects a new password that is too short", async () => {
      await expect(
        caller.user.changePassword({
          currentPassword: DEFAULT_TEST_PASSWORD,
          newPassword: "Short1!",
        }),
      ).rejects.toThrow(/at least 8 characters/i);
    });

    it("rejects a new password without an uppercase letter", async () => {
      await expect(
        caller.user.changePassword({
          currentPassword: DEFAULT_TEST_PASSWORD,
          newPassword: "nouppercase1!",
        }),
      ).rejects.toThrow(/uppercase/i);
    });

    it("rejects a new password without a number", async () => {
      await expect(
        caller.user.changePassword({
          currentPassword: DEFAULT_TEST_PASSWORD,
          newPassword: "NoNumberHere!",
        }),
      ).rejects.toThrow(/number/i);
    });
  });

  // =========================================================================
  // user.setup2fa / verify2fa / disable2fa — 2FA lifecycle
  // =========================================================================

  describe("2FA lifecycle", () => {
    it("setup2fa generates a secret and otpauthUrl", async () => {
      const result = await caller.user.setup2fa();

      expect(result.secret).toBeTruthy();
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

      // Clean up: reset secret in DB so other tests are not affected
      await prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnabled: false },
      });
    });

    it("verify2fa enables 2FA with a valid token", async () => {
      // Step 1: setup
      const setup = await caller.user.setup2fa();

      // Step 2: generate a valid token from the secret
      const validToken = authenticator.generate(setup.secret);

      const result = await caller.user.verify2fa({
        token: validToken,
        secret: setup.secret,
      });
      expect(result.success).toBe(true);

      // Verify in DB
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { totpEnabled: true },
      });
      expect(dbUser!.totpEnabled).toBe(true);

      // Clean up: disable again for subsequent tests
      const disableToken = authenticator.generate(setup.secret);
      await caller.user.disable2fa({ token: disableToken });
    });

    it("verify2fa rejects an invalid token", async () => {
      const setup = await caller.user.setup2fa();

      await expect(
        caller.user.verify2fa({ token: "000000", secret: setup.secret }),
      ).rejects.toThrow(/invalid totp token/i);

      // Clean up
      await prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnabled: false },
      });
    });

    it("setup2fa throws if 2FA is already enabled", async () => {
      // Enable 2FA first
      const setup = await caller.user.setup2fa();
      const token = authenticator.generate(setup.secret);
      await caller.user.verify2fa({ token, secret: setup.secret });

      // Attempting setup again should fail
      await expect(caller.user.setup2fa()).rejects.toThrow(
        /already enabled/i,
      );

      // Clean up
      const disableToken = authenticator.generate(setup.secret);
      await caller.user.disable2fa({ token: disableToken });
    });

    it("disable2fa removes 2FA with a valid token", async () => {
      // Enable 2FA
      const setup = await caller.user.setup2fa();
      const enableToken = authenticator.generate(setup.secret);
      await caller.user.verify2fa({ token: enableToken, secret: setup.secret });

      // Disable it
      const disableToken = authenticator.generate(setup.secret);
      const result = await caller.user.disable2fa({ token: disableToken });
      expect(result.success).toBe(true);

      // Verify in DB
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { totpEnabled: true, totpSecret: true },
      });
      expect(dbUser!.totpEnabled).toBe(false);
      expect(dbUser!.totpSecret).toBeNull();
    });

    it("disable2fa throws when 2FA is not enabled", async () => {
      await expect(
        caller.user.disable2fa({ token: "123456" }),
      ).rejects.toThrow(/not enabled/i);
    });
  });

  // =========================================================================
  // user.deleteAccount
  // =========================================================================

  describe("user.deleteAccount", () => {
    it("deletes the account with correct password and confirmation", async () => {
      // Create a disposable user for deletion test
      const disposableUser = await createTestUser({ plan: "STARTER" });
      const disposableCaller = createTestCaller(
        disposableUser.id,
        "STARTER",
      );

      const result = await disposableCaller.user.deleteAccount({
        password: DEFAULT_TEST_PASSWORD,
        confirmation: "DELETE",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("permanently deleted");

      // Verify user no longer exists
      const gone = await prisma.user.findUnique({
        where: { id: disposableUser.id },
      });
      expect(gone).toBeNull();
    });

    it("throws when the password is incorrect", async () => {
      await expect(
        caller.user.deleteAccount({
          password: "WrongPassword!",
          confirmation: "DELETE",
        }),
      ).rejects.toThrow(/invalid password/i);
    });

    it("throws when confirmation is not DELETE", async () => {
      await expect(
        caller.user.deleteAccount({
          password: DEFAULT_TEST_PASSWORD,
          // @ts-expect-error — testing runtime validation
          confirmation: "REMOVE",
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Unauthenticated access
  // =========================================================================

  describe("unauthenticated access", () => {
    it("throws UNAUTHORIZED for user.me", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(anonCaller.user.me()).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for user.updatePlan", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.user.updatePlan({ plan: "PRO" }),
      ).rejects.toThrow(/logged in/i);
    });

    it("throws UNAUTHORIZED for user.changePassword", async () => {
      const anonCaller = createUnauthenticatedCaller();
      await expect(
        anonCaller.user.changePassword({
          currentPassword: "x",
          newPassword: "NewPass1!",
        }),
      ).rejects.toThrow(/logged in/i);
    });
  });
});
