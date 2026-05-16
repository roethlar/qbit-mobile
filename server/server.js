#!/usr/bin/env node

import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  makeQbRequest,
  initialLogin,
  getQbApiCapabilities,
  qbHost,
  qbPort,
} from './qbClient.js';
import torrentsRouter from './routes/torrents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- App auth -------------------------------------------------------------
//
// AUTH_MODE=basic (default): HTTP Basic auth on /api/*.
// AUTH_MODE=disabled: no app auth. Intended for trusted-LAN deployments
// where the user accepts that anyone on the network can drive qBittorrent.
const AUTH_MODE = (process.env.AUTH_MODE || 'basic').toLowerCase();
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';

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
    const response = await makeQbRequest(
      'POST',
      rewritePostPath(qbPath),
      data,
      headers,
    );
    res.status(response.status).send(response.data);
  } catch (error) {
    forwardError(res, error, `POST ${qbPath}`);
  }
}

// Read endpoints
app.get('/api/v2/torrents/info', (req, res) => proxyGet(req, res, '/torrents/info'));
app.get('/api/v2/transfer/info', (req, res) => proxyGet(req, res, '/transfer/info'));
app.get('/api/v2/app/preferences', (req, res) => proxyGet(req, res, '/app/preferences'));
app.get('/api/v2/app/version', (req, res) => proxyGet(req, res, '/app/version'));
app.get('/api/v2/app/webapiVersion', (req, res) => proxyGet(req, res, '/app/webapiVersion'));

// Torrent state changes
app.post('/api/v2/torrents/stop', (req, res) => proxyFormPost(req, res, '/torrents/stop'));
app.post('/api/v2/torrents/start', (req, res) => proxyFormPost(req, res, '/torrents/start'));
app.post('/api/v2/torrents/delete', (req, res) => proxyFormPost(req, res, '/torrents/delete'));

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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

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
