import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// NOTE: `npm run dev` proxies /api straight to qBittorrent and does NOT
// route through the Express server. That means in dev there is no app-level
// Basic auth, no endpoint allowlist, no setPreferences key filter, and no
// qB4/qB5 path translation. This is intentional for fast local iteration on
// the frontend — DO NOT expose the dev server outside a trusted network.
// Production traffic always goes through server/server.js, which enforces
// all of the above.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'qBit Mobile',
        short_name: 'qBit Mobile',
        description: 'Mobile-friendly qBittorrent Web UI',
        theme_color: '#1e40af',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        categories: ['productivity', 'utilities'],
      },
      workbox: {
        // Precache the SPA shell only. /api responses are live state and
        // must never be served from cache; NetworkOnly is the explicit
        // routing rule for them.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
      // The dev server proxies /api directly to qBittorrent; running a SW
      // there only makes debugging harder.
      devOptions: { enabled: false },
    }),
  ],
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