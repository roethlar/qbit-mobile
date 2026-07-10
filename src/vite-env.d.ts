/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected at build time by vite.config.ts. See build-id.ts. */

/** Display version, e.g. "1.6.0". Bumped on every shipped-code commit. */
declare const __APP_VERSION__: string;

/** Full build fingerprint. Debugging aid only -- do not show as the version. */
declare const __BUILD_ID__: string;
