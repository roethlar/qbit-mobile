import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { makeQbRequest, getQbApiCapabilities } from '../qbClient.js';

const router = Router();

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 25,
    fields: 30,
  },
});

// Only forward fields the UI actually sets. Without this, callers could
// pass arbitrary qBittorrent add-torrent parameters (savepath to anywhere,
// rename, useAutoTMM, etc.) that the UI never exposes.
const ALLOWED_ADD_FIELDS = new Set([
  'urls',
  'savepath',
  'category',
  'stopped',
  'paused',
  'skip_checking',
  'sequentialDownload',
  'firstLastPiecePrio',
  'tags',
]);

const uploadFiles = (req, res, next) => {
  upload.fields([{ name: 'torrents', maxCount: 25 }])(req, res, err => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    return res.status(400).json({ error: err.message || 'Upload failed' });
  });
};

function buildAddFormData(body, files) {
  const formData = new FormData();
  const caps = getQbApiCapabilities();

  for (const [key, rawValue] of Object.entries(body || {})) {
    if (!ALLOWED_ADD_FIELDS.has(key)) continue;
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    // qB5 parses "stopped"; qB4 parses "paused". Map based on detected caps;
    // modern (or unknown) defaults to passing "stopped" through unchanged.
    let outKey = key;
    if (caps.legacy) {
      if (key === 'stopped') outKey = 'paused';
    } else {
      if (key === 'paused') outKey = 'stopped';
    }
    formData.append(outKey, String(value));
  }

  const torrentFiles = (files && files.torrents) || [];
  for (const file of torrentFiles) {
    formData.append('torrents', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype || 'application/x-bittorrent',
    });
  }

  return formData;
}

router.post('/torrents/add', uploadFiles, async (req, res) => {
  try {
    const response = await makeQbRequest('POST', '/torrents/add', () => {
      const fd = buildAddFormData(req.body, req.files);
      return { data: fd, headers: fd.getHeaders() };
    });
    res.status(response.status).send(response.data);
  } catch (error) {
    if (error.response) {
      console.error(
        `[proxy] POST /torrents/add -> upstream ${error.response.status}: ${error.message}`,
      );
      res.status(error.response.status).send(error.response.data);
    } else {
      console.error(
        `[proxy] POST /torrents/add -> ${error.code || 'error'}: ${error.message}`,
      );
      res.status(502).json({ error: 'Upload failed' });
    }
  }
});

// Defense in depth: any future route added to this file must go through
// the validateHashes/takeHashQuery gates in server.js, not slip in here.
// Scoped to /torrents/* so the router doesn't shadow sibling /api/v2/app/*
// endpoints registered after it in server.js.
router.use('/torrents', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));

export default router;
