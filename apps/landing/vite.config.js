import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const landingRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: landingRoot,
  envDir: resolve(landingRoot, '../..'),
  publicDir: resolve(landingRoot, '../../public'),
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: resolve(landingRoot, '../../dist-landing'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/landing.js',
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('react') || id.includes('scheduler')) {
            return 'vendor-react'
          }
          return 'vendor'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/landing.css'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
