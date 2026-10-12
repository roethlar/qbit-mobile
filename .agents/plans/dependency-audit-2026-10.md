# October 2026 dependency audit remediation

Status: In progress (started 2026-10-12).
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
