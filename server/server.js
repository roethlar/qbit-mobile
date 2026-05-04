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

// CORS: only allow same-origin or explicit ALLOWED_ORIGIN env var.
// Wildcard CORS would let any browser-loaded page drive qBittorrent.
const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigin && origin === allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(allowedOrigin && origin === allowedOrigin ? 200 : 403);
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
