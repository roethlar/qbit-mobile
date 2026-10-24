# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses semantic-ish
versioning: patch for fixes and dependency bumps, minor for new user-visible capability,
major for breaking changes to deployment, configuration, or the app's contract.

## [2.1.22] - 2026-10-23

A security release covering everything since 2.0.0 (versions 2.0.1 through 2.1.22,
which were not released separately). It is led by the October 2026 Node.js security
release. **Operators must upgrade the host Node.js to 24.22.1 or newer (26.12.1 or
newer on the Node 26 line) and restart the service.** No `.env` keys were added,
removed, or renamed.

### Security

- **The Node.js floor is now 24.22.1, the patched release for the October 2026
  Node.js security release (CVE-2026-111497, a Brotli decoder RCE).** `engines.node`
  is `>=24.22.1`, and all three deploy scripts now compare major.minor.patch, so they
  refuse an unpatched build such as 24.22.0 instead of checking major.minor only. The
  check is a plain `>=` on the Node 24 line, so it cannot tell a patched Node 26 from
  an unpatched one: on Node 26, run 26.12.1 or newer. The fix itself lives in the
  Node runtime, so a running service stays exposed until its host Node is upgraded
  and the service restarted.
- **Compressed request bodies are refused with `415` (CVE-2026-111497).** The JSON
  and form body parsers run before rate limiting and auth, and previously
  decompressed `Content-Encoding: gzip`, `deflate`, and `br` bodies, so any client
  that could reach the port could reach the runtime's Brotli decoder without
  credentials. Both parsers now set `inflate: false`. The UI never compresses
  request bodies; only a custom API client that does is affected.
- **Production dependency advisories patched:**
  - `proxy-addr` 2.0.8 (critical, GHSA-jqcg-44mw-7w3h): a `TRUST_PROXY` subnet
    written as a short-prefix IPv4-mapped IPv6 CIDR could let a client spoof
    `req.ip`.
  - `axios` 1.20.0 (high, 12 advisories including prototype-pollution gadgets,
    header injection, and ReDoS), on the path the proxy uses to reach qBittorrent.
  - `follow-redirects` 1.16.1 (high, GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c):
    credential-stripping bypasses on redirect, via axios.
  - `body-parser` 2.4.0 (high, GHSA-27r3-jxmh-p828): a compressed-body DoS, already
    unreachable here because of `inflate: false`.
  - `multer` 2.3.0, 2.4.0, and 2.5.0 (high and moderate): field-parsing
    denial-of-service fixes, plus two defects (orphaned disk writes, a pending
    `fileFilter` at teardown) whose preconditions this app's memory-storage, no-filter
    configuration does not meet.
  - `ip-address` 10.5.0 and 10.7.4 (high and moderate), via `express-rate-limit`:
    IPv6 classification and subnet fixes that apply to rate limiting.
  - `qs` 6.16.0 (moderate, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g), via Express.
- **Build and test toolchain advisories patched** (none of these run in the deployed
  server): `vite` 8.3.5 with `source-map-js` 1.2.2, `brace-expansion`, `vitest`
  4.1.11 then 4.1.12, `fast-uri` 3.1.7 then 3.1.9, `serialize-javascript` 7.1.4,
  `js-yaml` 4.3.2, `baseline-browser-mapping`, `browserslist`, and
  `postcss-selector-parser` 6.1.4. Vite builds the shipped bundle; its only visible
  output change is that the inline `<style>` in `index.html` is now minified and
  drops the `-moz-user-select` prefix.

### Added

- **The Add Torrent sheet's Save Path offers the same location presets as the Move
  sheet**, so a new torrent can land in the right place without typing the path or
  moving it afterwards.

### Changed

- **Multipart torrent uploads reject field names with array indices above zero** (for
  example `name[1]`) with `400` before parsing, closing an oversized sparse-array
  denial of service. The UI sends flat field names; only a custom API client that
  sends indexed fields is affected.

### Fixed

- **Typing inside a bottom sheet no longer loses focus.** Each keystroke re-ran the
  sheet's open effect and refocused its container, so only the first character
  typed into a field such as Add Torrent's Save Path landed.

### Notes

- The production dependency audit reports zero vulnerabilities. The full audit,
  including development dependencies, still reports three moderate findings for
  `postcss-selector-parser` (GHSA-rj75-hqrm-r3gf) under Tailwind CSS 3; the only fix
  is the Tailwind 4 migration, planned separately.
- Verified by lint, typecheck, 181 tests, and the production build on Node 26.12.1,
  and by GitHub CI on Node 24 and 26 plus the Audit workflow. The deploy scripts and
  a live qBittorrent check were not run for this release.

## [2.0.0] - 2026-07-27

### Changed

- **Node.js 24 is now the minimum supported runtime.** CI exercises Node 24 and 26,
  and all three deployment scripts enforce the same floor from `package.json`.
  Deployments still running Node 22 must upgrade Node before upgrading qBit Mobile.
- **`axios` bumped to 1.18.1** in response to the weekly production audit.

### Fixed — macOS and Windows deploy (`deploy-macos.sh`, `deploy.ps1`)

- **The `deploy.sh` hardening from 1.6.6 now covers macOS and Windows too.** Both
  scripts read the Node floor from `package.json`, stage exactly the files git tracks,
  build in a staging directory and swap it into place only after the build succeeds,
  carry `.env` and `data/` across, and roll back to the previous tree when the new one
  fails its health check. Like `deploy.sh`, they refuse to run outside a git
  checkout. The uninstallers also clean up any staging residue an interrupted deploy
  leaves.
- The macOS script was verified with real installs, upgrades, a forced build failure,
  and a forced rollback. The Windows script parses cleanly and its staging step was
  exercised, but its Scheduled Task swap, rollback, and `.env` permissions step have
  not yet been run on Windows.

## [1.6.6] - 2026-07-10

A dependency, supply-chain, and deploy-safety release. No breaking changes to
configuration or the app's contract. Deployed and verified against a live qBittorrent
instance on Linux.

### Added

- The running version is shown in the app header, with the full build id (commit +
  build timestamp) on hover, so you can tell exactly which build a browser is running —
  including catching a stale PWA cache after an upgrade.

### Changed

- **Express upgraded from 4.x to 5.2.1.** The migration surface was small — every proxy
  route is a literal path — and the endpoint allowlist, fail-closed auth gate, and
  add-torrent field allowlist all pass unchanged. The one breaking site, the SPA
  fallback route, was fixed first and is now covered by tests.
- **`multer` bumped to 2.2.0**, clearing two high-severity denial-of-service advisories.
- **CI now tests Node 22 and 24** (24 is Active LTS) instead of Node 22 alone, and uses
  `actions/checkout@v7` / `actions/setup-node@v6` ahead of GitHub's Node 20 runner
  removal.
- **The dependency audit no longer blocks unrelated pushes.** `npm audit` moved to its
  own weekly workflow, and Dependabot now opens fix PRs for production dependencies, dev
  dependencies, and the workflow actions themselves. A newly disclosed advisory arrives
  as its own PR instead of turning a stranger's commit red.

### Fixed — Linux deploy (`deploy.sh`)

- **Upgrades are now atomic.** The new build is staged and swapped into place only after
  it builds successfully; a failed deploy leaves the running install untouched and rolls
  back automatically. Previously a failed build left a half-updated install.
- **The install tree is now exactly the files git tracks** (`git ls-files`), replacing a
  hand-maintained copy list that had silently drifted. An intermediate exclude-list
  approach was tried and reverted because it can leak untracked secrets (`.env.local`,
  `.env.production`) into the install directory.
- **`npm ci` no longer falls back to `npm install`.** The fallback could deploy a
  dependency tree that was never tested or audited; a lockfile mismatch now stops the
  deploy.
- The supported Node floor is read from `package.json` `engines.node` rather than
  restated as a literal, so it can no longer drift out of sync.

### Notes

- macOS (`deploy-macos.sh`) and Windows (`deploy.ps1`) deployment is unchanged in this
  release. The same hardening is specced for those platforms and will land once tested
  on real machines.
- After upgrading, hard-refresh the PWA once if the header still shows the old version —
  the browser may be serving a cached bundle until the service worker updates.

## [1.5.2] and earlier

See the Git history and the GitHub releases page.

[1.6.6]: https://github.com/roethlar/qbit-mobile/releases/tag/v1.6.6
[2.0.0]: https://github.com/roethlar/qbit-mobile/compare/v1.6.6...v2.0.0
[2.1.22]: https://github.com/roethlar/qbit-mobile/compare/v1.5.2...v2.1.22
