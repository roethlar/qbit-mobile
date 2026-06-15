// Screenshot harness for the README gallery.
//
// Boots the Vite dev server, drives the PWA with a headless Chromium, and
// fulfils every /api request with the fixtures in fixtures.mjs — so the app
// renders representative state with no live qBittorrent, no credentials, and
// no real torrents. Captures each entry in `shots` to docs/screenshots/, then
// composites a single hero-tour.png (the image the README embeds).
//
//   npm run screenshots
//
// Runs fully headless (CI / a server with no display is fine). Requires the
// Chromium build Playwright manages: `npx playwright install chromium`.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import * as fx from './fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const outDir = path.join(root, 'docs', 'screenshots');

// Dedicated port so the harness never collides with a dev server already
// running on the project's default (3000).
const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;

// 2x for the phone shots (crisp on retina READMEs); 1x for desktop so the
// wide captures don't balloon in file size.
const MOBILE = { width: 402, height: 874, dsf: 2 };
const DESKTOP = { width: 1366, height: 820, dsf: 1 };

const P = fx.populatedTorrents;
const E = fx.emptyTorrents;

// screen: which surface to capture. data: torrent list backing it.
const shots = [
  { name: 'dashboard-mobile-light', screen: 'dashboard', data: P, theme: 'light', viewport: MOBILE },
  { name: 'dashboard-mobile-dark', screen: 'dashboard', data: P, theme: 'dark', viewport: MOBILE },
  { name: 'dashboard-desktop-light', screen: 'dashboard', data: P, theme: 'light', viewport: DESKTOP },
  { name: 'dashboard-desktop-dark', screen: 'dashboard', data: P, theme: 'dark', viewport: DESKTOP },
  { name: 'empty-mobile-light', screen: 'dashboard', data: E, theme: 'light', viewport: MOBILE },
  { name: 'empty-desktop-light', screen: 'dashboard', data: E, theme: 'light', viewport: DESKTOP },
  { name: 'detail-mobile-light', screen: 'detail', data: P, theme: 'light', viewport: MOBILE },
  { name: 'detail-mobile-dark', screen: 'detail', data: P, theme: 'dark', viewport: MOBILE },
  { name: 'add-mobile-light', screen: 'add', data: P, theme: 'light', viewport: MOBILE },
  { name: 'settings-mobile-light', screen: 'settings', data: P, theme: 'light', viewport: MOBILE },
  { name: 'settings-mobile-dark', screen: 'settings', data: P, theme: 'dark', viewport: MOBILE },
  // A tapped-open row showing the inline expanded detail (stats + actions).
  { name: 'row-expanded-mobile-light', screen: 'expanded', data: P, theme: 'light', viewport: MOBILE, target: 'linuxmint-22-cinnamon-64bit.iso' },
  { name: 'row-expanded-mobile-dark', screen: 'expanded', data: P, theme: 'dark', viewport: MOBILE, target: 'linuxmint-22-cinnamon-64bit.iso' },
  // Mid-swipe reveals — held with a synthetic touch drag (see capture()).
  { name: 'row-swipe-move-mobile-light', screen: 'swipe', direction: 'move', data: P, theme: 'light', viewport: MOBILE, target: 'debian-12.8.0-amd64-netinst.iso' },
  { name: 'row-swipe-delete-mobile-light', screen: 'swipe', direction: 'delete', data: P, theme: 'light', viewport: MOBILE, target: 'archlinux-2025.06.01-x86_64.iso' },
  // Dark variants of the shots above that were light-only, so the gallery can
  // run dark-by-default with just the home screen shown in light.
  { name: 'add-mobile-dark', screen: 'add', data: P, theme: 'dark', viewport: MOBILE },
  { name: 'empty-mobile-dark', screen: 'dashboard', data: E, theme: 'dark', viewport: MOBILE },
  { name: 'row-swipe-move-mobile-dark', screen: 'swipe', direction: 'move', data: P, theme: 'dark', viewport: MOBILE, target: 'debian-12.8.0-amd64-netinst.iso' },
  { name: 'row-swipe-delete-mobile-dark', screen: 'swipe', direction: 'delete', data: P, theme: 'dark', viewport: MOBILE, target: 'archlinux-2025.06.01-x86_64.iso' },
];

/** Fulfil the app's API surface from fixtures for one browser context. */
async function mockApi(context, torrents, stats) {
  await context.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (data) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

    if (p.endsWith('/api/v2/torrents/info')) return json(torrents);
    if (p.endsWith('/api/v2/transfer/info')) return json(stats);
    if (p.endsWith('/api/v2/app/preferences')) return json(fx.preferences);
    if (p.endsWith('/api/v2/torrents/properties')) return json(fx.torrentProperties);
    if (p.endsWith('/api/v2/torrents/files')) return json(fx.torrentFiles);
    if (p.endsWith('/api/v2/torrents/trackers')) return json(fx.torrentTrackers);
    if (p.endsWith('/api/locations')) return json({ locations: fx.locationPresets });
    // Everything else (mutations: add/start/stop/delete/recheck/reannounce/
    // setLocation/setPreferences) just succeeds.
    return json({});
  });
}

async function capture(browser, shot) {
  const context = await browser.newContext({
    viewport: { width: shot.viewport.width, height: shot.viewport.height },
    deviceScaleFactor: shot.viewport.dsf,
    colorScheme: shot.theme,
    reducedMotion: 'reduce',
    // The swipe gesture is touch-driven; enable touch so synthetic touch
    // events can be dispatched (see the 'swipe' branch).
    hasTouch: shot.screen === 'swipe',
  });
  // The app reads its theme from localStorage on mount; seed it before any
  // page script runs so there's no light->dark flash to race.
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* storage unavailable — colorScheme emulation still covers it */
    }
  }, shot.theme);
  // A populated install transfers data; an empty one is idle.
  await mockApi(context, shot.data, shot.data.length ? fx.globalStats : fx.emptyStats);

  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Wait for first meaningful paint of the dashboard.
  if (shot.data.length > 0) {
    await page.getByText(shot.data[0].name).first().waitFor({ state: 'visible', timeout: 20000 });
  } else {
    await page.getByText('No torrents').waitFor({ state: 'visible', timeout: 20000 });
  }

  // Freeze transitions/animations so nothing is captured mid-flight.
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;animation:none!important;}',
  });

  if (shot.screen === 'settings') {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('heading', { name: 'Speed Limits' }).waitFor({ state: 'visible', timeout: 20000 });
  } else if (shot.screen === 'detail') {
    await page.getByText(shot.data[0].name).first().click(); // expand the row
    await page.getByRole('button', { name: 'Details' }).first().click(); // open full detail
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('tab', { name: 'General' }).waitFor({ state: 'visible' });
  } else if (shot.screen === 'add') {
    await page.getByRole('button', { name: 'Add torrent' }).click();
    await page.getByRole('heading', { name: 'Add Torrent' }).waitFor({ state: 'visible', timeout: 20000 });
  } else if (shot.screen === 'expanded') {
    // Tap the row to expand it inline (stops short of the full-screen detail).
    await page.getByText(shot.target).first().click();
    await page.getByRole('button', { name: 'Details' }).first().waitFor({ state: 'visible', timeout: 20000 });
  } else if (shot.screen === 'swipe') {
    // The reveal only exists while a touch is held mid-drag, so dispatch a
    // touch drag via CDP and screenshot before releasing. Right swipe reveals
    // Move, left swipe reveals Delete.
    const box = await page.getByText(shot.target).first().boundingBox();
    const y = Math.round(box.y + box.height / 2);
    const W = shot.viewport.width;
    const right = shot.direction === 'move';
    const startX = Math.round(W * (right ? 0.3 : 0.7));
    const endX = startX + (right ? 120 : -120);
    const cdp = await context.newCDPSession(page);
    const touch = (type, x) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y }] });
    await touch('touchStart', startX);
    await touch('touchMove', startX + (right ? 12 : -12)); // cross the horizontal-lock threshold
    await touch('touchMove', endX); // hold here; do not touchEnd (that would snap back / commit)
    await page.getByText(shot.direction === 'move' ? 'Move' : 'Delete').first().waitFor({ state: 'visible', timeout: 20000 });
  }

  // Small settle for layout/scroll to come to rest.
  await page.waitForTimeout(400);

  const file = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: file });
  await context.close();
  return file;
}

// Composited README image: a slashed light/dark hero (desktop in a browser
// frame + overlapping phone, each screenshot individually split on a diagonal)
// flowing into a strip of framed phones for the remaining screens. Built from
// the raw shots above so it regenerates with them.
const SECTION_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  .page { background: linear-gradient(180deg, #1d4ed8 0%, #2563eb 32%, #1e2a47 58%, #0f172a 80%); }
  .hero { padding: 70px 80px 96px; }
  .stage { position: relative; max-width: 860px; margin: 0 auto; }
  .browser { border-radius: 12px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,.4); background: #fff; }
  .bar { height: 38px; display: flex; align-items: center; gap: 9px; padding: 0 16px; background: #e9edf1; border-bottom: 1px solid #d7dde3; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .r { background: #ff5f57; } .y { background: #febc2e; } .g { background: #28c840; }
  .url { margin-left: 14px; font-size: 12px; color: #6b7280; background: #fff; border: 1px solid #e1e6ea; border-radius: 7px; padding: 4px 16px; }
  .browser > img { display: block; width: 100%; }
  .split { position: relative; line-height: 0; }
  .split > img { display: block; width: 100%; }
  .split > .dark-layer { position: absolute; top: 0; left: 0; clip-path: polygon(100% 0, 100% 100%, 38% 100%, 62% 0); }
  .phone { position: absolute; right: -34px; bottom: -64px; width: 232px; border: 11px solid #0b0e14; border-radius: 40px; overflow: hidden; background: #0b0e14; box-shadow: 0 28px 56px rgba(0,0,0,.5); }
  .tour { padding: 18px 40px 58px; display: flex; gap: 26px; justify-content: center; align-items: flex-start; }
  .pf { width: 158px; border: 8px solid #000; border-radius: 30px; overflow: hidden; box-shadow: 0 18px 40px rgba(0,0,0,.55); }
  .pf > img { display: block; width: 100%; }
  .cap { text-align: center; color: #94a3b8; font-size: 11.5px; margin-top: 10px; }
`;

function sectionHtml() {
  const f = (name) => `file://${path.join(outDir, name)}`;
  const tile = (name, cap) => `<div><div class="pf"><img src="${f(name)}"></div><div class="cap">${cap}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${SECTION_CSS}</style></head><body>
    <div class="page">
      <div class="hero"><div class="stage">
        <div class="browser">
          <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">qbit.local</span></div>
          <div class="split"><img src="${f('dashboard-desktop-light.png')}"><img class="dark-layer" src="${f('dashboard-desktop-dark.png')}"></div>
        </div>
        <div class="phone"><div class="split"><img src="${f('dashboard-mobile-light.png')}"><img class="dark-layer" src="${f('dashboard-mobile-dark.png')}"></div></div>
      </div></div>
      <div class="tour">
        ${tile('row-expanded-mobile-dark.png', 'Expanded row')}
        ${tile('detail-mobile-dark.png', 'Torrent detail')}
        ${tile('row-swipe-delete-mobile-dark.png', 'Swipe to delete')}
        ${tile('add-mobile-dark.png', 'Add torrent')}
        ${tile('settings-mobile-dark.png', 'Settings')}
      </div>
    </div>
  </body></html>`;
}

// Render the composite from the raw shots into a single README image.
async function composeHeroTour(browser) {
  const htmlPath = path.join(outDir, '_compose.html');
  await writeFile(htmlPath, sectionHtml());
  const context = await browser.newContext({ viewport: { width: 1040, height: 700 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  const file = path.join(outDir, 'hero-tour.png');
  await page.screenshot({ path: file, fullPage: true });
  await context.close();
  await rm(htmlPath, { force: true });
  return file;
}

function startServer() {
  // Run Vite's JS entry directly (portable: avoids the .bin shim differences
  // across platforms). Pin host to loopback and a dedicated strict port.
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  return spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'], {
    cwd: root,
    env: { ...process.env, VITE_DEV_HOST: '127.0.0.1' },
    stdio: 'ignore',
  });
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      /* server not up yet — keep polling */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Dev server did not become ready at ${BASE} within ${timeoutMs}ms`);
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const server = startServer();
  const stop = () => server.kill('SIGTERM');
  process.on('SIGINT', () => {
    stop();
    process.exit(130);
  });

  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();
    for (const shot of shots) {
      const file = await capture(browser, shot);
      console.log(`✓ ${path.relative(root, file)}`);
    }
    const composite = await composeHeroTour(browser);
    console.log(`✓ ${path.relative(root, composite)} (README composite)`);
    console.log(`\nDone. ${shots.length} screenshots + 1 composite written to ${path.relative(root, outDir)}/`);
  } finally {
    if (browser) await browser.close();
    stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
