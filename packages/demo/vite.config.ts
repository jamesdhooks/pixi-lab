import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = resolve(__dirname, '../..');

// Dev-only plugin: serves GET /local/<file> directly from the workspace root.
// e.g. http://localhost:5173/local/test.jpg → F:\MyFiles\Projects\Web\pixi-lab\test.jpg
function localFilesPlugin() {
  return {
    name: 'local-files',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/local/', (req, res, next) => {
        const filePath = path.join(workspaceRoot, req.url ?? '');
        // Safety: ensure path stays inside workspace root
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(resolved)) { next(); return; }
        res.writeHead(200, { 'Content-Type': mimeOf(resolved), 'Cache-Control': 'no-store' });
        fs.createReadStream(resolved).pipe(res);
      });
    },
  };
}

function mimeOf(f: string) {
  const ext = path.extname(f).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' })[ext] ?? 'application/octet-stream';
}

export default defineConfig({
  plugins: [react(), localFilesPlugin()],
  resolve: {
    alias: {
      '@hooksjam/pixi-lab-core': resolve(__dirname, '../core/src/index.ts'),
      '@hooksjam/pixi-lab-react': resolve(__dirname, '../react/src/index.ts'),
      '@hooksjam/pixi-lab-games': resolve(__dirname, '../games/src/index.ts'),
      '@hooksjam/pixi-lab-simulations': resolve(__dirname, '../simulations/src/index.ts'),
    },
  },
  base: '/pixi-lab/',
});
