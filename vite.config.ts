import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolveBuildId } from './build-id'

// NOTE: `npm run dev` proxies /api straight to qBittorrent and does NOT
// route through the Express server. That means in dev there is no app-level
// Basic auth, no endpoint allowlist, no setPreferences key filter, and no
// qB4/qB5 path translation. The dev server binds to 127.0.0.1 by default;
// exposing it on the LAN requires VITE_DEV_HOST=0.0.0.0 AND an explicit
// acknowledgement that you understand what's reachable through the proxy.
const devHost = process.env.VITE_DEV_HOST || '127.0.0.1';
const devIsLoopback = devHost === '127.0.0.1' || devHost === '::1' || devHost === 'localhost';

if (!devIsLoopback && process.env.VITE_I_KNOW_THIS_IS_UNSAFE !== '1') {
  throw new Error(
    `\nRefusing to start: VITE_DEV_HOST="${devHost}" exposes the dev proxy on the LAN with no auth\n` +
      'and no endpoint allowlist (it talks directly to qBittorrent, bypassing the Express server).\n' +
      'If you understand the implications and need phone-on-LAN dev access, rerun with:\n' +
      `  VITE_I_KNOW_THIS_IS_UNSAFE=1 VITE_DEV_HOST=${devHost} npm run dev\n`,
  );
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
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
        // Take over from the previous SW immediately on each new build so
        // a redeploy doesn't get masked by a stuck old cache until all
        // tabs are closed.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
    host: devHost,
    port: 3000,
    // allowedHosts is only relaxed when the user explicitly opts into a
    // non-loopback bind. On loopback the default (just the configured host)
    // is correct.
    ...(devIsLoopback ? {} : { allowedHosts: 'all' as const }),
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