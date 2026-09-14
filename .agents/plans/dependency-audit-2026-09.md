# September 2026 dependency audit remediation

Status: Remediated and verified locally, 2026-09-14. Publication awaits approval.
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
- qs slice complete locally as 2.1.3: qs 6.15.2 -> 6.16.0 and its required
  side-channel 1.1.0 -> 1.1.1. No other package versions changed. On Node
  26.8.2/npm 12.0.2, `npm ci`, lint, typecheck, all 176 tests, build, and
  `npm audit --omit=dev --audit-level=high` passed; the audit reports zero
  vulnerabilities. `npm ls multer qs --all` confirms Multer 2.3.0 and one
  deduplicated qs 6.16.0 used by Express, body-parser, and Superagent.
- GitHub rerun, Node 24 verification, and deployment have not been performed.
  Both remote main refs were `2d380ff` at startup; the fixed commits are local
  until publication is approved. Pre-existing untracked `.agents/machines.md`
  and `.agents/plans/repo-review-fixes-2026-07.md` were left untouched.
