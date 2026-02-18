import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mission_control/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: ['stagesnap-assistant.tail581fc8.ts.net'],
  },
  preview: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: ['stagesnap-assistant.tail581fc8.ts.net'],
  },
})
