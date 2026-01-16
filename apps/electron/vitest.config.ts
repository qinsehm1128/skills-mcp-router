import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".webpack", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        ".webpack/**",
        "e2e/**",
        "test/**",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mcp_router/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@mcp_router/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
