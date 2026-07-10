# Plan: Dependency currency after the 2026-07 CI audit failure

Status: Drafted 2026-07-10; approved and executed the same day. The Express 4 → 5
migration below is **done** (`cc69364`, `1ceca1c`). What remains is the deferred Node
item and the one open question at the end.

## Goal

Owner's stated goal: no CI failure caused by out-of-date dependencies for at least
two years (to roughly 2028-07).

## What is already done

Landed 2026-07-10, in order:

- `8d12cf7` — multer 2.1.1 → 2.2.0, clearing the advisory that broke CI.
- `c79349d` — `actions/checkout@v4` → `v7`, `actions/setup-node@v4` → `v6`. The v4
  actions run on Node 20, which GitHub removes from runners in fall 2026.
- `4b37161` — CI build matrix on Node 22 and 24.
- `499a136` — `npm audit` split into `.github/workflows/audit.yml` (weekly + manual);
  `.github/dependabot.yml` added for npm production, npm development, and
  github-actions.
- `da58e05` — guidance files reconciled with the above.

Repo settings: "Dependabot vulnerability alerts" and "Dependabot security updates"
enabled 2026-07-10 via `gh api`.

## The load-bearing finding

Dependency currency does not prevent audit failures. Both historical CI failures were
advisories *published against versions already in use* (`form-data`/`qs` 2026-06,
`multer` 2026-07). Being fully up to date on the morning of disclosure still fails the
build that afternoon. The durable fix is routing the alert to a bot-authored PR rather
than to an unrelated commit — which is what `499a136` did. Everything below is
secondary to that.

Corollary: only the twelve **production** dependencies are visible to
`npm audit --omit=dev`. Upgrading TypeScript, Tailwind, eslint, vitest, jsdom, or vite
cannot affect the audit outcome, because `--omit=dev` never sees them.

## Ruled out, with evidence

**Dropping the direct `form-data` dependency: no benefit.** `axios` depends on
`form-data` (`npm ls form-data`: deduped under `axios@1.16.1`). Removing the direct
dependency leaves it in the production tree and in the audit's blast radius. The
2026-06 failure would have happened regardless. Abandoned.

**Dev-dependency majors (TypeScript 7, Tailwind 4, eslint 10, jsdom 29, and the eslint
plugins): out of scope for this goal.** They cannot cause an audit failure. They may be
worth doing for their own sake — Tailwind 4 in particular is a config rewrite touching a
custom palette and `env(safe-area-inset-*)` spacing with no test coverage of rendered
CSS — but that is a separate decision, not a CI-stability measure. Dependabot is
configured to propose their minor/patch updates and to leave majors alone.

## Remaining work: Express 4 → 5

### Why

Express is a production dependency and the app's security boundary. Express 4 is
maintained today — 4.22.2 shipped 2026-05-11, and 4.22.1/5.2.1 were released the same
day in 2025-12, indicating the maintainers patch both lines together. **No published
end-of-support date for Express 4 was found** (expressjs.com/en/support and the repo's
`Security.md` both returned 404 on 2026-07-10); treat the horizon as unknown, not as
"safe indefinitely".

The risk this addresses: if Express 4 support ends inside the two-year window, the next
advisory forces a major upgrade of the security boundary under time pressure. Doing it
deliberately, with the allowlist tests in hand, is strictly safer than doing it in a
hurry.

### Measured breaking-change surface

Surveyed 2026-07-10 against `server/server.js`, `server/routes/torrents.js`,
`server/qbClient.js`:

- **One breakage.** `server/server.js:478` registers `app.get('*', ...)` as the SPA
  catch-all. Express 5 uses path-to-regexp v8, where bare `'*'` is invalid. It must
  become a named wildcard (`'/*splat'`) or an explicit regex.
- Every other route is a **literal static path** — no `:params`, no optional `?`
  segments, no inline regex. path-to-regexp v8 breaks patterns; there are none.
- `req.query` is read once (`server/server.js:288`), a flat scalar `hash`. Express 5's
  switch to the `simple` query parser cannot change its value.
- No `req.query` assignment (getter-only in v5), no `req.param()`, no legacy
  `res.send(status)`, no `body-parser` import. `express.json` / `express.urlencoded`
  are already the built-ins.
- `express-rate-limit@8` declares `peerDependencies: { express: ">= 4.11" }`, so it is
  compatible with Express 5 without change.

Assumption to verify during execution, not yet proven: Express 5 forwards rejected
promises from async handlers to the error middleware automatically. The proxy's async
routes currently rely on explicit `try/catch`; the change should be a no-op, but the
error-path tests must confirm it.

### Slices — executed 2026-07-10

1. **Done, `cc69364`.** SPA catch-all `app.get('*')` → `app.get(/.*/)`, landed while
   still on Express 4. A RegExp is valid on both majors; `'/*splat'` is v5-only. Also
   closed a coverage hole found while doing it: `server.js` registers the fallback only
   when `./dist` exists, and CI runs `npm test` before `npm run build`, so the route was
   absent under CI and present locally. `test/setup.ts` now seeds a placeholder shell.
   Three tests added, including one asserting the fallback does not shadow the JSON 404
   for unmatched `/api` routes.
2. **Done, `1ceca1c`.** `express` `^4.21.2` → `^5.2.1`. All 134 tests pass with no test
   file modified.
3. **Done, folded into `1ceca1c`.** Security boundary re-verified. The allowlist,
   fail-closed auth, and add-torrent field allowlist assertions pass unchanged.

### Verification performed

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` after each slice, on
Node 26 (the developer machine). Not run per-slice on Node 22/24 locally; the CI matrix
covers those on push.

Guard proof for slice 1: with `express@5` installed and `app.get('*')` restored, the
proxy suite does not merely fail — it fails to load (`Missing parameter name at index
1: *`), and the server would refuse to boot. The fix is load-bearing.

Manual smoke test against a real boot on express 5.2.1 serving the real `./dist`:
deep link → 200 `text/html` (actual `index.html`); `POST /api/v2/app/shutdown` → 404
JSON; unmatched `/api/v2/log/main` → 404 JSON, not the HTML shell; unauthenticated
`/api/v2/torrents/info` → 401; static asset → 200.

**Not verified:** the live UI against a running qBittorrent. Upstream proxying was
exercised only through mocked axios in the test suite and through the proxy's own
404/401 paths in the smoke test. A real add-torrent round trip has not been run since
the upgrade.

## Deferred, with a trigger rather than a date

**Node.** CI runs 22 and 24. Node 24 leaves support 2028-04-30, about ten weeks before
the two-year horizon; Node 22 leaves 2027-04-30, inside it. An end-of-life Node does not
by itself turn CI red, so this is not urgent. Trigger: when Node 26 enters LTS
(2026-10-28), move the matrix to 24 + 26 and drop 22 once the deploy scripts' floor is
raised in the same change.

## Open question for the owner

The audit is now weekly and non-blocking. If a high-severity production advisory should
still block *release* (as opposed to merge), that gate does not currently exist
anywhere. Options: add the audit to a release workflow, or accept that Dependabot's PR
is the only signal. Not decided.
