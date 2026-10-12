# October 2026 dependency audit remediation

Status: Fixed locally, 2026-10-12; publication awaits owner push approval.
Scope authorized by the owner's instruction "GH audit failures. fix."

## Evidence

- [Failed Audit run](https://github.com/roethlar/qbit-mobile/actions/runs/38277717132)
  on 2026-10-12 (and the prior weekly run 37333708890) failed against `e6c16c2`
  (2.1.9). Local HEAD and origin/main matched `e6c16c2` by `git ls-remote`.
  The September 2026 remediation left zero findings on the same commit; the
  failure comes from advisories published since.
- `npm audit --omit=dev --audit-level=high` reproduces the failure locally on
  Node 26.11.1 / npm 11.20.0 with four production findings:

| Package | Installed | Severity | Path | Patched in |
| --- | --- | --- | --- | --- |
| proxy-addr | 2.0.7 | critical | express 5.2.1 (`^2.0.7`) | 2.0.8 |
| axios | 1.18.1 | high | direct (`^1.18.1`) | 1.20.0 |
| multer | 2.3.0 | moderate | direct (`^2.3.0`) | 2.4.0 |
| ip-address | 10.5.0 | moderate | express-rate-limit 8.5.2 (`^10.2.0`) | 10.7.4 |

- Only proxy-addr and axios trip the `--audit-level=high` gate; multer and
  ip-address are remediated too so the production audit returns to zero, the
  standard set by the September remediation. Dependabot has open PRs for
  multer (#17) and ip-address (#18) only.
- Applicability to this app, checked against current server code:
  - proxy-addr GHSA-jqcg-44mw-7w3h: spoofed `req.ip` when the trust subnet is
    an IPv4-mapped IPv6 CIDR with a short prefix. `server/server.js` passes
    `TRUST_PROXY` straight to Express, so an operator could hit the
    misconfiguration; the fix closes it regardless of notation.
  - axios (12 advisories, GHSA-vh66-26gq-q6x8 et al.): the server calls
    `axios({...})` with the default Node HTTP adapter in `server/qbClient.js`
    toward the configured qBittorrent host. Prototype-pollution gadgets,
    header injection, and ReDoS fixes all apply to that path.
  - multer GHSA-3pph-fpjx-jg34: orphaned `diskStorage` writes on aborted
    uploads. The app uses memory storage (`server/routes/torrents.js`), so the
    defect does not match its configuration; upgraded for a clean audit.
  - ip-address (4 advisories): used by express-rate-limit for IPv6 subnet
    classification of client IPs; the trust-boundary fixes apply to rate
    limiting.
- Every patched version satisfies the existing dependency ranges; no major
  version or new option is required. Multer 2.4.0 drops its `concat-stream`
  dependency; axios 1.20.0 needs form-data `^4.0.6`, already installed.

## Implementation

One finding per commit, in severity order, each with a patch bump per the
versioning rule in `.agents/repo-guidance.md`:

1. proxy-addr 2.0.7 -> 2.0.8 (lockfile only), app 2.1.10.
2. axios 1.18.1 -> 1.20.0 (direct requirement and lockfile), app 2.1.11.
3. multer 2.3.0 -> 2.4.0 (direct requirement and lockfile), app 2.1.12.
4. ip-address 10.5.0 -> 10.7.4 (lockfile only), app 2.1.13.

No application code, test, or CI gate changes. Auth gate, proxy allowlists,
and the audit workflow are untouched. Existing tests cover the upload path,
the qBittorrent client, and rate limiting; no new test is needed for upstream
dependency fixes.

## Verification and publication

For each slice: inspect the lockfile diff, then run `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, and
`npm audit --omit=dev --audit-level=high`. At the end, `npm ci` from the
final lockfile and require zero production vulnerabilities. Live qBittorrent
and deployment checks are outside this remediation.

Push requires owner approval under `.agents/push-policy.md`. After approval,
push both remotes, dispatch the Audit workflow, and verify that it and the
Node 24/26 CI matrix pass.

## Results

(Recorded per slice as it lands.)

- proxy-addr slice (2.1.10): proxy-addr 2.0.7 -> 2.0.8 in the lockfile only;
  no other package changed. On Node 26.11.1/npm 11.20.0, `npm ci`, lint,
  typecheck, all 176 tests in 13 files, and build passed. Production audit now
  reports 3 findings (1 high, 2 moderate); the critical finding is gone.
- axios slice (2.1.11): axios 1.18.1 -> 1.20.0, requirement `^1.20.0`; the
  only other lockfile change is axios's own form-data range (`^4.0.6`, already
  installed). Lint, typecheck, all 176 tests, and build passed. Production
  audit at the high threshold now exits zero; 2 moderate findings remain.
- multer slice (2.1.12): multer 2.3.0 -> 2.4.0, requirement `^2.4.0`. Multer
  2.4.0 no longer depends on concat-stream, so concat-stream, readable-stream,
  safe-buffer, string_decoder, and typedarray left the lockfile and buffer-from
  and util-deprecate became dev-only. Lint, typecheck, all 176 tests, and build
  passed. Production audit: 1 moderate finding (ip-address) remains.
- ip-address slice (2.1.13): ip-address 10.5.0 -> 10.7.4 in the lockfile only;
  no other package changed. Lint, typecheck, all 176 tests, and build passed.
  Production audit: zero vulnerabilities.

## Completion evidence (local)

Verified 2026-10-12 against 2.1.13 on Node 26.11.1 / npm 11.20.0:

- `npm ci` from the final lockfile succeeds.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities, exit 0.
  This is the exact command the GitHub Audit workflow runs.
- `npm ls axios multer proxy-addr ip-address` confirms 1.20.0, 2.4.0, 2.0.8,
  and 10.7.4; each is the sole installed copy.
- `npm run lint`, `npm run typecheck`, `npm test` (176 tests, 13 files, both
  Vitest projects), and `npm run build` all exit 0 on the final tree.
- `git diff --check` clean. No application code, tests, or CI gates changed.
- Not yet pushed: origin/main and github/main still at `e6c16c2` (2.1.9).
  Push, Audit dispatch, and CI matrix verification await owner approval.
- No deployment or live qBittorrent check was performed. The pre-existing
  untracked `.agents/machines.md` and `.agents/plans/repo-review-fixes-2026-07.md`
  were left untouched.

## Out of scope: development dependency findings

The full `npm audit --audit-level=low` (dev dependencies included) reports
10 findings (7 high, 3 moderate), none reaching a deployed user and none
checked by the GitHub Audit workflow. They were not touched because the
owner's instruction named the GitHub audit failures:

- Fixable within current ranges via `npm audit fix`: brace-expansion
  (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p),
  fast-uri (GHSA-hrr3-gc8f-f4qj), source-map-js (GHSA-68fv-2mgg-jv7q).
- Fixable only by upgrading tailwindcss 3.4.x -> 4.x (semver major, a build
  and config migration): braces (GHSA-vfj7-8cjw-p6xm) via chokidar, micromatch,
  fast-glob; and postcss-selector-parser (GHSA-rj75-hqrm-r3gf) via
  postcss-nested. These sit under Tailwind 3's locked ranges.

Owner decision needed on whether to (a) apply the in-range dev fixes now,
(b) also schedule the Tailwind 4 migration, or (c) leave dev findings to the
Dependabot cadence. Recommendation: (a) now as patch slices; (b) as its own
planned change.
