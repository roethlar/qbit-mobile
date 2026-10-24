# October 2026 dependency audit remediation

Status: First wave (2.1.10-2.1.13) fixed 2026-10-12 and since pushed to
origin. Second wave (2.1.15 onward, below) fixed locally 2026-10-23; push
awaits owner approval. Scope authorized by the owner's instructions "GH audit
failures. fix." (first wave) and "fix and commit everything else you can"
(second wave).

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

## Second wave (2026-10-23)

New advisories published after 2.1.14. Same method as the first wave: one
package per commit, patch bump each, in-range versions only, no `--force`.
Dev-only slices bump too: the Versioning rule in `.agents/repo-guidance.md`
exempts only `.agents/`, docs, tests, and CI commits, and 2.1.4-2.1.9 bumped
dev-only dependency fixes.

| Package | Installed | Severity | Scope | Patched in | Applicability |
| --- | --- | --- | --- | --- | --- |
| body-parser | 2.3.0 | high (GHSA-27r3-jxmh-p828) | prod, via express | 2.4.0 | Not reachable: both parsers set `inflate: false` (2.1.14), which returns 415 before any decompression. Upgraded for a clean audit. |
| follow-redirects | 1.16.0 | high (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c) | prod, via axios | 1.16.1 | Low: axios follows redirects from the configured qBittorrent host, but `server/qbClient.js` sends `Cookie` as a string and sets no `sensitiveHeaders`; both bugs bypass credential stripping only through those inputs. Upgraded regardless. |
| multer | 2.4.0 | high (GHSA-q7qp-rjg7-q26m) | prod, direct | 2.5.0 | Does not match the configuration: the DoS needs an asynchronous `fileFilter` still pending at request teardown, and `server/routes/torrents.js` sets none. 2.5.0 also keeps an error listener on busboy after teardown and stops off-by-one truncation at busboy's default 1MB `fieldSize`; neither changes the app's limits. |
| vite | 8.0.16 | high (GHSA-587h-7wmj-h5pm), moderate (GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-rq7h-c2jc-7f22), low (GHSA-9jrq-w75r-8gcw) | dev, direct | 8.1.6 (`npm audit fix` resolves 8.3.5) | Dev server only (launch-editor, `server.fs.allow`, middleware); `npm run dev` binds loopback by default. Vite builds the shipped bundle, so it bumps the version. |
| source-map-js | 1.2.1 | high (GHSA-68fv-2mgg-jv7q) | dev, via postcss | 1.2.2 | Build-time only. Fixed inside the vite slice: vite 8.3.5 needs postcss `^8.5.30`, and postcss 8.5.31 needs source-map-js `^1.2.2`. |

Verification note (this host): the working tree is checked out with
`core.autocrlf=true`, and a CRLF after the `#!` line of `server/server.js`
makes Vitest's module runner fail to load `proxy.test.js` ("Invalid or
unexpected token"). This reproduces on unmodified 2.1.14 and passes once that
line is LF, so it is environmental, not a dependency regression. CI checks out
LF. Each slice is therefore verified twice: in this tree (proxy suite excepted)
and in an LF clone (`core.autocrlf=false`) after `npm ci`, where all suites run.

Results:

- body-parser slice (2.1.15): body-parser 2.3.0 -> 2.4.0, lockfile only; its
  subtree moved qs 6.16.0 -> 6.16.1 and its nested content-type 2.0.0 -> 2.1.0.
  LF clone: lint, typecheck, 181 tests, build pass.
- follow-redirects slice (2.1.16): follow-redirects 1.16.0 -> 1.16.1,
  lockfile only; no other package changed. LF clone: lint, typecheck, 181
  tests, build pass.
- multer slice (2.1.17): multer 2.4.0 -> 2.5.0, requirement `^2.5.0`; no
  other package changed. LF clone: lint, typecheck, 181 tests, build pass.
  Production audit: zero vulnerabilities.
- vite slice (2.1.18): vite 8.0.16 -> 8.3.5, requirement `^8.3.5`. Its
  subtree moved rolldown 1.0.3 -> 1.2.15 (with @oxc-project/types and the
  platform bindings; the wasm32 binding and its @emnapi/@napi-rs/@tybys/tslib
  deps left the lockfile), lightningcss 1.33.0, picomatch 4.0.7, postcss
  8.5.31, nanoid 3.3.20, and source-map-js 1.2.2, which clears that advisory
  too. Lint, typecheck, 181 tests, build pass in both trees: vite 8.3.5's
  module runner handles the CRLF shebang, so the proxy suite loads in the
  CRLF tree again. The build emits the same file set as 2.1.17; the only
  visible output change is that the inline `<style>` in `index.html` is now
  minified and drops the `-moz-user-select` prefix (assumption: harmless, as
  Firefox has supported unprefixed `user-select` since 69).
