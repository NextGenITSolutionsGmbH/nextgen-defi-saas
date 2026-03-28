import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@defi-tracker/db";
import { verifyPassword, verifyTOTP } from "./auth-utils";
import { checkRateLimit } from "./rate-limit";
import { authConfig } from "./auth.config";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpToken: z.string().length(6).optional(),
});

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpToken: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const ip = (request?.headers as Headers)?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

        // Rate limit by IP: 10 attempts per 15 minutes
        const ipLimit = await checkRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000);
        if (!ipLimit.success) {
          throw new Error("RATE_LIMITED");
        }

        // Rate limit by email: 5 attempts per 15 minutes
        const emailLimit = await checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
        if (!emailLimit.success) {
          throw new Error("RATE_LIMITED");
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            plan: true,
            totpEnabled: true,
            totpSecret: true,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // 2FA enforcement
        if (user.totpEnabled && user.totpSecret) {
          if (!parsed.data.totpToken) {
            throw new Error("TOTP_REQUIRED");
          }
          const totpValid = verifyTOTP(parsed.data.totpToken, user.totpSecret);
          if (!totpValid) {
            throw new Error("INVALID_TOTP");
          }
        }

        return {
          id: user.id,
          email: user.email,
          plan: user.plan,
        };
      },
    }),
  ],
});

declare module "next-auth" {
  interface User {
    plan?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    plan: string;
  }
}
