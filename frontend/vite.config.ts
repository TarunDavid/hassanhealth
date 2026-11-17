import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, allowedHosts: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { host: true, port: 4173, allowedHosts: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
})
