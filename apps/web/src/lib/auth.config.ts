import type { NextAuthConfig } from "next-auth";

// ---------------------------------------------------------------------------
// Edge-compatible auth configuration
// ---------------------------------------------------------------------------
// This file contains ONLY the auth config that can run in the Edge Runtime
// (middleware). It must NOT import any Node.js-only modules (Prisma, Redis,
// bcryptjs, otplib, etc.). The full provider config is in auth.ts.
// ---------------------------------------------------------------------------

export const authConfig: NextAuthConfig = {
  // Required for deployment behind Coolify/Traefik reverse proxy.
  // Without this, NextAuth rejects forwarded Host headers → Configuration error.
  trustHost: true,
  // Explicit secret: NextAuth v5 beta looks for AUTH_SECRET env var first,
  // but Coolify/Docker may set NEXTAUTH_SECRET — support both.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
  // No adapter needed: Credentials provider + JWT strategy manages sessions
  // entirely via signed cookies — no DB session tables required.
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/error",
  },
  providers: [], // Populated in auth.ts (Node.js runtime only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.plan = (user as { plan?: string }).plan ?? "free";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { plan?: string }).plan = token.plan as string;
      }
      return session;
    },
  },
};
