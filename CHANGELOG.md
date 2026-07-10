# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses semantic-ish
versioning: patch for fixes and dependency bumps, minor for new user-visible capability,
major for breaking changes to deployment, configuration, or the app's contract.

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
