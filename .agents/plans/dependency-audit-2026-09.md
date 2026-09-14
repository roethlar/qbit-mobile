# September 2026 dependency audit remediation

Status: Production remediation published; full audit remediation in progress,
2026-09-14.
Scope authorized by the owner's instruction to investigate and remediate the
failed GitHub audit.

## Evidence

- [Failed Audit run](https://github.com/roethlar/qbit-mobile/actions/runs/34850449322)
  ran against `2d380ff` on 2026-09-14. Local HEAD and both remote main refs matched
  that commit when checked with `git ls-remote`. The September 7 run passed on the
  same commit; the failure comes from newly reported dependency advisories.
- `npm audit --omit=dev --audit-level=high` reproduces the failure: `multer@2.2.0`
  (high) and transitive `qs@6.15.2` (moderate).
- Multer 2.3.0 patches GHSA-wc9g-mqfw-jrwm, GHSA-qfvm-cv95-jqjf,
  GHSA-qvfw-j98x-7q72, and GHSA-535w-7cp7-47q4. The app parses multipart fields
  with Multer, behind app authentication. It uses memory storage and no custom
  file filter, so the disk-storage leak and async-filter race do not match its
  configuration; the field-parsing denial-of-service issues remain relevant.
- qs 6.16.0 patches GHSA-x5fp-wj9c-mxmx and GHSA-4mjr-xmp4-gh2g and satisfies
  the existing Express/body-parser/Superagent dependency ranges.
- Installed dependencies were stale (including Express 4); `npm ci` restored the
  committed dependency tree before implementation and validation.

## Implementation

1. Upgrade the direct Multer requirement and lockfile to 2.3.0 and set
   `fieldArrayIndexLimit: 0` for the app's flat multipart fields. The new limit
   defaults to Infinity, so the upgrade alone does not close
   GHSA-535w-7cp7-47q4. Add a regression proving indexed fields are rejected
   before forwarding upstream; demonstrate failure with the limit removed and
   success after restoration. Bump to 2.1.2, verify, and commit with state.
2. Upgrade the transitive qs lockfile entry to 6.16.0 and any required dependency;
   bump the app to 2.1.3. Verify and commit this finding with its state update.

Keep updates targeted. Preserve the auth gate, proxy allowlists, and audit policy.
Existing tests cover multipart forwarding, field filtering, and server behavior;
use those plus the new index-limit regression and the production audit.

## Verification and publication

For each slice run lint, typecheck, tests, build, and the production audit. At the
end verify installation from the final lockfile with `npm ci` and require zero
production vulnerabilities. Record actual outcomes below. Live qBittorrent and
deployment checks are outside this dependency and upload-limit remediation.

Push requires owner approval under `.agents/push-policy.md`. After approval, push
both remotes, dispatch the Audit workflow on the fixed GitHub main, and verify
that audit and the Node 24/26 CI matrix pass.

## Results

- Multer slice committed as `9d9d0e2` (2.1.2): dependency 2.3.0 plus explicit
  `fieldArrayIndexLimit: 0`. On Node 26.8.2/npm 12.0.2, clean install, lint,
  typecheck, 176 tests, and build passed. The new regression returned 200 instead
  of 400 when the limit was temporarily removed, then passed after restoration.
  Production audit exits zero at the high threshold with only qs (moderate)
  remaining. No live qBittorrent or deployment check was run.
- qs slice committed as `9dd7bba` (2.1.3): qs 6.15.2 -> 6.16.0 and its required
  side-channel 1.1.0 -> 1.1.1. No other package versions changed. On Node
  26.8.2/npm 12.0.2, `npm ci`, lint, typecheck, all 176 tests, build, and
  `npm audit --omit=dev --audit-level=high` passed; the audit reports zero
  vulnerabilities. `npm ls multer qs --all` confirms Multer 2.3.0 and one
  deduplicated qs 6.16.0 used by Express, body-parser, and Superagent.
- Owner approved publication and GitHub verification on 2026-09-14. Both
  remotes were pushed and their main refs verified at `9dd7bba` using
  `git ls-remote`.
- [GitHub Audit](https://github.com/roethlar/qbit-mobile/actions/runs/34852542409)
  passed on `9dd7bba`, reporting zero production vulnerabilities.
- [GitHub CI](https://github.com/roethlar/qbit-mobile/actions/runs/34852543339)
  passed on `9dd7bba`: clean install, lint, typecheck, tests, and build on both
  Node 24 and Node 26.
- Deployment was not performed. Pre-existing untracked `.agents/machines.md`
  and `.agents/plans/repo-review-fixes-2026-07.md` were left untouched.

## Expanded scope: every audit and test

On 2026-09-14 the owner instructed: "do not stop until this passes every audit
and test." This expands the remediation to development dependencies and includes
publication and GitHub verification under the existing push authorization.

Baseline: local HEAD and both remote main refs matched `873f0fd`. Full `npm audit`
failed on seven packages (three high, three moderate, one low), while the
production audit was clean. Inspecting package scripts, both GitHub workflows,
and all test/config files identifies the automated acceptance checks below.

Implementation: update the six affected dependency groups in separate commits,
using patched releases within their current compatible ranges. Keep the Vitest
packages on a matching version. Inspect each lockfile diff and run the repository
lint, typecheck, tests, and build before committing. Use the audit to verify each
finding disappears; no new tests are needed for these upstream dependency fixes.
Patch-bump the app with each dependency slice. Preserve auth, allowlists, tests,
and the existing audit workflow policy.

| Dependency group | Minimum patched version | Result |
| --- | --- | --- |
| js-yaml | 4.3.2 | Updated 4.3.1 -> 4.3.2 in 2.1.4; all checks pass; six affected packages remain |
| fast-uri | 3.1.6 | Updated 3.1.5 -> 3.1.7 in 2.1.5; all checks pass; five affected packages remain |
| baseline-browser-mapping | 2.11.0 | Updated 2.10.30 -> 2.11.23 in 2.1.6; all checks pass; four affected packages remain |
| browserslist | 4.28.7 | Pending |
| postcss-selector-parser | 6.1.3 | Pending |
| vitest and @vitest/mocker | 4.1.11 | Pending |

For completed rows, "all checks pass" means `npm ci`, lint, typecheck, all 176
tests, and production build on Node 26.8.2/npm 12.0.2. Remaining package counts
come from a fresh full `npm audit` after that slice.

Completion requires all of the following on the final dependency tree:

- `npm ci` succeeds from the committed lockfile.
- `npm audit --audit-level=low` and the existing production audit both report
  zero vulnerabilities, including development/optional dependencies.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- GitHub CI passes on Node 24 and 26, and the dispatched Audit workflow passes.
- The GitHub Dependabot API reports zero open alerts after its dependency graph
  refresh; no alert is dismissed to satisfy this requirement.
- Both remotes contain the verified fixes and the repository record is current.

Live qBittorrent and deployment are not automated audit/test entry points and
will not be invoked as part of these dependency fixes. The referenced
`.agents/repo-map.json` is absent from this checkout and Git; the explicit
Verification commands in `.agents/repo-guidance.md` match CI and are the verified
entry points used here.

## Development dependency evidence at scope expansion

After publication, the GitHub Dependabot API reported 10 open alerts, all marked
development scope. These were outside the production audit that failed. As of
2026-09-14:

- High: js-yaml (#50), browserslist (#41), fast-uri (#35, #36, #38, #39).
- Medium: baseline-browser-mapping (#49), vitest (#45), @vitest/mocker (#44).
- Low: postcss-selector-parser (#34).

Source: [repository Dependabot alerts](https://github.com/roethlar/qbit-mobile/security/dependabot).
The expanded scope above now covers remediation of these development dependencies.
