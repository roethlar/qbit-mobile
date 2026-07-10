# Repo-Specific Guidance
<!-- Extends AGENTS.md; never overrides it. Rules and pointers only — state
     lives in .agents/state.md. -->

## Mission Detail

qBit Mobile is a mobile-first web UI for qBittorrent. It has two parts:

- **Frontend** (`src/`) — React 19 + TypeScript + Vite 8 + Tailwind, shipped as an
  installable PWA. State via TanStack Query.
- **Backend** (`server/`) — an Express proxy that forwards a curated allowlist of
  qBittorrent Web API endpoints. It is the app's security boundary.

Deploy/uninstall scripts for Linux (`deploy.sh`, systemd), macOS (`deploy-macos.sh`,
launchd), and Windows (`deploy.ps1`, Scheduled Task) live at the repo root.
`.agents/repo-map.json` is the structured map of components and verification commands.

**Security invariant — do not erode without explicit approval.** Two server-side
allowlists and a fail-closed auth gate are deliberate, not incidental:

- App auth is on by default (`AUTH_MODE=basic`) and the server refuses to boot when
  credentials are missing or `AUTH_MODE` is unrecognized (`server/server.js`).
- The proxy forwards only a curated set of qBittorrent endpoints, and the
  set-preferences / add-torrent paths gate fields against allowlists
  (`ALLOWED_SET_PREF_KEYS` in `server/server.js`, `ALLOWED_ADD_FIELDS` in
  `server/routes/torrents.js`). Dangerous endpoints (e.g. `/app/shutdown`) and
  RCE-enabling preference keys (e.g. `autorun_program`) are intentionally unreachable.

Widening an allowlist or relaxing the auth gate is a security-relevant change: surface
it for approval and keep the README's security section in sync. See
`.agents/decisions.md` for the full decision record.

## Reading Order

1. `AGENTS.md` (portable governance).
2. This file, `.agents/repo-guidance.md` (repo-specific rules).
3. `.agents/state.md` (current active work and blockers).
4. `.agents/decisions.md` (durable decisions and supersessions).
5. Current code, tests, and CI as evidence for behavior.
6. `README.md` and other docs, only when consistent with current repo evidence.
   Files under `docs/` are dated review snapshots (history), not current state —
   verify any claim in them against current code before relying on it.

## Verification

The current automated checks mirror the CI build job (`.github/workflows/ci.yml`):
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. CI runs on push
and pull request to `main`, across a Node 22/24 matrix. The production dependency
audit (`npm audit --omit=dev --audit-level=high`) runs separately, weekly, in
`.github/workflows/audit.yml` — see `.agents/decisions.md` for why. See
`.agents/repo-map.json` for the canonical, per-project command list.

Behavior not covered by automation (the live UI against a running qBittorrent,
or the deploy/uninstall scripts) needs a manual check, smoke test, or playtest,
or a clear note that it was not run.

## Remotes & Sync

- `origin` — `http://q.internal:3000/michael/qbit-mobile` (fetch and push).
- Push policy is recorded separately in `.agents/push-policy.md`.

## Versioning

Every commit that changes shipped code bumps `version` in `package.json` (and the
matching `packages[""].version` in `package-lock.json`), in that same commit:

- **patch** — bug fix, dependency bump, or any change with no user-visible behavior change.
- **minor** — new user-visible capability.
- **major** — a breaking change to deployment, configuration, or the app's contract.

Shipped code means anything reaching a deployed user: `src/`, `server/`, `index.html`,
build config, the deploy scripts. Commits touching only `.agents/`, `docs/`, `README.md`,
tests, or CI workflows do not bump.

This is separate from the build id shown in the UI header (`build-id.ts`), which
appends a commit ref and timestamp so that *individual builds* are distinguishable.
The version says what changed; the build id says which build. See `.agents/decisions.md`.

## Earned Practices

None beyond the portable Git Safety rules already stated in `AGENTS.md`
(merged-branch verification, one-finding-per-commit discipline, no history
rewrites). The former `AGENTS.md` carried these as repo rules; they are now
part of the portable template itself, so nothing repo-specific remains here.
