# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- No active work in progress. `main` is at version **1.6.6**, deployed and verified
  in production 2026-07-10: `sudo ./deploy.sh` ran the atomic staging swap, a real
  torrent uploaded through the Express 5 proxy against live qBittorrent, and the
  header showed the deployed build. Local, `origin` (Gitea), and `github` are all in
  sync at the merge commit `f7da04e`.
- The 2026-07-10 work, all landed, pushed, and verified: multer 2.2.0; Express 4 → 5;
  the CI/audit restructure (Node 22+24 matrix, `npm audit` split to a weekly workflow,
  Dependabot enabled); the UI build-id/version display; the versioning rule; and the
  deploy.sh hardening (staging swap + rollback, `git ls-files` staging, Node floor read
  from `engines`). See `.agents/plans/` and `.agents/decisions.md`.
- Governance was refreshed to the AgentGovernanceBootstrap standard template
  (2026-07-02.1); `f7da04e` merged github's divergent refresh with no content change.

## Next

- Decide the open question in `.agents/decisions.md`: should a high-severity
  production advisory block a *release*, now that it no longer blocks a merge?
- `deploy-macos.sh` and `deploy.ps1` still have the pre-hardening include list,
  non-atomic copy, and a hardcoded Node floor; `deploy.ps1` syntax is unverified
  (no `pwsh` on the dev machine). See `.agents/plans/deploy-hardening-2026-07.md`.
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
