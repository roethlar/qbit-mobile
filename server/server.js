#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { makeQbRequest, initialLogin, qbHost, qbPort } from './qbClient.js';
import torrentsRouter from './routes/torrents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS + CSRF protection: the proxy injects an authenticated qBittorrent
// cookie on every forwarded request, so we must reject cross-origin writes
// to prevent drive-by attacks from any page the user happens to visit.
//
// Same-origin requests (Origin host matches our Host header, or no Origin)
// are always allowed. ALLOWED_ORIGIN env var may be set to permit one
// additional cross-origin client.
const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

function isSameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // No Origin → not a CORS-eligible request
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
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(sameOrigin || isAllowedCrossOrigin ? 200 : 403);
  }

  // Reject cross-origin state-changing requests. Without this, a foreign
  // page could fire-and-forget a POST and we'd happily proxy it.
  if (!SAFE_METHODS.has(req.method) && !sameOrigin && !isAllowedCrossOrigin) {
    return res.status(403).json({ error: 'Cross-origin request not allowed' });
  }

  next();
});

// Torrent upload route (must come before generic proxy)
app.use('/api/v2', torrentsRouter);

// Proxy all other API requests
app.use('/api/v2', async (req, res) => {
  const reqPath = req.url;

  try {
    let data = undefined;
    let headers = {};

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      data = req.body;
      if (req.is('application/x-www-form-urlencoded')) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        if (typeof data === 'object') {
          data = new URLSearchParams(data).toString();
        }
      } else if (req.is('multipart/form-data')) {
        headers = req.headers;
      }
    }

    const response = await makeQbRequest(req.method, reqPath, data, headers);
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy error' });
    }
  }
});

// Unmatched API routes return JSON 404, not the SPA shell.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve static files if dist folder exists
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

app.listen(PORT, HOST, async () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Proxying to qBittorrent at ${qbHost}:${qbPort}`);

  try {
    await initialLogin();
  } catch (error) {
    console.log('Initial authentication skipped:', error.message);
  }
});
