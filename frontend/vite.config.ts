import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // `make dev` runs this in a container, where the API is the backend service.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
})
