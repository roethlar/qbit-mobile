# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- No active feature work in progress. The repo is at version 1.5.2 on `main`.
  The v1.5.2 patch release (path-writing validation hardening, `.env` permission
  tightening, deploy-script guard, and several bug fixes) has shipped.
- Governance was refreshed to the AgentGovernanceBootstrap standard template
  (2026-07-02.1): `AGENTS.md` is now the portable template verbatim, and
  repo-specific content moved to `.agents/repo-guidance.md`.
- 2026-07-10, CI/dependency work, all landed and **unpushed as of `1ceca1c`**:
  multer 2.2.0; `checkout@v7` / `setup-node@v6`; Node 22+24 CI matrix; `npm audit`
  moved out of the blocking build into a weekly workflow; Dependabot added;
  Express 4 → 5. See `.agents/plans/dependency-currency-2026-07.md` and the
  corresponding entries in `.agents/decisions.md`.

## Next

- Push the 2026-07-10 commits. `origin` (Gitea) needs interactive credentials;
  `github` is the remote that runs CI and Dependabot.
- Decide the open question in `.agents/decisions.md`: should a high-severity
  production advisory block a *release*, now that it no longer blocks a merge?
- Manual check not yet run: a real add-torrent round trip against a live
  qBittorrent on Express 5. The upgrade was verified against mocked axios and a
  smoke test of the proxy's own 404/401 paths only.
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
