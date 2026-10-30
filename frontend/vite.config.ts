import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development (npm run dev), /api is proxied to Flask.
// In production (Docker), nginx does the proxying.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:5000',
    },
  },
})
