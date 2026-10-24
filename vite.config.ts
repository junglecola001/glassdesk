import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Vite preserves the path of an HTML entry, but the extension manifest needs
 * `newtab.html` at the package root. Copy it there after the bundle is written.
 * Asset URLs are absolute (`/assets/...`), so they keep working after the move.
 */
function flattenNewtabHtml() {
  const root = import.meta.dirname;
  return {
    name: 'glassdesk:flatten-newtab-html',
    apply: 'build' as const,
    closeBundle() {
      const nested = resolve(root, 'dist/src/newtab/index.html');
      if (!existsSync(nested)) return;
      const destination = resolve(root, 'dist/newtab.html');
      writeFileSync(destination, readFileSync(nested));
      rmSync(resolve(root, 'dist/src'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), flattenNewtabHtml()],
  build: {
    target: 'chrome116',
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      input: {
        newtab: resolve(import.meta.dirname, 'src/newtab/index.html'),
        background: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'service-worker.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
