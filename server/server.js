#!/usr/bin/env node

import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  makeQbRequest,
  initialLogin,
  getQbApiCapabilities,
  confirmLegacyMode,
  qbHost,
  qbPort,
} from './qbClient.js';
import torrentsRouter from './routes/torrents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- App auth -------------------------------------------------------------
//
// AUTH_MODE=basic (default): HTTP Basic auth on /api/*.
// AUTH_MODE=disabled: no app auth. Intended for trusted-LAN deployments
// where the user accepts that anyone on the network can drive qBittorrent.
const VALID_AUTH_MODES = new Set(['basic', 'disabled']);
const AUTH_MODE = (process.env.AUTH_MODE || 'basic').toLowerCase();
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';

if (!VALID_AUTH_MODES.has(AUTH_MODE)) {
  // Fail closed on typos like AUTH_MODE=basci. Without this, an unrecognized
  // value would silently bypass the `AUTH_MODE === 'basic'` check below.
  console.error(
    `[fatal] Unknown AUTH_MODE=${JSON.stringify(process.env.AUTH_MODE)}. ` +
      'Must be one of: basic, disabled.',
  );
  process.exit(1);
}

if (AUTH_MODE === 'basic' && (!APP_USERNAME || !APP_PASSWORD)) {
  console.error(
    '[fatal] AUTH_MODE=basic but APP_USERNAME or APP_PASSWORD is empty. ' +
      'Set both in .env, or set AUTH_MODE=disabled to expose the server ' +
      'without auth (only safe on trusted networks).',
  );
  process.exit(1);
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still compare against itself so this branch takes a similar amount of
    // time as the equal-length branch — avoids leaking length via timing.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function requireBasicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="qBit Mobile", charset="UTF-8"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return res.status(400).json({ error: 'Malformed authorization header' });
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) {
    return res.status(400).json({ error: 'Malformed authorization header' });
  }
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (!safeEqual(user, APP_USERNAME) || !safeEqual(pass, APP_PASSWORD)) {
    res.set('WWW-Authenticate', 'Basic realm="qBit Mobile", charset="UTF-8"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  next();
}

// --- CORS / CSRF ----------------------------------------------------------
const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

function isSameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const sameOrigin = isSameOriginRequest(req);
  const isAllowedCrossOrigin = !!allowedOrigin && origin === allowedOrigin;

  if (isAllowedCrossOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(sameOrigin || isAllowedCrossOrigin ? 200 : 403);
  }

  if (!SAFE_METHODS.has(req.method) && !sameOrigin && !isAllowedCrossOrigin) {
    return res.status(403).json({ error: 'Cross-origin request not allowed' });
  }

  next();
});

if (AUTH_MODE === 'basic') {
  app.use('/api', requireBasicAuth);
}

// --- qBittorrent proxy ----------------------------------------------------
//
// We don't forward /api/v2/* verbatim — that would expose the entire
// qBittorrent admin API (autorun_program -> RCE, setLocation -> arbitrary
// path writes, /app/shutdown, etc.) to anyone who passes the auth gate.
// Only the endpoints below are reachable through this proxy.
const ALLOWED_SET_PREF_KEYS = new Set([
  'dl_limit',
  'up_limit',
  'save_path',
  'add_stopped_enabled',
]);

function rewritePostPath(p) {
  const caps = getQbApiCapabilities();
  if (!caps.legacy) return p;
  if (p === '/torrents/stop') return '/torrents/pause';
  if (p === '/torrents/start') return '/torrents/resume';
  return p;
}

// Inverse of rewritePostPath: given a qB5 path, return the qB4 alias if any.
// Used by the 404-fallback retry — covers the race where the very first
// request lands before the async capability probe finishes.
function legacyAliasOf(p) {
  if (p === '/torrents/stop') return '/torrents/pause';
  if (p === '/torrents/start') return '/torrents/resume';
  return null;
}

function forwardError(res, error, label) {
  if (error.response) {
    console.error(
      `[proxy] ${label} -> upstream ${error.response.status}: ${error.message}`,
    );
    res.status(error.response.status).send(error.response.data);
  } else {
    console.error(
      `[proxy] ${label} -> ${error.code || 'error'}: ${error.message}`,
    );
    res.status(502).json({ error: 'Upstream unavailable' });
  }
}

async function proxyGet(req, res, qbPath) {
  try {
    const response = await makeQbRequest('GET', qbPath, undefined, {});
    res.status(response.status).send(response.data);
  } catch (error) {
    forwardError(res, error, `GET ${qbPath}`);
  }
}

async function proxyFormPost(req, res, qbPath) {
  try {
    let data = req.body;
    if (data && typeof data === 'object' && !(data instanceof URLSearchParams)) {
      data = new URLSearchParams(data).toString();
    }
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const primaryPath = rewritePostPath(qbPath);
    let response = await makeQbRequest('POST', primaryPath, data, headers);

    // qB4 returns 404 on /torrents/stop and /torrents/start because those
    // endpoints don't exist on the older API. If we hit that while still
    // assuming a modern upstream, try the legacy alias and remember the
    // result so future requests route correctly without the round-trip.
    if (response.status === 404) {
      const alias = legacyAliasOf(qbPath);
      if (alias && primaryPath !== alias) {
        console.warn(`[proxy] POST ${qbPath} -> 404; retrying as ${alias}`);
        response = await makeQbRequest('POST', alias, data, headers);
        if (response.status >= 200 && response.status < 300) {
          confirmLegacyMode();
        }
      }
    }

    res.status(response.status).send(response.data);
  } catch (error) {
    forwardError(res, error, `POST ${qbPath}`);
  }
}

// qBittorrent accepts hashes as a "|"-separated list of 40-char (SHA-1) or
// 64-char (BitTorrent v2) hex strings, plus the literal "all" for mass ops.
// We require an explicit list — "all" is rejected so a buggy or compromised
// client can't accidentally wipe every torrent through /torrents/delete.
const HASH_RE = /^[a-f0-9]{40}([a-f0-9]{24})?$/i;
function validateHashes(req, res, { allowAll }) {
  const hashes = req.body && req.body.hashes;
  if (typeof hashes !== 'string' || hashes.length === 0) {
    res.status(400).json({ error: 'Missing or invalid "hashes" field' });
    return false;
  }
  if (hashes === 'all') {
    if (allowAll) return true;
    res.status(400).json({ error: 'Bulk "hashes=all" not permitted on this endpoint' });
    return false;
  }
  const parts = hashes.split('|');
  if (parts.length > 200) {
    res.status(400).json({ error: 'Too many hashes in a single request' });
    return false;
  }
  for (const part of parts) {
    if (!HASH_RE.test(part)) {
      res.status(400).json({ error: 'Malformed hash in "hashes" field' });
      return false;
    }
  }
  return true;
}

// Per-torrent GETs take a single hash in the query string. We forward only
// that one validated param so callers can't slip extra query keys past us.
function takeHashQuery(req, res) {
  const hash = req.query && req.query.hash;
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) {
    res.status(400).json({ error: 'Missing or invalid "hash" query param' });
    return null;
  }
  return hash;
}

// Read endpoints (no per-torrent params)
app.get('/api/v2/torrents/info', (req, res) => proxyGet(req, res, '/torrents/info'));
app.get('/api/v2/transfer/info', (req, res) => proxyGet(req, res, '/transfer/info'));
app.get('/api/v2/app/preferences', (req, res) => proxyGet(req, res, '/app/preferences'));
app.get('/api/v2/app/version', (req, res) => proxyGet(req, res, '/app/version'));
app.get('/api/v2/app/webapiVersion', (req, res) => proxyGet(req, res, '/app/webapiVersion'));

// Per-torrent detail reads
app.get('/api/v2/torrents/properties', (req, res) => {
  const hash = takeHashQuery(req, res);
  if (!hash) return;
  proxyGet(req, res, `/torrents/properties?hash=${encodeURIComponent(hash)}`);
});
app.get('/api/v2/torrents/files', (req, res) => {
  const hash = takeHashQuery(req, res);
  if (!hash) return;
  proxyGet(req, res, `/torrents/files?hash=${encodeURIComponent(hash)}`);
});
app.get('/api/v2/torrents/trackers', (req, res) => {
  const hash = takeHashQuery(req, res);
  if (!hash) return;
  proxyGet(req, res, `/torrents/trackers?hash=${encodeURIComponent(hash)}`);
});

// Torrent state changes. stop/start tolerate hashes=all (non-destructive
// bulk ops are a legitimate use case); delete does not.
app.post('/api/v2/torrents/stop', (req, res) => {
  if (!validateHashes(req, res, { allowAll: true })) return;
  proxyFormPost(req, res, '/torrents/stop');
});
app.post('/api/v2/torrents/start', (req, res) => {
  if (!validateHashes(req, res, { allowAll: true })) return;
  proxyFormPost(req, res, '/torrents/start');
});
app.post('/api/v2/torrents/delete', (req, res) => {
  if (!validateHashes(req, res, { allowAll: false })) return;
  proxyFormPost(req, res, '/torrents/delete');
});
app.post('/api/v2/torrents/recheck', (req, res) => {
  if (!validateHashes(req, res, { allowAll: false })) return;
  proxyFormPost(req, res, '/torrents/recheck');
});
app.post('/api/v2/torrents/reannounce', (req, res) => {
  if (!validateHashes(req, res, { allowAll: false })) return;
  proxyFormPost(req, res, '/torrents/reannounce');
});

// Torrent upload (multipart) — handled by dedicated router.
app.use('/api/v2', torrentsRouter);

// Preferences — narrow to known-safe keys and translate qB5 names to qB4.
app.post('/api/v2/app/setPreferences', async (req, res) => {
  const jsonRaw = req.body && req.body.json;
  if (typeof jsonRaw !== 'string') {
    return res.status(400).json({ error: 'Expected URL-encoded "json" field' });
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonRaw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON in "json" field' });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return res.status(400).json({ error: 'Expected JSON object' });
  }
  const filtered = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (ALLOWED_SET_PREF_KEYS.has(key)) filtered[key] = value;
  }
  const caps = getQbApiCapabilities();
  if (caps.legacy && 'add_stopped_enabled' in filtered) {
    filtered.start_paused_enabled = filtered.add_stopped_enabled;
    delete filtered.add_stopped_enabled;
  }
  if (Object.keys(filtered).length === 0) {
    return res.status(400).json({ error: 'No allowed preference keys present' });
  }
  try {
    const data = new URLSearchParams({ json: JSON.stringify(filtered) }).toString();
    const response = await makeQbRequest(
      'POST',
      '/app/setPreferences',
      data,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    );
    res.status(response.status).send(response.data);
  } catch (error) {
    forwardError(res, error, 'POST /app/setPreferences');
  }
});

// Unmatched API routes return JSON 404, not the SPA shell.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// --- Static SPA -----------------------------------------------------------
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`Serving frontend from ${distPath}`);
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function start() {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  const server = app.listen(PORT, HOST, async () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Proxying to qBittorrent at ${qbHost}:${qbPort}`);
    console.log(`App auth mode: ${AUTH_MODE}`);

    if (AUTH_MODE !== 'basic' && !LOOPBACK_HOSTS.has(HOST)) {
      console.warn('');
      console.warn('  *********************************************************');
      console.warn('  *  WARNING: AUTH_MODE is not "basic" and HOST is bound   *');
      console.warn('  *  to a non-loopback interface. Anyone on the network    *');
      console.warn('  *  can drive qBittorrent through this server.            *');
      console.warn('  *  Only safe on a fully trusted LAN.                     *');
      console.warn('  *********************************************************');
      console.warn('');
    }

    try {
      await initialLogin();
    } catch (error) {
      console.log('Initial qBittorrent login skipped:', error.message);
    }
  });

  server.requestTimeout = 60_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 61_000;

  return server;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1] === pathToFileURL(fileURLToPath(import.meta.url)).pathname;
if (isMainModule) start();
