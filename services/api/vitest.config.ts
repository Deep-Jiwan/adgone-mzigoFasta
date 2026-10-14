import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests share one database and truncate it between tests.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
