import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { antSignalDefinition } from './ant-signal/ant-signal.definition.js';
import { amoebaLampDefinition } from './amoeba-lamp/amoeba-lamp.definition.js';
import { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
import { myceliumPrismDefinition } from './mycelium-prism/mycelium-prism.definition.js';
import { orbitalShrapnelDefinition } from './orbital-shrapnel/orbital-shrapnel.definition.js';
import { plasmaBranchDefinition } from './plasma-branch/plasma-branch.definition.js';

export { amoebaLampDefinition } from './amoeba-lamp/amoeba-lamp.definition.js';
export { AmoebaLampScene, amoebaLampStyleManifest } from './amoeba-lamp/AmoebaLampScene.js';
export { AmoebaLampPreviewScene } from './amoeba-lamp/AmoebaLampPreviewScene.js';
export { AmoebaLampModel, type AmoebaLampModelOptions, type AmoebaLampStats } from './amoeba-lamp/AmoebaLampModel.js';

export { antSignalDefinition } from './ant-signal/ant-signal.definition.js';
export { AntSignalScene, antSignalStyleManifest } from './ant-signal/AntSignalScene.js';
export { AntSignalPreviewScene } from './ant-signal/AntSignalPreviewScene.js';
export { AntSignalModel, type AntSignalModelOptions, type AntSignalStats } from './ant-signal/AntSignalModel.js';

export { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
export { HarmonicSandScene, harmonicSandStyleManifest } from './harmonic-sand/HarmonicSandScene.js';
export { HarmonicSandPreviewScene } from './harmonic-sand/HarmonicSandPreviewScene.js';
export { HarmonicSandModel, type HarmonicEmitter, type HarmonicSandModelOptions } from './harmonic-sand/HarmonicSandModel.js';

export { myceliumPrismDefinition } from './mycelium-prism/mycelium-prism.definition.js';
export { MyceliumPrismScene, myceliumPrismStyleManifest } from './mycelium-prism/MyceliumPrismScene.js';
export { MyceliumPrismPreviewScene } from './mycelium-prism/MyceliumPrismPreviewScene.js';
export { MyceliumPrismModel, type MyceliumPrismModelOptions, type MyceliumStats } from './mycelium-prism/MyceliumPrismModel.js';

export { orbitalShrapnelDefinition } from './orbital-shrapnel/orbital-shrapnel.definition.js';
export { OrbitalShrapnelScene, orbitalShrapnelStyleManifest } from './orbital-shrapnel/OrbitalShrapnelScene.js';
export { OrbitalShrapnelPreviewScene } from './orbital-shrapnel/OrbitalShrapnelPreviewScene.js';
export { OrbitalShrapnelModel, type OrbitalShrapnelModelOptions, type OrbitalShrapnelStats } from './orbital-shrapnel/OrbitalShrapnelModel.js';

export { plasmaBranchDefinition } from './plasma-branch/plasma-branch.definition.js';
export { PlasmaBranchScene, plasmaBranchStyleManifest } from './plasma-branch/PlasmaBranchScene.js';
export { PlasmaBranchPreviewScene } from './plasma-branch/PlasmaBranchPreviewScene.js';
export { PlasmaBranchModel, type PlasmaBranchModelOptions, type PlasmaBranchStats } from './plasma-branch/PlasmaBranchModel.js';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [harmonicSandDefinition, myceliumPrismDefinition, amoebaLampDefinition, orbitalShrapnelDefinition, plasmaBranchDefinition, antSignalDefinition] as const;

export function getSimulation(id: string): SimulationDefinition | undefined {
  return SIMULATION_REGISTRY.find((simulation) => simulation.id === id);
}
