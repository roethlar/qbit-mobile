# Plan: deploy script hardening

Status: Drafted 2026-07-10, owner approved ("plan and fix").

## Why

`sudo ./deploy.sh` failed on 2026-07-10 because `build-id.ts` was added at the repo
root and imported by `vite.config.ts`, but not added to the script's hand-maintained
copy list (fixed in `bde77a7`). That bug was a symptom. Review surfaced three defects
that made a one-line mistake into a half-applied install.

## Findings

### 1. `npm ci || npm install` defeats the lockfile (deploy.sh:127, deploy-macos.sh:100, deploy.ps1:112)

`npm ci` installs exactly the lockfile that was tested and audited. On failure the
fallback resolves fresh versions from the registry, so a broken or stale lockfile
silently yields a deployed tree that nothing tested and `npm audit` never saw — running
as root, on the host that fronts qBittorrent. A loud correct failure is converted into a
quiet wrong success.

Severity: highest of the three. Cheapest to fix.

### 2. The copy list is an allowlist maintained by hand

Nothing ties `deploy.sh`'s list of root files to what the build needs, so it drifts
silently. The `rm -rf` block above it (`App.tsx`, `main.tsx`, `qbClient.js`,
`manifest.json`, `contexts/`, `routes/`, `services/`, ...) is accumulated scar tissue:
each entry is a past reorganization that stranded a stale file on a live install.

An allowlist fails closed against *new* files. A denylist (copy everything except
`node_modules`, `dist`, `.git`, `.env`, `data`, and repo-only directories) fails open,
which is the correct direction here: a forgotten exclude wastes disk, a forgotten
include breaks the build.

### 3. No atomicity

The script `rm -rf`s the installed source, copies, `npm ci`s, then builds. A failure at
any step after the first leaves a half-updated install. This is not hypothetical: the
2026-07-10 failure left `/opt/qbit-mobile` holding the new server source and Express 5
in `node_modules`, with the old `dist/` and the old process still running.

Correct shape: do all work in a staging directory, and only swap it into place once the
build has succeeded. A failure then leaves the previous install untouched.

### 4. The Node floor is stated in five places

`deploy.sh`, `deploy-macos.sh`, `deploy.ps1`, `package.json` `engines`, and the CI
matrix. All three scripts still enforce 22.12 while CI now also tests 24. No single
source of truth. Low severity, real drift.

## Constraints

- `DATA_DIR` defaults to `<app>/../data` (`server/locations.js:11`), i.e.
  `/opt/qbit-mobile/data`. Runtime state lives *inside* the install directory. Any swap
  must carry `.env` and `data/` forward, and must do so after the service is stopped, or
  a write between copy and swap is lost.
- `uninstall.sh` hard-codes `APP_DIR=/opt/qbit-mobile`. The install path must not change.
- **This session cannot run `sudo ./deploy.sh`.** Anything below that is not covered by
  an automated test is unverified by the agent and needs an owner run.

## Slices, one commit each

1. **Delete the `npm ci` fallback** in all three scripts. Guard with a test asserting no
   script contains a fallback to `npm install`. (Automated test: yes.)
2. **Denylist copy + staging swap** in `deploy.sh` only. Build into `${APP_DIR}.stage`,
   stop the service, carry `.env` and `data/` across, then `mv` into place, keeping the
   previous tree as `${APP_DIR}.old.$$` until the service comes up healthy. Deletes the
   fossil `rm -rf` list, which a fresh staging dir makes unnecessary.
   (Automated test: the exclude set only. The swap is **owner-verified**.)
3. **Single source for the Node floor.** Read `engines.node` from `package.json` rather
   than restating it. (Automated test: yes.)

`deploy-macos.sh` and `deploy.ps1` get slice 1 only. Slices 2 and 3 for those platforms
are deferred: neither can be exercised from this machine, and an untested rewrite of a
destructive root script is worse than a known-brittle one. Recorded as follow-up.

## Non-goals

Building on the target as root and shipping `src/` + `eslint.config.js` to production is
a real smell — a locally built `dist/` would remove the whole dev-toolchain surface from
the server. Out of scope: it changes the release process, not just the script.
