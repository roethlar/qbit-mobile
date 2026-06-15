// localStorage can throw or be absent (private-mode quirks, disabled storage,
// sandboxed iframes). Wrap access so theme/filter init and persistence degrade
// gracefully instead of crashing the app on first render.
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
