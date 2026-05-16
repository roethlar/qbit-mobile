import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.{js,ts}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10_000,
  },
});
