import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'ui',
  server: {
    proxy: {
      // T003: forwards the dashboard's API calls to the Node server (dashboard/server.ts)
      // during `npm run dev` — kept as a genuinely separate process even in development
      // (research.md §5), not a Vite middleware, to keep the boundary between "static
      // frontend" and "the only process allowed to hold an API key" unambiguous.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist-ui',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./ui/index.html', import.meta.url)),
        dashboard: fileURLToPath(new URL('./ui/dashboard.html', import.meta.url)),
      },
    },
  },
});
