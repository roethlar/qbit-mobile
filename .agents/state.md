# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

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
- The high-severity `ip-address` advisories (SSRF/trust-boundary, reached via
  `express-rate-limit`) are fixed by the lockfile bump to 10.5.0, committed as
  **2.0.1** (2026-08-17). The GitHub mirror's weekly audit keeps failing until
  that commit is pushed there.

## Next

- **Fix `BottomSheet` focus stealing** (`src/components/Layout.tsx`, found 2026-08-25
  while testing 2.1.0). Its open/close effect depends on `[isOpen, onClose]` and calls
  `containerRef.current.focus()` on every run; `AddTorrent` passes a fresh `handleClose`
  each render, so every keystroke inside the Add Torrent sheet re-runs the effect and
  moves focus off the field — in jsdom `user.type` delivers only the first character
  (`AddTorrent.test.tsx` uses `fireEvent.change` to sidestep it). Proposed fix: hold
  `onClose` in a ref so the effect depends on `isOpen` only, then switch the test back
  to `user.type` as the regression check. Needs an owner go; not yet reproduced on a
  real device.
- **Owner run of `deploy.ps1` on Windows.** The rewrite parses clean under pwsh 7.6 and
  its staging loop was executed verbatim on macOS, but the Scheduled Task paths (swap
  under a running task, rollback, post-swap ACL) cannot be exercised off-Windows.
- Decide the open question in `.agents/decisions.md`: should a high-severity
  production advisory block a *release*, now that it no longer blocks a merge?
- Push `main` to `origin` and the `github` mirror (the mirror is also two commits
  behind from before the 2.0.1 audit fix). Push policy is ask-first; awaiting an
  owner go.

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
