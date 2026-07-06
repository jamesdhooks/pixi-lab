import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = resolve(__dirname, '../..');
const sceneDefaultsPath = path.join(workspaceRoot, 'scene-defaults.json');

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

function sceneDefaultsPlugin() {
  return {
    name: 'scene-defaults',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/__pixi-lab-scene-defaults', (req, res) => {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(readSceneDefaultsFile());
          return;
        }
        if (req.method !== 'PUT') {
          res.writeHead(405, { 'Content-Type': 'text/plain' });
          res.end('Method Not Allowed');
          return;
        }

        let raw = '';
        req.on('data', (chunk: Buffer | string) => {
          raw += chunk.toString();
        });
        req.on('end', () => {
          const payload = parseJsonObject(raw);
          const definitionId = typeof payload.definitionId === 'string' ? payload.definitionId : '';
          const defaults = parseDefaultsRecord(payload.defaults);
          if (!definitionId || !defaults) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid scene defaults payload');
            return;
          }
          const current = parseSceneDefaultsFile();
          const replaceSceneDefaults = payload.section === null;
          const scenes = {
            ...current.scenes,
            [definitionId]: replaceSceneDefaults ? defaults : { ...(current.scenes[definitionId] ?? {}), ...defaults },
          };
          const next = JSON.stringify({ version: 1, scenes }, null, 2) + '\n';
          fs.writeFileSync(sceneDefaultsPath, next, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(next);
        });
      });
    },
  };
}

function mimeOf(f: string) {
  const ext = path.extname(f).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' })[ext] ?? 'application/octet-stream';
}

function readSceneDefaultsFile(): string {
  if (!fs.existsSync(sceneDefaultsPath)) return JSON.stringify({ version: 1, scenes: {} }, null, 2) + '\n';
  return fs.readFileSync(sceneDefaultsPath, 'utf8');
}

function parseSceneDefaultsFile(): { version: 1; scenes: Record<string, Record<string, string | number | boolean>> } {
  const parsed = parseJsonObject(readSceneDefaultsFile());
  const scenes = parseScenesRecord(parsed.scenes) ?? {};
  return { version: 1, scenes };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseScenesRecord(value: unknown): Record<string, Record<string, string | number | boolean>> | null {
  if (!isRecord(value)) return null;
  const scenes: Record<string, Record<string, string | number | boolean>> = {};
  for (const [id, defaults] of Object.entries(value)) {
    const parsed = parseDefaultsRecord(defaults);
    if (parsed) scenes[id] = parsed;
  }
  return scenes;
}

function parseDefaultsRecord(value: unknown): Record<string, string | number | boolean> | null {
  if (!isRecord(value)) return null;
  const defaults: Record<string, string | number | boolean> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (typeof setting === 'string' || typeof setting === 'number' || typeof setting === 'boolean') {
      defaults[key] = setting;
    }
  }
  return defaults;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default defineConfig({
  plugins: [react(), localFilesPlugin(), sceneDefaultsPlugin()],
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
