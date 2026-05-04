# qBit Mobile — Code Review

Review date: 2026-05-04
Scope: full repository at HEAD (commit `18a898a`).

---

## 1. Summary

qBit Mobile is a small, cohesive React 18 + TypeScript + Vite SPA fronting a thin Express proxy to qBittorrent's WebUI API. The codebase is in good shape for its size: TypeScript strict mode is on, the recent refactors landed an `ErrorBoundary`, modularized the server, and fixed the GET-body proxy bug. However, there are two parallel API clients (`api.ts` and `directApi.ts`) with diverging responsibilities, several pieces of dead code (`TorrentList.tsx`, `LoginForm.tsx`, three duplicate types files), and authentication is handled via a single shared session cookie on the server with no CSRF protection — which is acceptable only because the project assumes a fully trusted local network. The `Settings` page is the weakest link: it calls a PUT-style API with a malformed payload (`{ json: ... }` as a JSON body instead of a urlencoded `json=...` field), saves on every keystroke, and has no actual save button. There are zero tests, several `any` casts, and a few subtle React state bugs around stale closures and form-modal lifecycle.

---

## 2. Critical issues

### C1. `setPreferences` sends the wrong content-type/body shape — settings will silently fail
- **File:** `src/services/api.ts:254-258`
- **Problem:** `qbApi.setPreferences()` sends `{ json: JSON.stringify(prefs) }` as a JSON body. qBittorrent's `/app/setPreferences` expects `application/x-www-form-urlencoded` with a single field named `json` whose value is the serialized preferences object. Axios will serialize the object as JSON (with `Content-Type: application/json`), which qBittorrent does not accept — so every change in `Settings.tsx` round-trips a 400 / "no change" silently while the optimistic UI shows "Settings saved successfully!".
- **Impact:** Speed limits, save path, and any future preference changes appear to save but never persist. This is user-visible data loss.
- **Fix:**
  ```ts
  await api.post('/app/setPreferences', new URLSearchParams({ json: JSON.stringify(prefs) }));
  ```

### C2. Settings page saves on every keystroke
- **File:** `src/pages/Settings.tsx:147,169,195`
- **Problem:** `onChange` handlers on the download/upload limit and save-path inputs call `savePreferences` directly, firing one API call per character typed. Combined with C1, this is also a torrent of failing requests, but even when fixed it would be a usability problem (and a way to hammer qBittorrent).
- **Impact:** Wasted network, race conditions where last-write-wins on the server may not match what the user is currently typing, and the "Saved successfully" toast flickers continuously.
- **Fix:** Add explicit Save / Cancel buttons, or debounce (`setTimeout` cleared on the next change) by ~500 ms before calling `savePreferences`.

### C3. Server CORS allows any origin with no auth — open relay if exposed
- **File:** `server/server.js:20-28`
- **Problem:** `Access-Control-Allow-Origin: *` is hard-coded for `/api/v2`. Combined with the proxy injecting an authenticated `Cookie` server-side, any web page a user visits in a browser that can reach the proxy host can drive arbitrary qBittorrent actions (add torrents, delete data, change settings) via simple `fetch`. There is no Origin/Referer check, no CSRF token, no auth on the proxy itself.
- **Impact:** If the proxy is reachable from a user's browser (LAN or, worse, port-forwarded), this is a remote-control vulnerability. Drive-by torrent injection / data destruction is the realistic threat.
- **Fix:** Remove the wildcard CORS header (the SPA is same-origin with the proxy). If CORS is genuinely needed, allow only an explicit, configurable origin and reject when missing. Also consider a proxy-side shared secret or rate limiter, and document that this app must not be exposed to untrusted networks.

### C4. SPA fallback intercepts API 404s and serves `index.html`
- **File:** `server/server.js:67-72`
- **Problem:** `app.get('*', …)` is registered after the API routes, but it catches *any* unmatched GET — including misspelled `/api/v2/...` paths or future API routes that don't yet exist on the server. The client receives a 200 OK with an HTML body and `axios` blows up parsing JSON, producing confusing errors.
- **Impact:** Hard-to-debug client errors when the server proxy doesn't recognize a path.
- **Fix:** Either guard the catch-all (`if (req.path.startsWith('/api/')) return res.status(404).end()`) or scope it: `app.get(/^(?!\/api).*/, …)`.

### C5. Race condition in API singleton re-auth path
- **File:** `src/services/api.ts:144-162`
- **Problem:** On 401, the code sets `this.initPromise = null` and calls `await this.initialize()`. Multiple concurrent requests (the dashboard fires several in parallel via React Query) can each see `initPromise === null`, all enter `initialize()` simultaneously, and create competing logins. Worse, by the time the first request reaches its retry (line 152), `initPromise` may already have been reset by another in-flight handler.
- **Impact:** Thundering-herd login storm against qBittorrent; some retries will succeed against a session that was already invalidated by a sibling login.
- **Fix:** Guard with a single in-flight `Promise<void>` reference and only null it on success/terminal failure, not before re-init. Better: drop this client entirely (see High-priority H1).

### C6. Singleton `QBittorrentAPI.getInstance()` triggers auth at module load
- **File:** `src/services/api.ts:20-27`
- **Problem:** `export const qbApi = QBittorrentAPI.getInstance();` runs on first import, which calls `initialize()` (a fire-and-forget `api.post('/auth/login', …)`) before any React component has mounted. If `directApi.ts`-driven flows have already established the proxy session, this duplicate empty-credential login may or may not invalidate it depending on qBittorrent config. Errors in initialize are swallowed.
- **Impact:** Subtle login interleaving with the server-side cookie cache; unhandled promise rejections in the console; harder testing because importing the module has side effects.
- **Fix:** Lazy-init on first method call, not at module load. Don't auto-fire empty-credential login; only call when needed.

### C7. `multer` accepts any file size with no limits
- **File:** `server/routes/torrents.js:6` (`const upload = multer();`)
- **Problem:** No `limits` are configured. A user (or attacker, given C3) can upload arbitrarily large bodies, all buffered in memory (default storage). One large POST can OOM the Node process.
- **Impact:** Trivial DoS, especially exposed because of C3.
- **Fix:**
  ```js
  const upload = multer({ limits: { fileSize: 10 * 1024 * 1024, files: 50 } });
  ```

### C8. `tsconfig.node.json` triggers TS6310 build warning
- **File:** `tsconfig.node.json:1-11`
- **Problem:** A composite project reference (`composite: true`) cannot have `noEmit: true`. `tsc --noEmit` from `tsconfig.json` errors with `TS6310: Referenced project '…/tsconfig.node.json' may not disable emit.` This breaks `npm run typecheck` (exit code 2).
- **Impact:** CI-style typechecks fail; developers learn to ignore type errors.
- **Fix:** Remove `noEmit: true` from `tsconfig.node.json` and instead set `"emitDeclarationOnly": true` plus a `"outDir"`, or drop `composite: true` and the project reference, since this codebase doesn't actually need incremental builds.

### C9. URL "info-hash" validation accepts only v1 hashes; rejects valid magnets/URLs subtly
- **File:** `src/components/AddTorrent.tsx:34-42`
- **Problem:** The regex `^[a-f0-9]{40}$` accepts only lowercase v1 (SHA-1) info hashes. v2 (SHA-256) hashes are 64 hex chars, and uppercase v1 hashes are common in copy-paste. Also, magnet links sometimes start with whitespace or `magnet:?xt=urn:btih:HASH&...` written without the trailing `?` — current logic only checks `magnet:?` prefix.
- **Impact:** Users entering perfectly valid info hashes (e.g. uppercase, v2) get "Enter a magnet link, URL, or info hash" rejection.
- **Fix:**
  ```ts
  const isValid =
    /^magnet:\?/i.test(trimmed) ||
    /^https?:\/\//i.test(trimmed) ||
    /^[a-f0-9]{40}$/i.test(trimmed) ||
    /^[a-f0-9]{64}$/i.test(trimmed);
  ```

---

## 3. High priority

### H1. Two parallel API clients with overlapping concerns
- **Files:** `src/services/api.ts` (266 lines) and `src/services/directApi.ts` (73 lines)
- **Problem:** `directApi.ts` is the simple functional client used by torrent hooks. `api.ts` is the class-based singleton used only by `Settings.tsx` and contains an entire stale auth/retry layer that overlaps with the server's own session handling. They duplicate `getTorrents`, `pauseTorrent`, `resumeTorrent`, `deleteTorrent`, `addTorrent` etc. with slightly different behaviors. Maintaining two clients invites drift bugs.
- **Fix:** Pick one. Move `getPreferences` / `setPreferences` (and `getVersion`, `getTorrentInfo`, etc., if needed later) into `directApi.ts`. Delete `api.ts`.

### H2. `App.tsx` is missing `<QueryClientProvider>` boundary considerations
- **File:** `src/App.tsx:9-30`
- **Problem:** `ErrorBoundary` wraps `ThemeProvider` but the `QueryClientProvider` is in `main.tsx` outside the boundary. If React Query throws (rare but possible during render of an error state), the boundary will not catch it. Also, `onLogout: () => {}` is a vestigial no-op prop — the `LoginForm` flow has been removed but the prop and `handleLogout` remain.
- **Fix:** Move `QueryClientProvider` inside `ErrorBoundary` (or vice-versa, depending on what you want errors to look like). Drop `onLogout`/`handleLogout` from `Dashboard` and `App`.

### H3. Stats hide-on-scroll listener never fires
- **File:** `src/pages/Dashboard.tsx:101-112`
- **Problem:** The effect listens to `window.scroll`, but the actual scrolling container is the inner `flex-1` div with `overflow-auto` (the torrent list — see `CompactTorrentList.tsx:232`). `window.scrollY` always stays 0, so `setShowStats(false)` is never reached. There's also a `scrollableRef` declared (line 23) and never attached.
- **Impact:** Dead feature; a state variable causing unnecessary effect re-subscribes.
- **Fix:** Either remove the feature or attach the ref to the scroll container and listen on that element. The current `showStats` state is also referenced nowhere in JSX.

### H4. `useTorrentFilters` paginates to 5000 — slicing is dead code
- **File:** `src/hooks/useTorrentFilters.ts:22, 106-111`
- **Problem:** `itemsPerPage = 5000` is effectively "no pagination", but the hook still computes `paginatedTorrents` via `slice`, exposes `totalPages`, `currentPage`, and `setCurrentPage`. The component (`CompactTorrentList`) doesn't consume `paginatedTorrents` at all (line 233 maps `filteredAndSortedTorrents` directly), so the slice is wasted on every torrent update. `setCurrentPage(1)` calls on search/sort/tag change are no-ops in user-visible terms.
- **Impact:** Misleading API surface, extra array allocation every 5 s. Users with > 5000 torrents will silently truncate.
- **Fix:** Either implement real pagination/virtualization (recommended; see M9) or drop pagination entirely and remove `paginatedTorrents`/`totalPages`/`currentPage`.

### H5. Filter buttons recompute on every render and traverse the list 4x
- **File:** `src/pages/Dashboard.tsx:93-99`
- **Problem:** The `filters` array calls `torrents.filter(...)` four times every render, in addition to the main `filteredTorrents` computation (line 37). Combined with the `useTorrentFilters` `availableTags`/`filteredAndSortedTorrents` recomputations downstream, every 5 s tick walks the list ~6 times.
- **Impact:** Linear in #torrents, noticeable on phones with several thousand torrents.
- **Fix:** Single pass with reduce to compute counts; wrap in `useMemo` keyed on `torrents`.

### H6. `Dashboard.handleAddTorrent*` modal closes before request completes
- **Files:** `src/pages/Dashboard.tsx:63-91`, `src/components/AddTorrent.tsx:45-48, 53-60`
- **Problem:** `AddTorrent.handleSubmitUrl` calls `onAddUrl(...)` (sync void return) and *immediately* invokes `onClose()`. The Dashboard handler then `await`s the mutation but the modal is already gone. If the request fails, `addError` flashes but the user has lost the URL they typed and any options they configured. Also, `handleSubmitUrl` is not `async`, so errors thrown synchronously (none today, but easy to add) escape unhandled.
- **Impact:** User frustration when a URL is rejected (bad host, bad torrent file, bad path); they retype from scratch.
- **Fix:** Make `onAddUrl`/`onAddFile` return `Promise<void>` (the type already widens correctly), keep the modal open during the request with a spinner, and only close on success.

### H7. `parseInt` without radix on user input
- **File:** `src/pages/Settings.tsx:147, 169`
- **Problem:** `parseInt(e.target.value)` without radix. Modern engines default to 10 for non-`0`-prefixed strings, but linters and many style guides flag this. More importantly, `parseInt` accepts garbage prefixes (`"123abc"` → `123`) which doesn't match the input's `type="number"` semantics.
- **Fix:** Use `Number(e.target.value)` or `parseInt(value, 10)` and explicitly handle `NaN`.

### H8. Login session cookie is module-global and unbounded in qbClient
- **File:** `server/qbClient.js:8`
- **Problem:** `let sessionCookie` is a single global variable shared across all incoming requests. Any 401 mutates it; concurrent re-logins (see C5) will race and overwrite each other. There is no lock. The cookie is also never cleared on shutdown, and there's no expiration handling beyond reactive 401 retry.
- **Impact:** Same race as C5, but on the server. Under load, 401-driven re-logins can stomp each other.
- **Fix:** Wrap login in a single in-flight promise (memoized until it settles), invalidate only on terminal failure.

### H9. Initial-login on server startup bypasses the same retry/lock logic
- **File:** `server/server.js:82-86`, `server/qbClient.js:76-87`
- **Problem:** `initialLogin()` calls `makeQbRequest('POST', '/auth/login', …)` which itself has 401-retry logic. If qBittorrent is down at boot, the server logs "Initial authentication skipped" but then every subsequent request goes through the 401 path and retries login. The server stays up, which is good — but errors are silently swallowed at startup.
- **Fix:** Add a small backoff/retry at startup (3 attempts, 5 s apart) so transient unavailability resolves itself.

### H10. `console.error` everywhere; no real telemetry, no log levels
- **Files:** all of `src/services/api.ts`, `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`; `server/*.js`
- **Problem:** Mixed `console.error`/`console.log`. In the server, errors stringify `error.message` only — losing the stack and the response body for non-axios errors. In the client, errors are logged to the console even though the user already sees toasts; this is just dev clutter at runtime.
- **Fix:** Add a tiny logger module on each side (or use `pino` server-side). Strip client-side `console.*` in production via the existing Vite build (or guard with `import.meta.env.DEV`).

### H11. Re-auth retry path in `getTorrents` only re-authenticates for that endpoint
- **File:** `src/services/api.ts:128-163`
- **Problem:** Only `getTorrents` has the 401 → re-init → retry pattern. `getGlobalTransferInfo`, `getPreferences`, `getTorrentInfo`, etc. don't. So a 401 on `/transfer/info` will surface to React Query as a permanent failure, even though the singleton would happily re-login if asked.
- **Fix:** Move the retry into an axios response interceptor on the `api` instance so every method benefits, or (preferably) delete the client per H1.

### H12. `useDirectTorrents` polls every 5 s with no pause-on-hidden / pause-on-error
- **File:** `src/hooks/useDirectTorrents.ts:5-13`
- **Problem:** `refetchInterval: 5000` runs even when the tab is hidden or the device is offline. `retry: false` is set, but `refetchIntervalInBackground` defaults to false (good) — however the `staleTime: 3000` and `placeholderData` ordering means a fresh paint may show stale data immediately followed by a refetch. Also, when a request errors out, the timer keeps firing, hammering the server.
- **Fix:** Add `refetchOnReconnect`, set `refetchInterval` to a function that returns `false` on consecutive failures, and `refetchIntervalInBackground: false` explicitly.

---

## 4. Medium priority

### M1. Dead code: `TorrentList.tsx` is no longer referenced
- **File:** `src/components/TorrentList.tsx` (entire 221-line file)
- **Problem:** Replaced by `CompactTorrentList`; nothing imports `TorrentList`.
- **Fix:** Delete it.

### M2. Dead code: `LoginForm.tsx` is no longer referenced
- **File:** `src/components/LoginForm.tsx` (entire 110-line file)
- **Problem:** No login flow exists; `App.tsx` always renders `Dashboard` first. The component is unused.
- **Fix:** Delete it (and the related `onLogout` plumbing in `Dashboard`/`App`).

### M3. Duplicate type files
- **Files:** `src/types/torrent.ts`, `src/types/preferences.ts`, `src/types/globalTransfer.ts`
- **Problem:** All consumers `import type ... from '../types/qbittorrent'`. The three split files are unused. They also contain richer JSDoc, suggesting they were intended to replace `qbittorrent.ts` but the migration was abandoned mid-flight. (E.g., `torrent.ts` declares `infohash_v2?` optional; the canonical file has it required — drift bug waiting to surface.)
- **Fix:** Either delete the three orphan files, or finish the migration: re-export the split files from `qbittorrent.ts` (or delete `qbittorrent.ts` and update all imports).

### M4. Unused state, ref, and import in `Dashboard`
- **File:** `src/pages/Dashboard.tsx:1, 8, 22-23`
- **Problem:** `useRef`, `formatBytes`, `Card`, `isPullingToRefresh` and `scrollableRef` are imported/declared but never used or never read (only set).
- **Fix:** Remove. `noUnusedLocals` is enabled in `tsconfig.json` but `useState`'s setter "uses" the variable, so TS doesn't flag.

### M5. `as SortField`/`as SortOrder` casts on `localStorage` values are unsound
- **File:** `src/hooks/useTorrentFilters.ts:13, 17`
- **Problem:** `(saved as SortField)` accepts any string from `localStorage` as a valid `SortField`. A garbage value persists into state and falls through the `switch` to `default: return 0`, silently disabling sorting. Same risk for `SortOrder`.
- **Fix:**
  ```ts
  const VALID_SORTS: readonly SortField[] = ['name','size','progress','dlspeed','upspeed','added_on','state'];
  const saved = localStorage.getItem('qbit-sort-by');
  return VALID_SORTS.includes(saved as SortField) ? (saved as SortField) : 'name';
  ```

### M6. Three separate `useEffect`s to write three localStorage keys
- **File:** `src/hooks/useTorrentFilters.ts:113-123`
- **Problem:** Each setter triggers a render, then an effect, then a `localStorage.setItem`. Combine and skip the effect by writing inside the setter wrappers, or wrap in a single effect.
- **Fix:** A small `useStickyState` helper that synchronously persists.

### M7. `error: any` casts in `Dashboard`
- **File:** `src/pages/Dashboard.tsx:70, 85`
- **Problem:** `catch (error: any)` and indexing `error.response.data.error`, `error.message`. Use `unknown` and narrow.
- **Fix:**
  ```ts
  catch (e) {
    const err = e as { response?: { data?: { error?: string } }, message?: string };
    setAddError(err.response?.data?.error ?? err.message ?? 'Failed');
  }
  ```

### M8. `value: any` in `TorrentOptions.updateOption`
- **File:** `src/components/AddTorrent.tsx:161`
- **Problem:** `updateOption = (key: keyof AddTorrentOptions, value: any)` defeats type safety on the value side. Generic over `K extends keyof AddTorrentOptions` resolves it.
- **Fix:**
  ```ts
  const updateOption = <K extends keyof AddTorrentOptions>(key: K, value: AddTorrentOptions[K]) =>
    onChange({ ...options, [key]: value });
  ```

### M9. List has no virtualization for large torrent counts
- **File:** `src/components/CompactTorrentList.tsx:232-241`
- **Problem:** `filteredAndSortedTorrents.map(...)` renders all rows directly. Combined with the 5 s polling refetch (which produces a new array reference), every 5 s every row reconciles. With a few thousand torrents this is a noticeable jank on mobile. Note: previous virtualization was reverted (see commit 18a898a) — that's a known trade-off, but pagination would help and is already plumbed (H4).
- **Fix:** Either re-introduce virtualization carefully, or paginate at e.g. 100 rows with infinite scroll.

### M10. Filter strings are duplicated in three places
- **Files:** `src/pages/Dashboard.tsx:37-50, 93-99`
- **Problem:** State arrays `['downloading','stalledDL','queuedDL','metaDL']` etc. are duplicated between the filter logic and the count logic.
- **Fix:** Hoist into a `FILTER_GROUPS` map and iterate once.

### M11. `formatBytes` log-of-zero / negative-size edge cases
- **File:** `src/utils/formatters.ts:1-11`
- **Problem:** `Math.log(bytes)` on negative `bytes` returns `NaN`, producing `"NaN B"`. Also, very small `bytes` (e.g., 0.5) compute `i = -1` indexing `sizes[-1]` → `undefined`. qBittorrent reports `-1` for "no limit" in many fields.
- **Fix:** Clamp at the top: `if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';` and `i = Math.min(Math.max(i, 0), sizes.length - 1)`.

### M12. `formatTime` has a magic number for "infinity"
- **File:** `src/utils/formatters.ts:18`
- **Problem:** `seconds === 8640000` is qBittorrent's sentinel for "infinity ETA" (100 days in seconds). Not commented; the next reader will scratch their head.
- **Fix:** Add a constant `const QBIT_INFINITE_ETA = 8640000;` with a comment.

### M13. `getStateText` returns emojis used for sort comparison
- **Files:** `src/hooks/useTorrentFilters.ts:84-87` (sort by `state` uses emoji string), `src/utils/formatters.ts:94-131`
- **Problem:** Sorting by "state" actually sorts by emoji codepoint, which yields a meaningless visual order. The user picking "Status" sort sees a near-random arrangement.
- **Fix:** Sort by the canonical `state` enum string or a custom priority order (downloading > seeding > paused > error etc.).

### M14. `BottomSheet` has no focus trap, no Escape, no aria-modal
- **File:** `src/components/Layout.tsx:90-117`
- **Problem:** Mobile-first but a sheet without `role="dialog"`, `aria-modal="true"`, focus trap, or Escape-to-close. iOS VoiceOver users can navigate to elements behind the overlay.
- **Fix:** Add ARIA attributes; on `isOpen`, move focus to the first focusable element; on Escape, call `onClose()`. Also lock body scroll while open (current implementation lets the underlying list scroll).

### M15. Tab buttons in `AddTorrent` have no `role="tab"`/`tablist`
- **File:** `src/components/AddTorrent.tsx:83-106`
- **Problem:** The two-segment URL/File switch is presented visually as tabs but uses bare `<button>`s without `role="tab"`, `aria-selected`, or `role="tablist"`. Screen readers announce two unrelated buttons.
- **Fix:** Add the standard tab roles and `aria-controls`/`aria-labelledby`.

### M16. `<button>` with `✕` text inside `BottomSheet` has no `aria-label`
- **File:** `src/components/Layout.tsx:103-109`
- **Problem:** Close button is a literal "✕" with no accessible name.
- **Fix:** Add `aria-label="Close"`.

### M17. `min="0"` on number input but JS clamps with `Math.max(0,...)`
- **File:** `src/pages/Settings.tsx:147, 169`
- **Problem:** Input has `min="0"` but no `max`, no `step`. Negative input is allowed in some browsers (typing `-` then digits). Defensive `Math.max(0, …)` exists but doesn't guard against absurdly large numbers (overflow into qBittorrent's int parser).
- **Fix:** `max="1048576"` (1 GB/s upper bound) and `step="1"`.

### M18. `addTorrent` upload uses `/api/v2` proxy then re-uses session cookie — but `multer` strips multipart streaming
- **File:** `server/routes/torrents.js:8-32`
- **Problem:** Files are buffered fully in memory before being re-encoded with `form-data`. For a 50 MB `.torrent` (rare but legal) this doubles memory. Also, the rebuilt `FormData` includes `Object.entries(req.body)` — fine for documented options but skips boolean conversion. Booleans arrive as the strings `"true"`/`"false"` which qBittorrent does accept, so it works, but the round-trip is unnecessary.
- **Fix:** Use `multer().single('torrents')` instead of `.any()` (you control the field name); set a body-size limit. Consider streaming via `proxy.web()` for large files.

### M19. `proxy.timeout` is 60 s for dev, 30 s for client + axios in server — fragmented timeouts
- **Files:** `vite.config.ts:15`, `src/services/directApi.ts:6`, `src/services/api.ts:7`, `server/qbClient.js:18`
- **Problem:** Four different timeouts (60 s dev proxy, 30 s on each axios client). For a torrent list with thousands of items, the first fetch can take > 30 s. The 30 s axios client wins; the 60 s dev proxy is unreachable.
- **Fix:** Document one timeout (probably 60 s in production) and apply it consistently.

### M20. `formData.append(key, value)` accepts `boolean` without conversion in Settings preferences
- **File:** `src/services/api.ts:218-223`
- **Problem:** `value.toString()` works for booleans but qBittorrent expects `0`/`1` for some preference fields. The API surface here doesn't enforce that mapping.
- **Fix:** Document expected encoding, or wrap in a typed helper.

### M21. `addTorrentUrl` and `addTorrentFile` mutations don't invalidate `global-stats`
- **File:** `src/hooks/useDirectTorrents.ts:51-65`
- **Problem:** After adding, the global-stats card may show stale "free space" / counters until next 5 s tick.
- **Fix:** `invalidateQueries({ queryKey: ['global-stats'] })` in onSuccess too.

### M22. `pause`/`resume`/`delete` mutations have no optimistic update
- **File:** `src/hooks/useDirectTorrents.ts:29-49`
- **Problem:** UI waits for the next 5 s poll for state to flip. Feels laggy.
- **Fix:** Use `onMutate` with `setQueryData` to flip the local `state` immediately, with rollback on error.

### M23. `qbittorrent.ts` is missing `forced_dl`/`forced_up` and other newer states
- **File:** `src/types/qbittorrent.ts:54-72`
- **Problem:** Includes `forcedDL`/`forcedUP` but qBittorrent 5+ adds new states like `stoppedUP`/`stoppedDL` (renamed from paused). The `Dashboard` filter (`['pausedDL','pausedUP']`) is also broken on qBittorrent 5+.
- **Fix:** Either widen `TorrentState` to include the new names with backward-compat fallbacks, or treat `state: string` and validate at the edge.

### M24. `getStateText` for all paused/queued/stalled states returns the same emoji
- **File:** `src/utils/formatters.ts:100-111`
- **Problem:** Visually you can't tell paused-DL from paused-UP, queued-DL from queued-UP, etc. On a tiny mobile screen, that's actually a feature, but the code duplicates the case for no reason.
- **Fix:** Use fallthrough cleanly (single case body for both pausedDL/UP).

### M25. `axios` import duplication and missing interceptors
- **Files:** `src/services/api.ts:4-8`, `src/services/directApi.ts:4-8`
- **Problem:** Two near-identical `axios.create(...)` calls. Neither installs response interceptors for centralized 401 handling, error normalization, or request IDs.
- **Fix:** Single shared axios instance in one module.

### M26. `package.json` `description: "iOS-optimized..."` but app supports more than iOS
- **File:** `package.json:4`, `public/manifest.json:3`
- **Problem:** Minor mismatch with reality (Android Chrome works fine, dark mode is generic). Not a bug, but cosmetic.
- **Fix:** Update description to "Mobile-first qBittorrent web frontend".

---

## 5. Low priority

### L1. Inconsistent string concatenation vs template literals in formatters
- **File:** `src/utils/formatters.ts:10, 14`
- Use template literals consistently: `` `${value} ${unit}` ``.

### L2. `clsx` import path inconsistent
- **Files:** `src/components/CompactTorrentList.tsx:7`, `src/components/Layout.tsx:2`, `src/components/TorrentList.tsx:6`
- Code uses `import { clsx } from 'clsx';`. The library exports a default; both work, but the project would be cleaner picking one.

### L3. Hardcoded color classes in `Dashboard` filter buttons ignore dark-mode
- **File:** `src/pages/Dashboard.tsx:155-157`
- The non-active filter button uses `bg-gray-100 text-gray-600 active:bg-gray-200` with no `dark:` variants. In dark mode it appears as a near-white pill.

### L4. `AddTorrent` placeholder text in `Save Path` is `/downloads`
- **File:** `src/components/AddTorrent.tsx:180`
- Doesn't match the typical Linux qBittorrent default (`/var/lib/qbittorrent/Downloads`). Cosmetic.

### L5. `AddTorrent` no validation on `savepath`/`category`
- **File:** `src/components/AddTorrent.tsx:175-197`
- Empty strings get sent to qBittorrent (which probably uses defaults; verify), commas in category are not stripped/escaped.

### L6. `LoginForm` (dead code) trims credentials, blocking valid leading-space passwords
- **File:** `src/components/LoginForm.tsx:18`
- `username.trim() && password.trim()` — passwords with leading/trailing whitespace are valid. Will be deleted with M2 anyway.

### L7. `Header` uses `text-sm` for the page title — small for accessibility
- **File:** `src/components/Layout.tsx:47`
- Mobile guidelines suggest 16 px+ for primary text. Using `text-sm` (14 px) as the page title is cramped.

### L8. Touch targets below 44×44 pt in some action buttons
- **File:** `src/components/CompactTorrentList.tsx:380-384` (`p-2 -mr-2` icon button), `src/pages/Dashboard.tsx:120-141` (header icon buttons `p-2 w-4 h-4`)
- Apple HIG recommends 44×44 pt; these end up around 32 pt. Pinch-target risk.

### L9. `BottomSheet` overlay click closes even if the target is the sheet
- **File:** `src/components/Layout.tsx:95-98`
- The fixed-positioned overlay is a sibling of the sheet, but if the sheet's gesture/scroll bubbles, the overlay handler can fire. Add `e.stopPropagation()` defensively or check `e.target === e.currentTarget`.

### L10. `vite.config.ts` `allowedHosts: 'all'` — dev only
- **File:** `vite.config.ts:9`
- Documented in commit `18a898a`. Consider removing once devs no longer need it, or wrapping in `process.env.NODE_ENV === 'development'`.

### L11. `manifest.json` has `orientation: portrait` but tablet users may want landscape
- **File:** `public/manifest.json:9`
- For a torrent dashboard this is fine; just noting.

### L12. `index.html` body uses `user-select: none` globally
- **File:** `index.html:14-26`
- Disables text selection across the whole app. The `selectable` class re-enables it on torrent names. Anything else (error messages, paths, hashes) can't be copied. Consider inverting: opt-in to `none` only on chrome elements.

### L13. `index.html` `<style>` block could move to CSS
- **File:** `index.html:14-35`
- Inlined CSS hurts caching and makes editing inconsistent with the Tailwind setup.

### L14. PostCSS config not shown but referenced
- The repo has `postcss.config.js` (not reviewed in detail). Standard Tailwind setup, presumed fine.

### L15. ESLint config has no `no-console`, no TS-specific recommended rules
- **File:** `eslint.config.js:8-35`
- Only enables `react-hooks` and `react-refresh` recommended. The `@typescript-eslint` plugin is loaded but no rules from it are activated. Adding `...tseslint.configs.recommended.rules` would catch the `any` issues flagged in M7/M8.

### L16. `eslint.config.js` does not include `globals` for Node files
- **File:** `eslint.config.js:14-15`
- Only `globals.browser` is set. The server-side JS (`server/*.js`) is excluded by file glob (`**/*.{ts,tsx}`), but a config block for it would help if you ever lint the server.

### L17. `package.json` lint script `--max-warnings 0` is strict but the config has no warnings configured
- **File:** `package.json:10`
- Combined with L15, the lint step is mostly cosmetic.

### L18. `package.json` has both `start` and `dev`; documented but novice users miss it
- **File:** `package.json:7, 12`
- Add `npm run server` (dev backend), `npm run dev` (vite), and document in README.

### L19. `tsconfig.json` `noUnusedParameters: true` but unused props pass via destructuring with `_` prefix
- **File:** `tsconfig.json:18`
- The destructured `onLogout` in `Dashboard` is "used" (called in `handleLogout`) so this rule doesn't catch it. Rename to `_onLogout` or remove (M2).

### L20. `tsconfig.node.json` has `allowSyntheticDefaultImports` but `vite.config.ts` doesn't need it
- **File:** `tsconfig.node.json:7`
- Cosmetic.

### L21. `deploy.sh` references undefined `${qbHost}` in a print
- **File:** `deploy.sh:333`
- `qBittorrent: ${qbHost:-localhost}:...` — the variable was set in the local scope as `QB_HOST` (uppercase). Lowercase `qbHost` is undefined; defaults to "localhost" silently — looks correct only by accident.

### L22. `deploy.sh` Auth-mode detection regex
- **File:** `deploy.sh:334`
- `grep -q "^QBITTORRENT_USERNAME=.$"` matches a username of *exactly one character*. Multi-char usernames will print "Local bypass" incorrectly.
- **Fix:** `grep -q "^QBITTORRENT_USERNAME=.\+$"` (require ≥1 char) and reverse the conditional.

### L23. `deploy.sh` removes dev dependencies after build, then runs npm install --production
- **File:** `deploy.sh:97-98`
- The `npm ci --production` after the build is wasteful: it deletes `node_modules` then reinstalls only prod deps. If `npm ci` fails the fallback `npm install` is fine. Consider `npm prune --omit=dev` instead.

### L24. `deploy.sh` always sets `chmod 755 -R` for `nobody` user
- **File:** `deploy.sh:259-263`
- 755 on `.env` would expose the qBittorrent password to all local users. The script then sets 644 on the env file — but `chmod -R 755` ran first, so on a fresh deploy world-readable bits are momentarily granted then narrowed. On older Linux systems, races exist; in practice unlikely to bite. Better to set permissions per-file from the start.

### L25. `deploy.sh` writes plain-text qBittorrent password into `.env`
- **File:** `deploy.sh:179-188, 252`
- Standard for systemd-managed local services, but documenting that it's plaintext on disk is worthwhile.

### L26. `uninstall.sh` `pkill -f "qbit-mobile"` is overly broad
- **File:** `uninstall.sh:75`
- Will also kill processes whose path/argv contains `qbit-mobile` even if unrelated (e.g., a dev tree at `~/dev/qbit-mobile`).

### L27. `uninstall.sh` doesn't remove the service user it may have created
- **File:** `uninstall.sh:64-70`
- If `deploy.sh` created `qbitmobile` user, `uninstall.sh` leaves it behind.

### L28. README references not validated
- Not reviewed in depth.

### L29. No Prettier / formatting tool configured
- Code style is mostly consistent but minor drift exists (single vs double quotes, trailing commas).

### L30. `App.tsx` page routing uses string union state, not a router
- **File:** `src/App.tsx:7-13`
- Works for two pages; will break down with more. Already importing `react-router-dom` in `package.json` but not using it.

---

## 6. Positive observations

- TypeScript strict mode is enabled (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) — a strong baseline.
- The recent refactor split `server.js` into `server.js` + `qbClient.js` + `routes/torrents.js`; the proxy is now narrowly scoped and easy to follow.
- The recent fix for the GET-body proxy bug (`req.method !== 'GET' && req.method !== 'HEAD'`) is correct.
- `ErrorBoundary.tsx` is a clean, idiomatic React class component covering `getDerivedStateFromError` and a Reload action.
- `ThemeContext.tsx` correctly reads `prefers-color-scheme`, persists to `localStorage`, and toggles the `dark` class on `<html>` exactly as Tailwind expects.
- `useTorrentFilters` correctly memoizes the filter+sort pipeline; `availableTags` is a clean derivation.
- The systemd service file in `deploy.sh` includes good hardening (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=true`, `PrivateTmp=true`, scoped `ReadWritePaths`).
- `react-query` configuration with `placeholderData: previousData` keeps the list stable during refetches — good UX choice.
- The `formatters.ts` utilities are pure functions, easy to test, well-scoped.
- iOS-specific touches in `index.html` (`viewport-fit=cover`, `apple-mobile-web-app-capable`, safe-area utilities in Tailwind config) are thoughtful.

---

## 7. Suggested next steps

In priority order:

1. **Fix C1 (`setPreferences` payload) and C2 (debounce / explicit save).** These together turn Settings from "broken-but-looks-fine" into a working page. ~1 hour.
2. **Address C3, C4, C7 (server hardening): scope CORS, gate the SPA fallback, add multer limits.** ~30 minutes; high security ROI.
3. **Fix C8 (`tsconfig.node.json` TS6310) so `npm run typecheck` passes cleanly,** then add a CI step that runs typecheck + lint. ~15 minutes.
4. **Delete dead code (M1, M2, M3, M4) and reconcile the two API clients (H1).** This shrinks the codebase by ~400 lines and removes drift risk. ~1-2 hours.
5. **Move re-auth logic into an axios interceptor with a single in-flight login promise (C5, C6, H8, H11).** ~1 hour.
6. **Fix the modal lifecycle bug (H6) and the URL validation regex (C9).** ~30 minutes.
7. **Address the React anti-patterns: scroll listener (H3), filter recomputes (H5), pagination dead code (H4).** ~1 hour.
8. **Add the first tests.** Highest-value targets:
   - `src/utils/formatters.ts` — pure functions, trivial to test, edge cases (M11/M12) are real bugs.
   - `src/hooks/useTorrentFilters.ts` — sort/filter logic with localStorage, easy to test with `@testing-library/react`.
   - Server proxy — supertest against `server.js` with a mocked qBittorrent. Catches C4/H8/H9 regressions.
   - `src/services/api.ts` setPreferences — a regression test for C1.
9. **Adopt `@typescript-eslint/recommended` rules (L15) and a Prettier config (L29).** Will surface remaining `any`s automatically.
10. **Optional: introduce `react-router-dom` (L30) and an opt-in virtualization library (M9) once the basics are clean.**

---

*End of review.*
