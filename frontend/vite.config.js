import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API server listens on 5000 unless PORT is set (macOS reserves 5000 for AirPlay)
const apiTarget = `http://localhost:${process.env.API_PORT || 5000}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
      '/storage': apiTarget,
    },
  },
})
