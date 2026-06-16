# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- No active feature work in progress. The repo is at version 1.5.1 on `main`
  (HEAD `800b131`). The 2026-06-15 code review and its rechecks are resolved and merged.

## Next

- A v1.5.2 patch release carrying the review fixes is drafted but not yet bumped,
  tagged, or published.

## Blockers

- None recorded.

## Verification

- Automated (mirrors CI): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
  See `.agents/repo-map.json` for the canonical command list. CI also runs
  `npm audit --omit=dev --audit-level=high`.
- Behavior not covered by automation (the live UI against a running qBittorrent, the
  deploy/uninstall scripts) needs a manual check or an explicit note that it was not run.

## Active Sources

- `AGENTS.md`
- `.agents/repo-map.json`
- `.agents/decisions.md`

## Unrecorded Repo Memory

- The proxy's endpoint and field allowlists plus the fail-closed auth gate are a
  deliberate security boundary; this is captured in `AGENTS.md` and `.agents/decisions.md`.
- Files under `docs/` are dated review snapshots (2026-05-04) describing an older state of
  the code (they say "React 18", "zero tests", "two API clients") and are kept as history,
  not current truth.
