import { describe, it, expect, afterEach } from 'vitest';
import { readStorage, writeStorage } from './safeStorage';

// src/utils/* runs under the node vitest project (no jsdom), so install a
// fake localStorage on globalThis rather than relying on a DOM-provided one.
const realDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function setLocalStorage(impl: unknown) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: impl,
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  if (realDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', realDescriptor);
  } else {
    setLocalStorage(undefined);
  }
});

describe('safeStorage', () => {
  it('returns null instead of throwing when getItem throws', () => {
    setLocalStorage({ getItem: () => { throw new Error('storage blocked'); } });
    expect(readStorage('k')).toBeNull();
  });

  it('swallows setItem errors instead of throwing', () => {
    setLocalStorage({ setItem: () => { throw new Error('storage blocked'); } });
    expect(() => writeStorage('k', 'v')).not.toThrow();
  });

  it('round-trips a value when storage works', () => {
    const store = new Map<string, string>();
    setLocalStorage({
      getItem: (k: string) => (store.has(k) ? store.get(k) : null),
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
    writeStorage('k', 'v');
    expect(readStorage('k')).toBe('v');
  });
});
