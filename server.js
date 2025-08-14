#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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
        console.log('Updated session cookie');
      }
    }
    
    return response;
  } catch (error) {
    // If 401, try to login and retry
    if (error.response && error.response.status === 401) {
      console.log('Got 401, attempting login...');
      
      // Try to login with empty credentials for local bypass
      try {
        const loginResponse = await axios({
          method: 'POST',
          url: `http://${qbHost}:${qbPort}/api/v2/auth/login`,
          data: 'username=&password=',
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
            console.log('Login successful, got cookie');
            
            // Retry original request
            config.headers['Cookie'] = sessionCookie;
            return await axios(config);
          }
        }
        
        // If no cookie but login OK, we're in bypass mode
        if (loginResponse.data === 'Ok.') {
          console.log('Login OK - bypass mode');
          sessionCookie = ''; // Clear cookie for bypass mode
          return await axios(config);
        }
      } catch (loginError) {
        console.error('Login failed:', loginError.message);
      }
    }
    
    throw error;
  }
}

// Proxy all API requests
app.use('/api/v2', async (req, res) => {
  const path = req.url;
  console.log(`Proxying ${req.method} /api/v2${path}`);
  
  try {
    let data = req.body;
    let headers = {};
    
    // Handle different content types
    if (req.is('application/x-www-form-urlencoded')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      if (typeof data === 'object') {
        data = new URLSearchParams(data).toString();
      }
    } else if (req.is('multipart/form-data')) {
      headers = req.headers;
    }
    
    const response = await makeQbRequest(req.method, path, data, headers);
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

// Serve static files if dist folder exists
const distPath = path.join(__dirname, 'dist');
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
  
  // Try initial login
  try {
    await makeQbRequest('POST', '/auth/login', 'username=&password=', {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    console.log('Initial authentication successful');
  } catch (error) {
    console.log('Initial authentication skipped:', error.message);
  }
});