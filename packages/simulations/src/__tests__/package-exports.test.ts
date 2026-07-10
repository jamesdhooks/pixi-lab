import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIMULATION_REGISTRY } from '../index.js';

const packageRoot = resolve(__dirname, '../../');
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, { import: string; types: string }>;
  files: string[];
};

const simulationIds = SIMULATION_REGISTRY.map((simulation) => simulation.id).sort();

describe('simulation package subpath exports', () => {
  it('keeps npm subpath exports aligned with the demo simulation registry', () => {
    const exportedSimulationIds = Object.keys(packageJson.exports)
      .filter((key) => key !== '.')
      .map((key) => key.slice(2))
      .sort();

    expect(exportedSimulationIds).toEqual(simulationIds);
  });

  it('exports every registered simulation as a stable npm subpath', () => {
    for (const id of simulationIds) {
      expect(packageJson.exports[`./${id}`]).toEqual({
        import: `./dist/${id}/index.js`,
        types: `./dist/${id}/index.d.ts`,
      });
    }
  });

  it('includes every registered simulation in the package publish allowlist', () => {
    const packagedSimulationIds = packageJson.files
      .filter((path) => path.startsWith('dist/'))
      .map((path) => /^dist\/([^/.]+)$/.exec(path)?.[1])
      .filter((id): id is string => Boolean(id))
      .filter((id) => id !== 'advanced-physics' && id !== 'shared')
      .sort();

    expect(packagedSimulationIds).toEqual(simulationIds);
  });

  it('has a source barrel for every simulation subpath export', () => {
    for (const id of simulationIds) {
      expect(existsSync(resolve(packageRoot, 'src', id, 'index.ts')), `${id} index.ts`).toBe(true);
    }
  });
});
