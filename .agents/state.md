# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- **October 2026 audit remediation fixed locally as 2.1.10 through 2.1.13**
  (`a6d6349`..HEAD), one advisory per commit: proxy-addr 2.0.8 (critical),
  axios 1.20.0 (high), multer 2.4.0 and ip-address 10.7.4 (moderate). The
  weekly GitHub Audit had failed on 2026-10-12 against 2.1.9. Production audit
  is now zero; clean install, lint, typecheck, 176 tests, and build pass.
  **Not yet pushed**: both remotes remain at `e6c16c2` (2.1.9) under the
  ask-first push policy. Dev-only audit findings remain and are recorded as
  out of scope. Canonical record: `.agents/plans/dependency-audit-2026-10.md`.
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

- **Owner go to push 2.1.13** to origin and github, then dispatch the Audit
  workflow and confirm it and the Node 24/26 CI matrix pass.
- **Owner decision on dev-dependency audit findings** (10, none shipped to
  users): in-range fixes for brace-expansion, fast-uri, source-map-js now;
  Tailwind 3 -> 4 migration separately for the rest. Details in
  `.agents/plans/dependency-audit-2026-10.md`.
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
