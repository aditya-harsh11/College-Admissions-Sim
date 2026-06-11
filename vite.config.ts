import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In dev, forward /api calls to the local responses server (server/server.mjs).
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
