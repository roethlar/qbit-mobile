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

router.post('/torrents/add', upload.any(), async (req, res) => {
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
