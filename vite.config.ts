import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: `npm run dev` proxies /api straight to qBittorrent and does NOT
// route through the Express server. That means in dev there is no app-level
// Basic auth, no endpoint allowlist, no setPreferences key filter, and no
// qB4/qB5 path translation. This is intentional for fast local iteration on
// the frontend — DO NOT expose the dev server outside a trusted network.
// Production traffic always goes through server/server.js, which enforces
// all of the above.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: process.env.QBIT_HOST || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        timeout: 60000,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})