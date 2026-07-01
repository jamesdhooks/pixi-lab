import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
import { orbitalShrapnelDefinition } from './orbital-shrapnel/orbital-shrapnel.definition.js';

export { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
export { HarmonicSandScene, harmonicSandStyleManifest } from './harmonic-sand/HarmonicSandScene.js';
export { RawHarmonicSandScene } from './harmonic-sand/RawHarmonicSandScene.js';
export { HarmonicSandPreviewScene } from './harmonic-sand/HarmonicSandPreviewScene.js';
export { HarmonicSandModel, type HarmonicEmitter, type HarmonicSandModelOptions } from './harmonic-sand/HarmonicSandModel.js';

export { orbitalShrapnelDefinition } from './orbital-shrapnel/orbital-shrapnel.definition.js';
export { OrbitalShrapnelExperimentalRawEngineScene } from './orbital-shrapnel/OrbitalShrapnelExperimentalRawEngineScene.js';
export { OrbitalShrapnelScene, orbitalShrapnelStyleManifest } from './orbital-shrapnel/OrbitalShrapnelScene.js';
export { OrbitalShrapnelPreviewScene } from './orbital-shrapnel/OrbitalShrapnelPreviewScene.js';
export { OrbitalShrapnelModel, type OrbitalShrapnelModelOptions, type OrbitalShrapnelStats } from './orbital-shrapnel/OrbitalShrapnelModel.js';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [
  harmonicSandDefinition,
  orbitalShrapnelDefinition,
] as const;

export function getSimulation(id: string): SimulationDefinition | undefined {
  return SIMULATION_REGISTRY.find((simulation) => simulation.id === id);
}
