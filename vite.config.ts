import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173, // Changed: Use standard port (5173) for dev server to avoid conflict with backend on 4000
    strictPort: true,
    allowedHosts: ['tparumahceria.my.id'],
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4000', // Changed: Use port 4000
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:4000', // Changed: Use port 4000
        changeOrigin: true,
      },
    },
  },
})
