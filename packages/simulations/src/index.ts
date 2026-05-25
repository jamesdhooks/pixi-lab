import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition';

export { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition';
export { HarmonicSandScene, harmonicSandStyleManifest } from './harmonic-sand/HarmonicSandScene';
export { HarmonicSandPreviewScene } from './harmonic-sand/HarmonicSandPreviewScene';
export { HarmonicSandModel, type HarmonicEmitter, type HarmonicSandModelOptions } from './harmonic-sand/HarmonicSandModel';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [harmonicSandDefinition] as const;

export function getSimulation(id: string): SimulationDefinition | undefined {
  return SIMULATION_REGISTRY.find((simulation) => simulation.id === id);
}
