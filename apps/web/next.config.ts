import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@defi-tracker/shared", "@defi-tracker/db"],
  serverExternalPackages: ["argon2", "otplib", "@prisma/client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Type checking done in CI — Docker builds skip to avoid Coolify ARG injection issues
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
