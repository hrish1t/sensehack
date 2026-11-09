import { defineConfig } from 'vite';

// base './' so the build works when served from a sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 }
});
