import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(__dirname, '../../');
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, { import: string; types: string }>;
};

const simulationIds = [
  'alien-vascular-tree',
  'chain-rain',
  'fireworks',
  'fluid-tank',
  'harmonic-sand',
  'lava-lamp',
  'mycelium',
  'orbital-shrapnel',
  'particle-fluid',
  'soft-body-blob',
  'splash-mpm',
  'turing-skin',
  'water-tank',
] as const;

describe('simulation package subpath exports', () => {
  it('exports every registered simulation as a stable npm subpath', () => {
    for (const id of simulationIds) {
      expect(packageJson.exports[`./${id}`]).toEqual({
        import: `./dist/${id}/index.js`,
        types: `./dist/${id}/index.d.ts`,
      });
    }
  });

  it('has a source barrel for every simulation subpath export', () => {
    for (const id of simulationIds) {
      expect(existsSync(resolve(packageRoot, 'src', id, 'index.ts')), `${id} index.ts`).toBe(true);
    }
  });
});
