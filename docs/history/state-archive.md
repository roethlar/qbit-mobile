# Agent State Archive

Completed or superseded `## Now` entries rotated from `.agents/state.md` by the
`catchup` hygiene sweep.

## Archived 2026-07-27

- Axios was upgraded from 1.16.1 to 1.18.1 on 2026-07-27 in response to the
  weekly production audit, and the app version is now **1.6.9**. The production
  audit and the full automated verification suite pass.
- The deploy-script hardening is now ported to **all three platforms**. 2026-07-10,
  commits `a16fd10` (macOS) and `88f0780` (Windows), version **1.6.8**: engines-derived
  Node floor, `git ls-files` staging, staged build + atomic swap, rollback on a failed
  start, uninstall sweeps `.stage`/`.old.*`. `deploy-macos.sh` was verified with real
  runs on the Mac dev machine — fresh install, upgrade preserving `.env`/`data`, forced
  build failure, and the rollback branch (its first execution on any platform), then a
  clean uninstall. See the Outcome section of
  `.agents/plans/deploy-macos-windows-hardening.md`.
