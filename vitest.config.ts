import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // pixi.js is a peerDependency in several packages and is not symlinked
      // into those packages' node_modules when tests run from the workspace root.
      // Stub it so tests that exercise pure-TS logic can import files that
      // transitively depend on pixi.js without a browser rendering context.
      'pixi.js': resolve(__dirname, 'vitest/mocks/pixi.ts'),
      '@hooksjam/pixi-lab-core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
  },
});
