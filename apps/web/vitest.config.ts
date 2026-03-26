import { defineConfig, mergeConfig } from "vitest/config";
import path from "node:path";
import rootConfig from "../../vitest.config";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["../../tests/setup.ts"],
      include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@defi-tracker/db": path.resolve(__dirname, "../../packages/db/src"),
        "@defi-tracker/shared": path.resolve(__dirname, "../../packages/shared/src"),
        "@defi-tracker/ui": path.resolve(__dirname, "../../packages/ui/src"),
        "@defi-tracker/config": path.resolve(__dirname, "../../packages/config"),
      },
    },
  }),
);
