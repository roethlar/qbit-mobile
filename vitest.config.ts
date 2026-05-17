import { defineConfig } from 'vitest/config';

// Shared defaults. The actual project split lives in vitest.workspace.ts —
// vitest 2.x requires a separate workspace file for multi-environment runs.
export default defineConfig({
  test: {
    testTimeout: 10_000,
  },
});
