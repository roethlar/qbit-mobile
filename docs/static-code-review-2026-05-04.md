# qBit Mobile Static Code Review

Review date: 2026-05-04  
Scope: static source review of the repository checkout.  
Verification: no successful dependency install, build, lint, typecheck, server start, or runtime testing was used for this review.

## Executive Summary

qBit Mobile is a compact React 18 + TypeScript + Vite frontend backed by a thin Express proxy to qBittorrent's Web UI API. The app is understandable and small enough to maintain, but there are several correctness and security issues that should be fixed before treating it as production-ready.

The highest-risk areas are:

1. The Settings page likely does not persist changes because `/app/setPreferences` is sent with the wrong body format.
2. The Express proxy is effectively an authenticated qBittorrent control relay with wildcard CORS and no proxy-side authentication or CSRF defense.
3. Authentication/session state is split across a server-side cookie cache and a client-side singleton API that also tries to log in at import time.
4. Large torrent lists and torrent uploads can create performance and memory pressure.
5. The repo has dead code, duplicate API clients, duplicate type definitions, and weak static tooling coverage.

## Critical Findings

### C1. Settings saves use the wrong qBittorrent payload format

Files:
- `src/services/api.ts:254`
- `src/pages/Settings.tsx:34`

`QBittorrentAPI.setPreferences()` posts:

```ts
await api.post('/app/setPreferences', {
  json: JSON.stringify(prefs)
});
```

qBittorrent expects `application/x-www-form-urlencoded` with a `json` field, not a JSON object body. As written, the Settings page can optimistically show a success message while qBittorrent rejects or ignores the change.

Impact:
- Speed limit and save-path changes may appear to succeed but not persist.
- Users can lose confidence in settings because UI state diverges from server state.

Recommended fix:

```ts
await api.post(
  '/app/setPreferences',
  new URLSearchParams({ json: JSON.stringify(prefs) }),
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
);
```

Add a focused regression test for this request encoding if tests are introduced.

### C2. Settings writes on every keystroke

File:
- `src/pages/Settings.tsx:147`, `src/pages/Settings.tsx:169`, `src/pages/Settings.tsx:195`

The download limit, upload limit, and save path inputs call `savePreferences()` directly in `onChange`. That sends one API request per typed character. This is especially risky for the save path field, where a user typing `/mnt/downloads` creates many partial paths.

Impact:
- Excessive API calls.
- Race conditions where an earlier request can finish after a later one.
- Partial values can be persisted.
- The UI disables inputs during saves, making typing feel broken on slower connections.

Recommended fix:
- Keep local draft state.
- Add explicit Save and Cancel actions, or debounce writes and cancel stale requests.
- Only show success after reloading preferences or after qBittorrent confirms the update.

### C3. The proxy has wildcard CORS with no proxy-side auth

File:
- `server/server.js:20`

All `/api` routes return:

```js
Access-Control-Allow-Origin: *
```

The server also injects the cached qBittorrent session cookie when forwarding requests. If this app is reachable from a browser on the LAN, any arbitrary web page can send requests to the proxy and perform qBittorrent actions.

Impact:
- Drive-by torrent adds.
- Torrent deletion or data deletion.
- Settings modification.
- Remote control of qBittorrent if the proxy is exposed beyond a trusted host.

Recommended fix:
- Remove wildcard CORS unless there is a concrete cross-origin client.
- If CORS is required, allow only a configured origin.
- Add Origin/Referer checks for state-changing requests.
- Consider proxy-side authentication or a CSRF token.
- Document that the service must not be exposed to untrusted networks.

### C4. Torrent upload buffering can exhaust memory

File:
- `server/routes/torrents.js:6`

`multer()` is used without limits and defaults to buffering uploads in memory. A large or repeated upload can consume enough memory to kill the Node process.

Impact:
- Simple denial of service against the proxy.
- Higher risk when combined with the wildcard CORS issue.

Recommended fix:

```js
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 25,
    fields: 50,
  },
});
```

Use `.array('torrents')` or `.single('torrents')` instead of `.any()` if the accepted field names are known.

### C5. SPA fallback can mask API errors as HTML

File:
- `server/server.js:69`

The production server registers `app.get('*')` after API routes. Any unmatched GET, including `/api/...` typos or missing API endpoints, can return `index.html` with HTTP 200.

Impact:
- Client code may receive HTML where JSON was expected.
- Debugging bad API paths becomes unnecessarily confusing.

Recommended fix:

```js
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});
```

### C6. Server session cookie is a module-global mutable singleton

File:
- `server/qbClient.js:8`

`sessionCookie` is global state shared by every request. Multiple concurrent 401 responses can each trigger login and overwrite the cookie.

Impact:
- Login storms under load or after session expiry.
- Requests can retry with a session just invalidated or replaced by another request.
- Hard-to-reproduce auth failures.

Recommended fix:
- Add a single in-flight login promise.
- Invalidate the cached session only on 401.
- Make all requests await the same login refresh when one is already running.

## High Priority Findings

### H1. Two frontend API clients duplicate responsibility

Files:
- `src/services/api.ts`
- `src/services/directApi.ts`

`directApi.ts` is used by the dashboard and torrent actions. `api.ts` is a class singleton used by Settings and contains duplicate torrent methods, duplicate add/pause/resume/delete methods, and its own auth initialization logic.

Impact:
- Drift between clients.
- More bugs like C1, where one endpoint has different request encoding.
- Import-time side effects from `qbApi`.

Recommended fix:
- Consolidate on one client module.
- Move `getPreferences()` and `setPreferences()` into `directApi.ts`.
- Delete `api.ts` or reduce it to a shared axios instance.
- Put error normalization and 401 behavior in one place.

### H2. `qbApi` starts authentication at module import time

File:
- `src/services/api.ts:20`

`export const qbApi = QBittorrentAPI.getInstance()` calls `initialize()` when the module is imported. This sends an auth request before React renders the Settings page.

Impact:
- Hidden network side effect during import.
- Empty-credential login may race with server-side session management.
- Errors are swallowed or only logged.

Recommended fix:
- Remove import-time initialization.
- Initialize lazily inside methods that need it.
- Prefer server-side qBittorrent auth only; the browser should not also try to manage qBittorrent auth.

### H3. `getTorrents()` has a narrow 401 retry path; other methods do not

File:
- `src/services/api.ts:128`

Only `getTorrents()` catches 401 and retries after auth. `getPreferences()`, `getGlobalTransferInfo()`, `pauseTorrent()`, and other methods do not share that behavior.

Impact:
- Session expiry behaves differently depending on endpoint.
- Settings may fail while torrent list continues to recover.

Recommended fix:
- Move retry behavior into a shared axios interceptor or server-side client.
- Avoid duplicating auth behavior in the browser client.

### H4. Add Torrent modal closes before add requests finish

File:
- `src/components/AddTorrent.tsx:45`, `src/components/AddTorrent.tsx:54`

`AddTorrent` calls `onAddUrl()` / `onAddFile()`, immediately clears form state, and closes the modal. The parent handler awaits the mutation, but the modal is already gone.

Impact:
- Failed adds lose the URL, file choice, and options.
- The error message appears outside the modal after the context was destroyed.

Recommended fix:
- Make `onAddUrl` and `onAddFile` return `Promise<void>`.
- Keep the modal open while pending.
- Close only after success.
- Preserve input/options on failure.

### H5. URL validation rejects valid torrent inputs

File:
- `src/components/AddTorrent.tsx:34`

The validation accepts magnet links, HTTP(S), and 40-character v1 info hashes. It does not accept v2 64-character info hashes. The string prefix checks are also case-sensitive.

Impact:
- Valid uppercase links or v2 hashes can be rejected by the UI.

Recommended fix:

```ts
const isValid =
  /^magnet:\?/i.test(trimmed) ||
  /^https?:\/\//i.test(trimmed) ||
  /^[a-f0-9]{40}$/i.test(trimmed) ||
  /^[a-f0-9]{64}$/i.test(trimmed);
```

### H6. Dashboard filter counts repeatedly traverse the torrent list

File:
- `src/pages/Dashboard.tsx:93`

The `filters` array computes counts with multiple `torrents.filter(...)` passes every render. Separately, `filteredTorrents` performs another pass.

Impact:
- Unnecessary CPU work on every React Query refresh.
- Mobile jank risk with large torrent lists.

Recommended fix:
- Use a single `useMemo()` pass to compute counts and filtered rows.
- Hoist state groups into constants to avoid duplicated arrays.

### H7. Large torrent lists render all rows

File:
- `src/components/CompactTorrentList.tsx:232`

The list maps every filtered torrent directly into the DOM. With thousands of torrents, every 5-second polling refresh can reconcile thousands of rows.

Impact:
- Slow scrolling and periodic UI stalls on mobile.
- Memory and layout cost grows linearly with torrent count.

Recommended fix:
- Add pagination, windowing, or careful virtualization.
- If virtualization was previously reverted, introduce a simpler paginated fallback first.

### H8. Polling continues on a fixed 5-second cadence

File:
- `src/hooks/useDirectTorrents.ts:8`, `src/hooks/useDirectTorrents.ts:19`

The torrent and stats queries poll every 5 seconds with `retry: false`. React Query will not retry immediately, but the interval still creates repeated requests after persistent failures.

Impact:
- Repeated server/qBittorrent load during outages.
- No adaptive backoff.

Recommended fix:
- Use a function for `refetchInterval` that backs off or stops after errors.
- Set `refetchIntervalInBackground: false` explicitly.
- Consider aligning polling interval to qBittorrent's `refresh_interval` preference.

### H9. qBittorrent v5 state names are incomplete

Files:
- `src/types/qbittorrent.ts:54`
- `src/pages/Dashboard.tsx:40`
- `src/utils/formatters.ts:62`

The app models qBittorrent states as a closed union. Newer qBittorrent releases use additional or renamed states such as `stoppedDL` and `stoppedUP`. Filters and formatting currently focus on `pausedDL` and `pausedUP`.

Impact:
- Paused/stopped torrents can be misclassified.
- Unknown states show generic bullets and may not match filters.

Recommended fix:
- Add known qBittorrent 5 states.
- Consider treating `state` as `string` at the API edge and mapping known values through helper functions.

## Medium Priority Findings

### M1. Dead components remain in source

Files:
- `src/components/TorrentList.tsx`
- `src/components/LoginForm.tsx`

The app renders `CompactTorrentList`, and no current code imports `TorrentList` or `LoginForm`.

Impact:
- Extra maintenance surface.
- Old assumptions can mislead future changes.

Recommended fix:
- Delete unused components.
- Remove related vestigial props such as `Dashboard.onLogout`.

### M2. Duplicate type files are unused

Files:
- `src/types/torrent.ts`
- `src/types/preferences.ts`
- `src/types/globalTransfer.ts`
- `src/types/qbittorrent.ts`

Current imports use `src/types/qbittorrent.ts`. The split type files are not used and have potential drift from the canonical file.

Impact:
- Future edits may update the wrong type file.
- Inconsistent optionality or documentation can hide API mismatches.

Recommended fix:
- Either delete the unused split files or make `qbittorrent.ts` re-export them and update imports.

### M3. `Dashboard` contains unused state and imports

File:
- `src/pages/Dashboard.tsx`

Examples:
- `useRef` and `scrollableRef`
- `Card`
- `formatBytes`
- `showStats`
- `handleLogout`
- `onLogout`
- `error` from `useDirectTorrents()`

Impact:
- Noise in a central component.
- Hidden broken feature: the scroll listener targets `window`, but the actual scroll container is inside `CompactTorrentList`.

Recommended fix:
- Remove dead state/imports.
- If stats auto-hide is desired, attach a ref to the real scroll container and render `showStats` meaningfully.

### M4. Sorting and pagination state is partially dead

Files:
- `src/hooks/useTorrentFilters.ts:22`
- `src/components/CompactTorrentList.tsx:232`

`useTorrentFilters()` computes `paginatedTorrents`, `totalPages`, and `currentPage`, but `CompactTorrentList` renders `filteredAndSortedTorrents` directly.

Impact:
- Dead array allocation every refresh.
- Misleading hook API.
- Users with many torrents get no real pagination benefit.

Recommended fix:
- Either render `paginatedTorrents` and add controls, or remove pagination state entirely.

### M5. Local storage casts are unsound

File:
- `src/hooks/useTorrentFilters.ts:11`

Saved strings from localStorage are cast directly to `SortField` and `SortOrder`. Invalid stored values can disable sorting or create unexpected behavior.

Recommended fix:
- Validate stored values against allowed arrays before using them.
- Fall back to stable defaults.

### M6. `any` weakens type safety in important paths

Files:
- `src/services/api.ts:144`
- `src/pages/Dashboard.tsx:70`
- `src/pages/Dashboard.tsx:85`
- `src/components/AddTorrent.tsx:161`

`any` is used for caught errors and option updates.

Impact:
- Invalid option values can be assigned without compiler help.
- Error handling can break when the error shape differs from Axios.

Recommended fix:
- Use `unknown` and a small error-normalization helper.
- Make `updateOption` generic:

```ts
const updateOption = <K extends keyof AddTorrentOptions>(
  key: K,
  value: AddTorrentOptions[K],
) => onChange({ ...options, [key]: value });
```

### M7. `formatBytes()` mishandles negative and fractional inputs

File:
- `src/utils/formatters.ts:1`

`Math.log(bytes)` returns `NaN` for negative values and can compute a negative unit index for fractional values below 1.

Impact:
- qBittorrent sentinel values like `-1` can produce `NaN B`.

Recommended fix:

```ts
if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
```

Clamp the unit index before indexing `sizes`.

### M8. Status sorting sorts by display symbol

File:
- `src/hooks/useTorrentFilters.ts:84`

Sorting by `state` uses `getStateText()`, which returns symbols such as arrows and warning icons. Symbol ordering is not a meaningful torrent state order.

Recommended fix:
- Sort by canonical state string or define an explicit priority map.

### M9. Bottom sheet accessibility is incomplete

File:
- `src/components/Layout.tsx:90`

The bottom sheet lacks:
- `role="dialog"`
- `aria-modal="true"`
- Escape-to-close handling
- focus trap or initial focus
- body scroll lock

The close button rendered by the optional title path is a symbol with no explicit `aria-label`.

Impact:
- Screen reader and keyboard users can interact with content behind the modal.
- Focus can be lost or confusing.

Recommended fix:
- Add dialog semantics.
- Move focus into the sheet on open.
- Restore focus on close.
- Support Escape.
- Add `aria-label="Close"` to icon/symbol close buttons.

### M10. Add Torrent tab controls are visually tabs but semantically buttons

File:
- `src/components/AddTorrent.tsx:83`

The URL/File selector is presented as tabs but lacks tab roles and ARIA state.

Recommended fix:
- Add `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-controls`.
- Or present them as a segmented control with clear button labels and state.

### M11. Dev server allows all hosts

File:
- `vite.config.ts:9`

`allowedHosts: 'all'` is convenient for LAN/mobile testing, but it weakens host checks in development.

Impact:
- Accepts any Host header when dev server is reachable.

Recommended fix:
- Prefer an explicit allowed host list.
- Document why `all` is required if keeping it.

### M12. Deploy script reports qBittorrent host/auth incorrectly

File:
- `deploy.sh:333`, `deploy.sh:334`

The success message uses `${qbHost:-localhost}`, but the collected variable is `QB_HOST`. The auth-mode check uses `^QBITTORRENT_USERNAME=.$`, which only detects one-character usernames.

Impact:
- Deployment summary can lie about qBittorrent host and auth mode.

Recommended fix:
- Read both values from `.env`.
- Use a regex that detects one or more characters after `=`.

### M13. Deploy script uses broad permissions for `nobody`

File:
- `deploy.sh:259`

For the `nobody` service user, the script sets the app directory to `755` and `.env` to `644`.

Impact:
- qBittorrent credentials in `.env` are world-readable to local users.

Recommended fix:
- Prefer the dedicated `qbitmobile` service user by default.
- Make `.env` readable only by the service user/group.

### M14. Uninstall process can kill unrelated processes

File:
- `uninstall.sh:72`

`pkill -f "qbit-mobile"` can match unrelated processes whose command lines include that string, including editor sessions or development commands.

Recommended fix:
- Rely on systemd to stop the service.
- If process cleanup is needed, match the exact service executable and working directory.

### M15. No tests are present

Files:
- `package.json`
- repository structure

There are no unit, integration, or component tests configured.

Highest-value initial tests:
- `formatters.ts` edge cases.
- `useTorrentFilters()` filter/sort behavior.
- `setPreferences()` request encoding.
- Express proxy behavior for unknown `/api` GET paths.
- Upload route size limit and field forwarding.

## Low Priority Findings

### L1. Lint config loads TypeScript ESLint but does not enable recommended rules

File:
- `eslint.config.js`

`@typescript-eslint` is loaded as a plugin, but recommended TypeScript rules are not applied.

Impact:
- Current linting misses many issues, including several `any` usages.

Recommended fix:
- Enable `@typescript-eslint/recommended`.
- Add a small no-console policy for production client code.

### L2. Global user-select disabling hurts copy workflows

File:
- `index.html:16`

The whole app disables text selection, then selectively re-enables it for `.selectable`. Users may still be unable to copy paths, errors, hashes, and settings values.

Recommended fix:
- Make text selectable by default.
- Disable selection only on controls where it improves touch behavior.

### L3. UI touch targets are small in several places

Files:
- `src/pages/Dashboard.tsx:120`
- `src/components/CompactTorrentList.tsx:379`

Several icon buttons are roughly 32px tap targets. Mobile guidance generally expects about 44px.

Recommended fix:
- Use fixed `min-w`/`min-h` for icon buttons.
- Keep visual density while expanding invisible hit area.

### L4. Dark-mode styles are inconsistent

Files:
- `src/pages/Dashboard.tsx:153`
- `src/components/AddTorrent.tsx`

Some controls use light-only `bg-gray-100 text-gray-600` classes without matching `dark:` variants.

Impact:
- Low contrast or visually inconsistent controls in dark mode.

Recommended fix:
- Audit all reusable controls for dark variants.
- Prefer shared button/control classes where possible.

### L5. PWA metadata still points to Vite favicon

File:
- `index.html:5`

The favicon is `/vite.svg`, which is likely not intended for a branded installed app.

Recommended fix:
- Replace with project icons from `public/`.

## Suggested Remediation Order

1. Fix Settings persistence: urlencoded `setPreferences`, local draft state, explicit Save.
2. Harden the proxy: remove wildcard CORS, add Origin checks or proxy auth, add upload limits, guard API fallback.
3. Consolidate frontend API code into one client and remove browser-side import-time auth.
4. Add a single in-flight login refresh mechanism in `server/qbClient.js`.
5. Delete dead components and duplicate type files.
6. Fix Add Torrent async lifecycle and validation.
7. Clean `Dashboard` unused state and optimize filter counting.
8. Add tests for request encoding, filter/sort logic, formatters, and proxy routing.
9. Improve accessibility for BottomSheet and Add Torrent tabs.
10. Tighten deploy/uninstall scripts and `.env` permissions.

## Positive Observations

- The app is small and easy to reason about.
- The server is already split into `server.js`, `qbClient.js`, and route modules.
- TypeScript strict mode is enabled in `tsconfig.json`.
- React Query is used appropriately for polling and cache invalidation.
- The UI has a clear mobile-first direction.
- The formatter utilities are pure and easy to test.
- Deployment script includes some useful systemd hardening for the dedicated-user path.

## Review Limitations

This report is based on static inspection only. It does not include results from:
- `npm install`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- starting the server
- browser testing
- qBittorrent integration testing

Because no runtime verification was performed, findings about qBittorrent behavior should be confirmed against the target qBittorrent version during implementation.
