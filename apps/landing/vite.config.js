import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const landingRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: landingRoot,
  publicDir: resolve(landingRoot, '../../public'),
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: resolve(landingRoot, '../../dist-landing'),
    emptyOutDir: true,
  },
})
