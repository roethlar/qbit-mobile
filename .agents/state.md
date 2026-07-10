# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- The deploy-script hardening is now ported to **all three platforms**. 2026-07-10,
  commits `a16fd10` (macOS) and `88f0780` (Windows), version **1.6.8**: engines-derived
  Node floor, `git ls-files` staging, staged build + atomic swap, rollback on a failed
  start, uninstall sweeps `.stage`/`.old.*`. `deploy-macos.sh` was verified with real
  runs on the Mac dev machine — fresh install, upgrade preserving `.env`/`data`, forced
  build failure, and the rollback branch (its first execution on any platform), then a
  clean uninstall. See the Outcome section of
  `.agents/plans/deploy-macos-windows-hardening.md`.
- Local `main` is ahead of `origin` (Gitea) and `github`, which are in sync with each
  other at `b197735` (the 1.6.6 docs refresh) — as of commit `88f0780`, not yet pushed
  (push policy: ask first).
- Version **1.6.6** remains what is deployed and verified in production (Linux,
  2026-07-10). Governance is at the AgentGovernanceBootstrap standard template
  (2026-07-02.1).

## Next

- **Owner run of `deploy.ps1` on Windows.** The rewrite parses clean under pwsh 7.6 and
  its staging loop was executed verbatim on macOS, but the Scheduled Task paths (swap
  under a running task, rollback, post-swap ACL) cannot be exercised off-Windows.
- Decide the open question in `.agents/decisions.md`: should a high-severity
  production advisory block a *release*, now that it no longer blocks a merge?
- Deferred with a trigger, not a date: when Node 26 enters LTS (2026-10-28), move
  the CI matrix to 24 + 26 and raise the `engines` floor and the three deploy
  scripts' Node checks in the same change.

## Blockers

- None recorded.

## Verification

- Automated (mirrors the CI build job): `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`. See `.agents/repo-map.json` for the canonical command list.
  `npm audit --omit=dev --audit-level=high` no longer runs in the build job; it has its
  own weekly workflow (`.github/workflows/audit.yml`). See `.agents/decisions.md`.
- Behavior not covered by automation (the live UI against a running qBittorrent, the
  deploy/uninstall scripts) needs a manual check or an explicit note that it was not run.

## Active Sources

- `AGENTS.md`
- `.agents/repo-guidance.md`
- `.agents/repo-map.json`
- `.agents/decisions.md`

## Unrecorded Repo Memory

- The proxy's endpoint and field allowlists plus the fail-closed auth gate are a
  deliberate security boundary; this is captured in `.agents/repo-guidance.md` and
  `.agents/decisions.md`.
- Files under `docs/` are dated review snapshots (2026-05-04) describing an older state of
  the code (they say "React 18", "zero tests", "two API clients") and are kept as history,
  not current truth.
