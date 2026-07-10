# Agent Decisions

Record durable repo decisions here. Do not use this as a chat log. Each entry should make
sense without conversation history and should name superseded guidance when relevant.

Keep this file to what is currently in force or still open. When a decision is
closed - superseded, or settled and retained only as the rationale for a rule that
now lives in its canonical home elsewhere - move it verbatim, in that same change,
to an archive under `docs/history/` (for example `docs/history/decisions-archive.md`);
never summarize or drop wording, the exact text is the record. Keep a single
pointer to the archive at the top of this file, not a stub per entry. The archive
is the provenance log; this file is what is in force or still open.

## Decision lifecycle

A decision moves through these states:

- **Open** - a finding has been assessed but not yet acted on. It lives in the
  `## Open Decisions` queue below, with the verified evidence, the options, and a
  standing recommendation. The process is unchanged until it is adopted; an agent
  records it rather than implementing on the spot.
- **Active** - a decision that is in force now.
- **Adopted YYYY-MM-DD** - an Open finding that has been acted on: its rule now
  lives in its canonical home (a procedure, template, or invariant). Note where the
  rule landed; the finding is retained in place as the rationale that led to it,
  until it is archived.
- **Superseded** - replaced by a later decision; name the replacement.

When an entry becomes purely historical rationale - Adopted or Superseded, with the
live rule now owned elsewhere - archive it per the rule above: move it verbatim to
`docs/history/`, do not leave a stub.

## Decisions

### Server is a fail-closed security boundary in front of qBittorrent

Status: Active

Decision:
The Express proxy enforces three protections that must not be weakened without explicit
owner approval: (1) app auth is on by default (`AUTH_MODE=basic`) and the server exits
rather than boot with missing credentials or an unrecognized `AUTH_MODE`; (2) only a
curated set of qBittorrent endpoints is forwarded; (3) set-preferences and add-torrent
requests are filtered against field allowlists (`ALLOWED_SET_PREF_KEYS` in
`server/server.js`, `ALLOWED_ADD_FIELDS` in `server/routes/torrents.js`), so dangerous
endpoints and RCE-enabling preference keys stay unreachable.

Reason:
The app binds to `0.0.0.0` so it can be reached from a phone on the LAN; the allowlists
and auth gate are what keep that exposure safe. Evidence: `server/server.js` (auth
exits at lines ~50 and ~57-63; `ALLOWED_SET_PREF_KEYS`), `server/routes/torrents.js`
(`ALLOWED_ADD_FIELDS`), and the README "Notes on Compatibility and Security" section.

### Node floor is 22.12 to match Vite 8 engines

Status: Active

Decision:
The supported Node version is `>=22.12.0` (`package.json` `engines`). CI exercises both
Node 22 (the declared floor) and Node 24 (Active LTS) via a build matrix.

Reason:
Vite 8 requires `^20.19.0 || >=22.12.0`; the floor was deliberately tightened to match
(commit "Tighten Node floor to 22.12 to match Vite 8 engines"). Building or testing on
older Node is unsupported.

The floor stays at 22.12 rather than rising to 24: `deploy.sh`, `deploy-macos.sh`, and
`deploy.ps1` each enforce 22.12+ at install time, so raising it would break self-hosted
installs on a runtime that is still supported (Node 22 receives fixes until 2027-04-30).
CI tests the floor as well as Active LTS so the `engines` claim is proven, not assumed.

### CI gates merges to main; the dependency audit runs separately

Status: Active. Supersedes the earlier form of this decision, in which
`npm audit` ran inside the blocking CI build job.

Decision:
`.github/workflows/ci.yml` runs lint, typecheck, test, and build on every push and pull
request to `main`, across a Node 22/24 matrix. The production dependency audit
(`npm audit --omit=dev --audit-level=high`) runs in its own workflow,
`.github/workflows/audit.yml`, on a weekly schedule and on manual dispatch.
`.github/dependabot.yml` tracks production deps, dev deps, and the workflow actions
themselves. The local verification command set is kept aligned with the CI build steps.

Reason:
Confirmed the workflows live in a provider-executable path (`.github/workflows/`) and
their branch triggers (`main`) match the repo's current branch, so they actually run.
Keeping local checks aligned with CI avoids "passes locally, fails in CI" drift.

The audit was split out because both CI failures in this repo's history were the audit
step failing on an advisory published against an already-shipped dependency
(`form-data`/`qs` in 2026-06, `multer` in 2026-07), not a regression in the change under
test. A blocking audit turns the next unrelated push red and blames a commit that did not
cause the problem and often cannot fix it. Dependency currency does not prevent this:
the advisory lands against the version already in use, so being fully up to date on the
morning of disclosure still fails the build that afternoon.

Trade-off, accepted deliberately: a high-severity production advisory no longer blocks
merge. Coverage is preserved by the weekly audit run plus Dependabot security update
PRs (which require "Dependabot security updates" enabled in GitHub repo settings;
enabled 2026-07-10). This is a routing change, not a relaxation of the security
boundary described above — the proxy allowlists and auth gate are untouched.

### Server runs Express 5; the SPA fallback must stay a RegExp

Status: Active (adopted 2026-07-10, commits `cc69364` and `1ceca1c`)

Decision:
`server/` runs Express 5 (`express@^5.2.1`). The SPA fallback in `server/server.js` is
registered as `app.get(/.*/, ...)` — a RegExp, deliberately not a string path.

Reason:
Express 5's path-to-regexp v8 rejects a bare `'*'` string, and its v5 replacement
`'/*splat'` is invalid in Express 4. A RegExp is valid in both, which let the routing
fix land separately from the version bump. Do not "simplify" this back to a string:
with `'*'`, the server does not fail a test, it fails to load
(`Missing parameter name at index 1: *`) and will not boot.

Express 4 was upgraded rather than pinned because it has no published end-of-support
date (expressjs.com/en/support and the repo's `Security.md` both 404 as of 2026-07-10).
It was maintained at the time — 4.22.2 shipped 2026-05-11 — but an unknown horizon on
the app's security boundary is a poor thing to discover under advisory pressure.

The migration surface was measured, not assumed: every route is a literal static path
(no `:params`, no optional segments, no inline regex), `req.query` is read once as a
flat scalar, and `express-rate-limit@8` accepts `express >= 4.11`. The endpoint
allowlist, fail-closed auth gate, and add-torrent field allowlist tests all pass
unmodified — the standing check for any future Express upgrade is that they continue to.

### The SPA fallback route requires ./dist to exist, including under test

Status: Active (adopted 2026-07-10, commit `cc69364`)

Decision:
`test/setup.ts` seeds a placeholder `dist/index.html` when none exists.

Reason:
`server/server.js` registers `express.static` and the SPA fallback only when `./dist`
exists. CI runs `npm test` before `npm run build`, so before this change the fallback
route was absent under CI while present on any developer machine that had built — the
two environments silently disagreed and the route shipped untested. `vite build` empties
the directory afterwards, so the placeholder never reaches a release artifact.

## Open Decisions (deferred - not yet adopted)

Assessed findings the owner chose to record as a future decision rather than
implement now. The process is unchanged until one is adopted. Each states its
verified evidence, the options, and a standing recommendation. When one is adopted,
flip its status to `Adopted YYYY-MM-DD`, note where the rule now lives, and keep the
finding here as the rationale until it is archived.

### Should a high-severity production advisory block a release?

Status: Open (raised 2026-07-10)

Since `499a136` the production `npm audit` runs weekly rather than on every push, so a
high-severity advisory no longer blocks a merge. No gate blocks a *release* either — the
release path has no audit step at all.

Options: (a) add `npm audit --omit=dev --audit-level=high` to a release workflow, so
tagging a version fails while a known high-severity advisory is unfixed; (b) accept the
Dependabot security PR as the only signal and rely on the maintainer noticing.

Recommendation: (a). It restores a hard gate exactly where the cost of shipping a known
vulnerability is highest, without reintroducing the failure mode that made the old gate
painful — an advisory blocking an unrelated contributor's push.

Not decided; the owner has not chosen.
