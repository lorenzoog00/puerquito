import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(__dirname, "shared") } },
  test: {
    environment: "node",
    env: { NODE_ENV: "test" },
    setupFiles: ["./server/__tests__/helpers/setup.ts"],
    fileParallelism: false,
  },
});
