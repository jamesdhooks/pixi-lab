import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';

export { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
export { HarmonicSandScene, harmonicSandStyleManifest } from './harmonic-sand/HarmonicSandScene.js';
export { HarmonicSandPreviewScene } from './harmonic-sand/HarmonicSandPreviewScene.js';
export { HarmonicSandModel, type HarmonicEmitter, type HarmonicSandModelOptions } from './harmonic-sand/HarmonicSandModel.js';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [harmonicSandDefinition] as const;

export function getSimulation(id: string): SimulationDefinition | undefined {
  return SIMULATION_REGISTRY.find((simulation) => simulation.id === id);
}
