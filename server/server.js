#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Setup multer for file uploads
const upload = multer();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers for API routes
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// qBittorrent configuration
const qbHost = process.env.QBITTORRENT_HOST || 'localhost';
const qbPort = process.env.QBITTORRENT_PORT || 8080;
const qbUser = process.env.QBITTORRENT_USERNAME || '';
const qbPass = process.env.QBITTORRENT_PASSWORD || '';

// Store cookie globally
let sessionCookie = null;

// Function to make authenticated request
async function makeQbRequest(method, path, data, headers = {}) {
  const config = {
    method,
    url: `http://${qbHost}:${qbPort}/api/v2${path}`,
    headers: {
      ...headers,
      'Cookie': sessionCookie || ''
    },
    timeout: 30000
  };
  
  if (data !== undefined) {
    config.data = data;
  }
  
  try {
    const response = await axios(config);
    
    // Update cookie if we get one
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const sid = cookies.find(c => c.includes('SID='));
      if (sid) {
        sessionCookie = sid.split(';')[0];
        // Updated session cookie
      }
    }
    
    return response;
  } catch (error) {
    // If 401, try to login and retry
    if (error.response && error.response.status === 401) {
      // Got 401, attempting login
      
      // Try to login with configured credentials or bypass
      try {
        const loginData = qbUser ? 
          `username=${encodeURIComponent(qbUser)}&password=${encodeURIComponent(qbPass)}` :
          'username=&password=';
        
        const loginResponse = await axios({
          method: 'POST',
          url: `http://${qbHost}:${qbPort}/api/v2/auth/login`,
          data: loginData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        // Get cookie from login
        const setCookie = loginResponse.headers['set-cookie'];
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
          const sid = cookies.find(c => c.includes('SID='));
          if (sid) {
            sessionCookie = sid.split(';')[0];
            // Login successful, got cookie
            
            // Retry original request
            config.headers['Cookie'] = sessionCookie;
            return await axios(config);
          }
        }
        
        // If no cookie but login OK, we're in bypass mode or auth succeeded
        if (loginResponse.data === 'Ok.') {
          // Login OK
          sessionCookie = ''; // Clear cookie for bypass mode or auth mode without cookies
          return await axios(config);
        }
      } catch (loginError) {
        // Login failed
      }
    }
    
    throw error;
  }
}

// Special handler for torrent uploads
app.post('/api/v2/torrents/add', upload.any(), async (req, res) => {
  // Handling torrent upload
  
  try {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // Add form fields
    Object.entries(req.body).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });
    
    // Add files
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
    // Torrent upload error
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
});

// Proxy all other API requests
app.use('/api/v2', async (req, res) => {
  const path = req.url;
  // Proxying API request

  try {
    let data = req.body;
    let headers = {};

    // Handle different content types
    if (req.is('application/x-www-form-urlencoded')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      if (typeof data === 'object' && data !== null) {
        data = new URLSearchParams(data).toString();
      }
    } else if (req.is('multipart/form-data')) {
      headers = req.headers;
    }
    
    const response = await makeQbRequest(req.method, path, data, headers);
    res.status(response.status).send(response.data);
  } catch (error) {
    // Proxy error
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy error' });
    }
  }
});

// Serve static files if dist folder exists
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  // Serving frontend
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  // Server running
  
  // Try initial login
  try {
    const loginData = qbUser ? 
      `username=${encodeURIComponent(qbUser)}&password=${encodeURIComponent(qbPass)}` :
      'username=&password=';
    
    await makeQbRequest('POST', '/auth/login', loginData, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    // Initial authentication successful
  } catch (error) {
    // Initial authentication skipped
  }
});