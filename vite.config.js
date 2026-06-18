import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    // Electron loads the bundle from local disk, not over HTTP. Vite's default
    // 500 KB warning is aimed at web apps where download size matters. Bundles
    // here include 299 mod translations × 9 languages inline, which is ~400 KB
    // of text by itself and loads instantly from disk. Raise the threshold so
    // the warning doesn't cry wolf on every build.
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173 },
});
