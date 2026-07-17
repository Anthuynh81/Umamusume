import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the static build works from any subpath (GitHub Pages etc.)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Static game-data snapshots change on data refreshes, app code on
        // feature work — split them so returning visitors re-download only
        // what actually changed.
        manualChunks(id) {
          if (id.includes('src/data/static')) return 'gamedata'
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
