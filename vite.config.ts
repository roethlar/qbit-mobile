import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
        timeout: 60000, // 60 second timeout for large responses
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})