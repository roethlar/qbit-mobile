import { defineWorkspace } from 'vitest/config';

// Two projects so hook/component tests get jsdom while the existing server +
// formatter tests keep running under plain Node (faster, fewer globals).
//
// node — server supertest cases + src utils with no DOM deps.
// ui — React hooks and components (jsdom).
export default defineWorkspace([
  {
    test: {
      name: 'node',
      environment: 'node',
      include: [
        'server/**/*.test.{js,ts}',
        'src/utils/**/*.test.{ts,tsx}',
      ],
      setupFiles: ['./test/setup.ts'],
      testTimeout: 10_000,
    },
  },
  {
    test: {
      name: 'ui',
      environment: 'jsdom',
      include: [
        'src/hooks/**/*.test.{ts,tsx}',
        'src/components/**/*.test.{ts,tsx}',
        'src/pages/**/*.test.{ts,tsx}',
      ],
      setupFiles: ['./test/setup.ui.ts'],
      testTimeout: 10_000,
    },
  },
]);
