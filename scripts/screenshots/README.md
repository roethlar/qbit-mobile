# Screenshot harness

Generates the README gallery images under `docs/screenshots/`.

```bash
npm run screenshots
```

## How it works

`capture.mjs` boots the Vite dev server on a dedicated port (4317, loopback
only), drives it with a headless Chromium via Playwright, and **mocks every
`/api` request** with the fixtures in `fixtures.mjs`. No live qBittorrent, no
credentials, and no real torrents are involved — so the output is fully
reproducible. It runs headless and works on a machine with no display (CI / a
server).

Each entry in the `shots` array describes one capture: which screen
(`dashboard` / `detail` / `add` / `settings`), the torrent list backing it
(populated or empty), the theme (`light` / `dark`), and the viewport (mobile or
desktop). Theme is seeded into `localStorage` before page load; transitions are
frozen before each shot so nothing is captured mid-animation.

## First-time setup

Playwright is a dev dependency, but its browser binary is downloaded
separately:

```bash
npm install
npx playwright install chromium
```

On a bare Linux host you may also need the system libraries once:

```bash
npx playwright install-deps
```

## Changing the gallery

- **Different data** (more torrents, other states, different stats): edit
  `fixtures.mjs`.
- **Add/remove a shot**: edit the `shots` array in `capture.mjs`.
- **New screen or different navigation**: extend the per-screen `if` block in
  `capture()` with the clicks/waits needed to reach it.

After editing, rerun `npm run screenshots` and update the `<img>` references in
the root `README.md` if filenames changed.
