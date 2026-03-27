import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        ".next/",
        "tests/",
        "**/*.config.ts",
        "**/*.config.js",
        "**/types/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@defi-tracker/db": path.resolve(__dirname, "packages/db/src"),
      "@defi-tracker/shared": path.resolve(__dirname, "packages/shared/src"),
      "@defi-tracker/ui": path.resolve(__dirname, "packages/ui/src"),
      "@defi-tracker/config": path.resolve(__dirname, "packages/config"),
      "@/": path.resolve(__dirname, "apps/web/src") + "/",
    },
  },
});
