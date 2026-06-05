import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    hmr: true,
  },
  optimizeDeps: {
    include: ['recharts', 'd3-shape', 'd3-scale', 'd3-path'],
  },
})