import { defineConfig } from 'vitest/config';

// Two projects so hook/component tests get jsdom while the existing server +
// formatter tests keep running under plain Node (faster, fewer globals).
//
// node — server supertest cases + src utils with no DOM deps.
// ui — React hooks and components (jsdom).
export default defineConfig({
  test: {
    testTimeout: 10_000,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'server/**/*.test.{js,ts}',
            'src/utils/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        // vite.config.ts is not loaded here, so __BUILD_ID__ (injected there
        // via `define`) would be undefined under test. Pin it: the real value
        // embeds a build timestamp and would make assertions non-deterministic.
        // `define` must sit on the project, not the root config -- projects do
        // not inherit it.
        // Deliberately not real values: these are fixtures, not mirrors of
        // package.json, and must not need editing on a version bump.
        define: {
          __APP_VERSION__: JSON.stringify('0.0.0-test'),
          __BUILD_ID__: JSON.stringify('0.0.0-test+testbuild.2601010000'),
        },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: [
            'src/hooks/**/*.test.{ts,tsx}',
            'src/components/**/*.test.{ts,tsx}',
            'src/pages/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['./test/setup.ui.ts'],
        },
      },
    ],
  },
});
