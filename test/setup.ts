import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Test-time defaults. Must be set before any module that reads them at import.
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'basic';
process.env.APP_USERNAME = 'tester';
process.env.APP_PASSWORD = 'testpw';
process.env.QBITTORRENT_HOST = '127.0.0.1';
process.env.QBITTORRENT_PORT = '18080';
// Don't rate-limit tests; the suite makes many calls from a single IP.
process.env.RATE_LIMIT = 'disabled';

// Per-run temp DATA_DIR so the locations test doesn't poke at the developer's
// /opt/qbit-mobile/data (which may not exist) or a colocated ./data.
const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbit-mobile-test-'));
process.env.DATA_DIR = tmpDataDir;

// server.js only registers the static handler and SPA fallback when ./dist
// exists, and CI runs `npm test` before `npm run build`. Without this, the
// SPA route is silently absent under CI while present locally -- the two
// disagree, and the fallback route ships untested. Seed a placeholder shell
// when dist is missing; `vite build` empties the directory afterwards.
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const distIndex = path.join(distDir, 'index.html');
if (!fs.existsSync(distIndex)) {
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(distIndex, '<!doctype html><title>test shell</title>');
}
