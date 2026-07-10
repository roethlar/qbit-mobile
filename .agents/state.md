# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- No active feature work in progress. The repo is at version 1.5.2 on `main`
  (HEAD `283556d`). The v1.5.2 patch release (path-writing validation hardening,
  `.env` permission tightening, deploy-script guard, and several bug fixes) has
  shipped.
- Governance was refreshed to the AgentGovernanceBootstrap standard template
  (2026-07-02.1): `AGENTS.md` is now the portable template verbatim, and
  repo-specific content moved to `.agents/repo-guidance.md`.

## Next

- None recorded.

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
