import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: '0.0.0.0',
    https: {},
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
  },
})
