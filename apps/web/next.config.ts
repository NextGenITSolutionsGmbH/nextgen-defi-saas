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
    ignoreDuringBuilds: true, // TODO: Fix ESLint config, then set to false
  },
  typescript: {
    ignoreBuildErrors: true, // TODO: Fix type errors from agent integration, then set to false
  },
};

export default nextConfig;
