import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@defi-tracker/db";
import { hashPassword } from "@/lib/auth-utils";
import { checkRateLimit } from "@/lib/rate-limit";

/** 5 registration attempts per 15 minutes per IP */
const REGISTER_RATE_LIMIT = 5;
const REGISTER_WINDOW_MS = 15 * 60 * 1_000;

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(request: NextRequest) {
  try {
    // --- Rate limiting (per IP) ---
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = await checkRateLimit(
      `register:${ip}`,
      REGISTER_RATE_LIMIT,
      REGISTER_WINDOW_MS,
    );

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetInMs / 1_000);
      return NextResponse.json(
        { message: "Too many registration attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { message: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
      select: { id: true },
    });

    // Create default notification preferences (best-effort — table may not exist yet)
    try {
      await prisma.notificationPreference.create({
        data: {
          userId: user.id,
          exportComplete: false,
          syncError: false,
          taxReminder: false,
        },
      });
    } catch {
      // notification_preferences table may not exist if migration 0002 hasn't been applied
    }

    return NextResponse.json({ message: "Account created" }, { status: 201 });
  } catch (error) {
    console.error("[register] Registration failed:", error);
    return NextResponse.json(
      { message: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
