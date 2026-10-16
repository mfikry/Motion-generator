import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const desktopRoot = __dirname;

export default defineConfig({
  root: path.resolve(desktopRoot, 'src/renderer'),
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: path.resolve(desktopRoot, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(desktopRoot, 'dist/main'),
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'bufferutil', 'utf-8-validate'],
            },
          },
        },
      },
      {
        entry: path.resolve(desktopRoot, 'src/preload/index.ts'),
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: path.resolve(desktopRoot, 'dist/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(desktopRoot, 'src/renderer'),
      '@main': path.resolve(desktopRoot, 'src/main'),
      '@genc/motion-schema': path.resolve(desktopRoot, '../../packages/motion-schema/src'),
      '@genc/shared-types': path.resolve(desktopRoot, '../../packages/shared-types/src'),
    },
  },
  build: {
    outDir: path.resolve(desktopRoot, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(desktopRoot, 'src/renderer/index.html'),
        offscreen: path.resolve(desktopRoot, 'src/renderer/render-offscreen.html'),
      },
    },
  },
});
