# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- **v2.1.22 released on GitHub** (2026-10-24,
  https://github.com/roethlar/qbit-mobile/releases/tag/v2.1.22, marked latest;
  the previous release was v1.5.2). Annotated tag `v2.1.22` is on `a0d1a2b`,
  the changelog commit, on both remotes. `CHANGELOG.md` has one
  `[2.1.22]` section covering 2.0.1-2.1.22, and its `[2.0.0]` section now also
  records 1.6.7-1.6.9 (macOS/Windows deploy hardening, axios 1.18.1). CI (run
  40050409419, Node 24 and 26) and the dispatched Audit (run 40050424921) passed
  on `4f270da`, the 2.1.22 code commit.
- **October 2026 Node security release fixed as 2.1.14** (2026-10-23, owner go):
  `engines.node` raised to `>=24.22.1`, all three deploy scripts compare
  major.minor.patch, and `express.json`/`express.urlencoded` set `inflate: false`
  (CVE-2026-111497, Brotli decoder RCE, reachable before auth). Guarded by the
  "compressed request bodies" tests in `server/__tests__/proxy.test.js`, proven to
  fail (401, body inflated and reached auth) with the fix reverted. Lint,
  typecheck, tests (181), and build pass on Node 26.12.1. Not run: the deploy
  scripts on real hosts. Deployed hosts still need their Node upgraded to
  24.22.1/26.12.1 and the service restarted. See the Node floor entry in
  `.agents/decisions.md`.
- **October 2026 audit remediation, one advisory package per commit.** First
  wave 2.1.10-2.1.13 (`a6d6349`..`dd92959`, now on origin): proxy-addr 2.0.8
  (critical), axios 1.20.0 (high), multer 2.4.0 and ip-address 10.7.4
  (moderate). Second wave 2.1.15-2.1.22 (2026-10-23, owner go "fix and commit
  everything else you can", now on origin): production body-parser 2.4.0,
  follow-redirects 1.16.1, multer 2.5.0 (all high); dev-only vite 8.3.5 with
  source-map-js 1.2.2, brace-expansion (high), vitest 4.1.12, fast-uri 3.1.9
  (moderate), serialize-javascript 7.1.4 (low). Dev slices bump too, per the
  2.1.4-2.1.9 precedent. Production audit zero; full audit leaves 3 moderate
  (postcss-selector-parser under Tailwind 3, needs Tailwind 4). Lint,
  typecheck, 181 tests, and build pass on Node 26.12.1. Before vite 8.3.5,
  this host's CRLF checkout broke loading `proxy.test.js` (environmental), so
  slices were also verified in an LF clone. Canonical record:
  `.agents/plans/dependency-audit-2026-10.md`.
- The 2026-09-14 audit remediation is complete and published as **2.1.9**
  (`78cd9e3`) to origin and the GitHub mirror. Full and production npm audits
  report zero vulnerabilities, including development dependencies. GitHub
  Dependabot reports zero open alerts. Clean install, lint, typecheck, all 176
  tests, and build pass locally and in GitHub CI on Node 24/26 (run 34854405287);
  the GitHub Audit passed (run 34854404826). Tests and audit gates were preserved.
  This includes the earlier Multer update plus multipart array-index limit and
  qs update. No deployment was performed. Canonical scope and verification:
  `.agents/plans/dependency-audit-2026-09.md`.
- `BottomSheet` (`src/components/Layout.tsx`) no longer steals focus on re-render:
  its open/close effect depended on `onClose`, which callers pass fresh every render,
  so each keystroke inside a sheet refocused the container. `onClose` is now read
  through a ref and the effect depends on `isOpen` only. Found while testing 2.1.0,
  shipped as **2.1.1** (2026-08-25); regression tests in `Layout.test.tsx`
  (BottomSheet) and `AddTorrent.test.tsx` (now typed with `user.type`).
- The Add Torrent sheet's Save Path now offers the same location presets as the
  move sheet (shared `src/components/LocationPresetList.tsx`), shipped as **2.1.0**
  (2026-08-25). Reviewed: codereview codex (gpt-5.6-sol @ max, standard, inline
  session-only model) over `bd689a8..3b34a9e`, 2026-08-25, MCP transport, thread
  `01a039af-7266-79a2-931c-7ed2d53b5d9f`: clean — no material issue. The MCP
  envelope carries no resolved model id; the line records the model as dispatched.
- Node.js 24 is now the supported floor and CI exercises Node 24/26. All three deploy
  scripts inherit the floor from `package.json`; the breaking deployment-contract
  change makes the app version **2.0.0**.
- The last production deploy verified in repo records is version **1.6.6** on Linux
  (2026-07-10).

## Next

- **Tag `v2.1.22` and publish the GitHub release** after owner review of the
  release notes (outward-facing: needs its own go).
- **Plan the Tailwind 3 -> 4 migration** (semver major) to clear the last
  dev-only finding, postcss-selector-parser GHSA-rj75-hqrm-r3gf (moderate).
- **Owner run of `deploy.ps1` on Windows.** The rewrite parses clean under pwsh 7.6 and
  its staging loop was executed verbatim on macOS, but the Scheduled Task paths (swap
  under a running task, rollback, post-swap ACL) cannot be exercised off-Windows.
- Decide the open question in `.agents/decisions.md`: should a high-severity
  production advisory block a *release*, now that it no longer blocks a merge?

## Blockers

- None recorded.

## Verification

- Automated verification is defined in `.agents/repo-guidance.md`; see
  `.agents/repo-map.json` for the canonical command list.
- Behavior not covered by automation (the live UI against a running qBittorrent, the
  deploy/uninstall scripts) needs a manual check or an explicit note that it was not run.

## Active Sources

- `AGENTS.md`
- `.agents/repo-guidance.md`
- `.agents/repo-map.json`
- `.agents/decisions.md`
