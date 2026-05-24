import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hooksjam/pixi-lab-core': resolve(__dirname, '../core/src/index.ts'),
      '@hooksjam/pixi-lab-react': resolve(__dirname, '../react/src/index.ts'),
      '@hooksjam/pixi-lab-games': resolve(__dirname, '../games/src/index.ts'),
    },
  },
  base: '/pixi-lab/',
});
