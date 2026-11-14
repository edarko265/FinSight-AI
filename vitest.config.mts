import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      // The real package throws outside a server bundle; tests run the server code directly.
      "server-only": path("./tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
