import { Router } from 'express';
import multer from 'multer';
import { makeQbRequest } from '../qbClient.js';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 25,
    fields: 50,
  },
});

// Wrap multer so its errors (e.g. LIMIT_FILE_SIZE) return a clean JSON
// response instead of falling through to Express' default error handler.
const uploadAny = (req, res, next) => {
  upload.any()(req, res, err => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    return res.status(400).json({ error: err.message || 'Upload failed' });
  });
};

router.post('/torrents/add', uploadAny, async (req, res) => {
  try {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        formData.append(file.fieldname, file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
      });
    }

    const response = await makeQbRequest('POST', '/torrents/add', formData, {
      ...formData.getHeaders()
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Torrent upload error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
});

export default router;
