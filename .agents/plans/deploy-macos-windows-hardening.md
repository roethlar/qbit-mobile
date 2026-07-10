# Spec: port deploy.sh hardening to macOS and Windows

Status: Drafted 2026-07-10. **For a future Claude Code session running ON macOS / ON
Windows** — the platform where the target script can actually be executed and tested.
Not executable from the Linux dev machine (no way to run launchd, `pwsh`, Scheduled
Tasks, or bsdtar behaviour there). Do the macOS half on a Mac, the Windows half on
Windows; they are independent.

## Reference implementation

`deploy.sh` is the proven original (deployed and verified in production 2026-07-10).
Mirror its structure. The four properties to reproduce, each already justified in
`.agents/decisions.md`:

1. **npm ci, no fallback.** Already done in both scripts — leave it.
2. **Stage the files git tracks** (`git ls-files`), never a hand-list and never an
   exclude list. See the decision "deploy.sh stages the files git tracks" for why an
   exclude list is unsafe (it leaks `.env.local`/`.env.production`).
3. **Build in a staging dir, swap atomically.** Nothing touches the live install until
   the build succeeds; then stop the service, carry `.env` + `data/` across, move staged
   tree into place, keep the previous tree until the service is confirmed healthy, roll
   back on a failed start.
4. **Node floor from `package.json` `engines.node`**, not a literal `22.12`.

Delete from both: the fossil `rm -rf .../server` pre-copy wipe, the per-file copy list,
and the stale repo-root-guard comment that still says "deletes the installed
server/src/public first".

The canonical Linux sequence to mirror (deploy.sh):
`git ls-files -z | tar --null -T - -cf - | tar -xf - -C "$STAGE"` → `cd $STAGE` →
`npm ci` → `npm run build` → `npm prune --omit=dev` → …env prompts write to the *old*
`$APP_DIR/.env`… → stop service → `cp` `.env` and `data/` into `$STAGE` → `mv $APP_DIR
$APP_DIR.old.$$` → `mv $STAGE $APP_DIR` → start → on success `rm -rf` the `.old`, on
failure restore it and restart.

## Guardrails (both platforms)

- `test/deploy-manifest.test.ts` runs cross-platform (it only reads the script text). It
  already asserts, for `deploy-macos.sh` and `deploy.ps1`, that they copy every
  `vite.config.ts` local import and never fall back to `npm install`. After the rewrite
  those manifest-copy assertions will be **wrong** (there is no copy list anymore). Move
  each script from the `MANIFEST_SCRIPTS` list to the `deploy.sh`-style checks: stages via
  git, no `--exclude`, refuses outside a git repo, no fossil wipe. Keep the npm-ci
  assertions for all three. Re-run `npm test` — it passes on any platform.
- Bump `package.json` version (patch) in the same commit; deploy scripts are shipped code.

## macOS — deploy-macos.sh

Service manager: launchd (user LaunchAgent). `APP_DIR` is
`~/Library/Application Support/qbit-mobile` — **contains a space.** Every path reference
must stay quoted; `STAGE_DIR="${APP_DIR}.stage"` and `${APP_DIR}.old.$$` inherit the
space and are fine when quoted.

Concrete deltas:

1. Lines ~55-61: replace the literal `-lt 22 … 22.12` block with the engines-derived
   floor from deploy.sh lines ~76-95 (the `require('./package.json').engines.node`
   read + `sed -n 's/^>=\.../p'` parse + fail-closed on empty). Move it *after* the
   repo-root guard, as deploy.sh does (it reads `./package.json`).
2. Lines ~68-95: delete the `rm -rf`/`cp` block and its stale comment. Insert the
   deploy.sh staging block: `REPO_ROOT="$(pwd)"`, `STAGE_DIR`, `trap cleanup_stage EXIT`,
   the not-a-git-repo guard, and the `git ls-files -z | tar --null -T - -cf - | tar -xf
   - -C "${STAGE_DIR}"` pipe.
   - **Verify on the Mac:** bsdtar accepts `--null -T -` and `-xf - -C`. Expected to work
     (libarchive supports both) but confirm with a real run, not just `bash -n`.
3. Build in `${STAGE_DIR}`: `cd "${STAGE_DIR}"` for `npm ci`/`build`/`prune`, then
   `cd "${REPO_ROOT}"`. Do **not** `cd "${APP_DIR}"` for the build any more.
4. The `.env` prompt block already writes to `${ENV_FILE}` = `${APP_DIR}/.env`. Keep it
   writing to the old `${APP_DIR}` (created early), then add the swap *after* it:
   - `launchctl bootout "${GUI_TARGET}" "${PLIST_FILE}" 2>/dev/null || true` to stop.
   - `cp -p "${ENV_FILE}" "${STAGE_DIR}/.env"` if present;
     `cp -a "${APP_DIR}/data" "${STAGE_DIR}/data"` if present.
   - `PREV_DIR="${APP_DIR}.old.$$"; mv "${APP_DIR}" "${PREV_DIR}";
     mv "${STAGE_DIR}" "${APP_DIR}" || { mv "${PREV_DIR}" "${APP_DIR}"; exit 1; }`
5. Existing plist write + `launchctl bootstrap/kickstart` stays, but the final
   health-check `else` branch must roll back: restore `${PREV_DIR}` → `${APP_DIR}`,
   re-`bootstrap` the old plist, report. On success `rm -rf "${PREV_DIR}"`.
6. `GUI_TARGET="gui/$(id -u)"` is defined late today; hoist it above the swap since the
   stop step needs it.

Verify on the Mac: `bash -n deploy-macos.sh`; a real install onto a clean
`~/Library/Application Support/qbit-mobile`; an upgrade over an existing install
(confirm `.env` and `data/locations.json` survive); a forced build failure (e.g. temoff
a dep) leaves the old LaunchAgent running.

## Windows — deploy.ps1

Service manager: Scheduled Task. `$AppDir` = `$env:LOCALAPPDATA\qbit-mobile`. The task
action + generated `run-qbit-mobile.ps1` live inside `$AppDir`, so they must be
(re)generated *after* the swap — the current flow already writes them near the end, keep
that after the swap.

Concrete deltas:

1. Lines ~59-66: replace the literal `22/12` check with an engines-derived floor. Read
   it in PowerShell: `$engines = (& $NodeBin -p "require('./package.json').engines.node")`
   then regex `^>=(\d+)\.(\d+)` → `$floorMajor/$floorMinor`; abort if no match (fail
   closed, mirroring deploy.sh). Do it after the repo-root guard.
2. Lines ~88-107: delete the `Remove-Item`/`Copy-Item` list and stale comment. Stage via
   git. **`tar` caveat:** Windows 10/11 ship bsdtar as `tar.exe`, but do not assume it.
   Preferred portable approach: `git -C $RepoRoot ls-files` (newline-delimited — filenames
   with newlines cannot occur on Windows), then for each rel path,
   `New-Item -ItemType Directory` the parent under `$StageDir` and `Copy-Item` the file.
   This is the self-maintaining allowlist without depending on tar. Refuse if
   `git rev-parse --git-dir` fails.
3. Build in `$StageDir`: `Push-Location $StageDir` for `npm ci`/`build`/`prune`.
4. `.env` prompts still target `$EnvFile` = `$AppDir\.env` (old dir). After them:
   - `Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue`.
   - Copy `$EnvFile` and `$AppDir\data` into `$StageDir` if present.
   - `$PrevDir = "$AppDir.old.$PID"; Move-Item $AppDir $PrevDir; Move-Item $StageDir
     $AppDir` inside try/catch that restores `$PrevDir` on failure.
5. Runner-script generation + `Register-ScheduledTask` stay, after the swap. The
   health-check `else` must roll back to `$PrevDir` and re-register/restart. On success
   `Remove-Item $PrevDir -Recurse -Force`.
6. ACL tightening on `.env` currently runs before the task step; it must run on the
   post-swap `$AppDir\.env`. Since `.env` is carried into the swapped tree, tighten it
   after the swap.

Verify on Windows: `pwsh -NoProfile -Command "[System.Management.Automation.Language.Parser]::ParseFile(...)"` for syntax
(the Linux box has no pwsh, so this was never checkable before); a real install; an
upgrade preserving `.env` + `data`; a forced build failure leaving the old task intact.

## Uninstall scripts

`uninstall-macos.sh` / `uninstall.ps1` remove `$APP_DIR`. They are unaffected by this
change (the swap leaves a single `$APP_DIR`, and `.old.$$` is always cleaned up on both
success and rollback). No edit needed, but confirm no `.stage`/`.old` residue is left by
an interrupted run — if found, have uninstall sweep `${APP_DIR}.stage` and
`${APP_DIR}.old.*` too.
