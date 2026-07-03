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
The supported Node version is `>=22.12.0` (`package.json` `engines`), and CI runs on
Node 22.

Reason:
Vite 8 requires `^20.19.0 || >=22.12.0`; the floor was deliberately tightened to match
(commit "Tighten Node floor to 22.12 to match Vite 8 engines"). Building or testing on
older Node is unsupported.

### CI gates merges to main

Status: Active

Decision:
`.github/workflows/ci.yml` runs lint, typecheck, test, build, and a production
`npm audit` on every push and pull request to `main`. The local verification command
set is kept aligned with these CI steps.

Reason:
Confirmed the workflow lives in a provider-executable path (`.github/workflows/`) and its
branch triggers (`main`) match the repo's current branch, so it actually runs. Keeping
local checks aligned with CI avoids "passes locally, fails in CI" drift.

## Open Decisions (deferred - not yet adopted)

Assessed findings the owner chose to record as a future decision rather than
implement now. The process is unchanged until one is adopted. Each states its
verified evidence, the options, and a standing recommendation. When one is adopted,
flip its status to `Adopted YYYY-MM-DD`, note where the rule now lives, and keep the
finding here as the rationale until it is archived.

None recorded.
