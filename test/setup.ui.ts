// jsdom project setup. Kept intentionally small — vitest's built-in `expect`
// covers everything we need for the current UI suite, so we don't pull in
// @testing-library/jest-dom matchers. Add them here if/when a test wants
// `toBeInTheDocument` and friends.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node >= 22 (experimental) ships a `localStorage` global that's undefined
// without --localstorage-file. That shadows jsdom's working implementation
// in vitest 2.x: populateGlobal sees `localStorage in global`, treats it as
// already-present, and skips installing the jsdom-backed getter. Re-bind the
// jsdom-owned storage onto globalThis so test code can use bare
// `localStorage` / `sessionStorage` just like the browser.
{
  // vitest exposes the JSDOM instance on globalThis.jsdom.
  const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
  if (dom) {
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      const storage = dom.window[name];
      if (storage) {
        Object.defineProperty(globalThis, name, {
          value: storage,
          writable: true,
          configurable: true,
        });
      }
    }
  }
}

// Unmount any roots left behind between tests so a stray query in test N+1
// doesn't pick up nodes from test N.
afterEach(() => {
  cleanup();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
