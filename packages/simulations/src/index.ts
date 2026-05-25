import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { amoebaLampDefinition } from './amoeba-lamp/amoeba-lamp.definition.js';
import { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
import { myceliumPrismDefinition } from './mycelium-prism/mycelium-prism.definition.js';

export { amoebaLampDefinition } from './amoeba-lamp/amoeba-lamp.definition.js';
export { AmoebaLampScene, amoebaLampStyleManifest } from './amoeba-lamp/AmoebaLampScene.js';
export { AmoebaLampPreviewScene } from './amoeba-lamp/AmoebaLampPreviewScene.js';
export { AmoebaLampModel, type AmoebaLampModelOptions, type AmoebaLampStats } from './amoeba-lamp/AmoebaLampModel.js';

export { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
export { HarmonicSandScene, harmonicSandStyleManifest } from './harmonic-sand/HarmonicSandScene.js';
export { HarmonicSandPreviewScene } from './harmonic-sand/HarmonicSandPreviewScene.js';
export { HarmonicSandModel, type HarmonicEmitter, type HarmonicSandModelOptions } from './harmonic-sand/HarmonicSandModel.js';

export { myceliumPrismDefinition } from './mycelium-prism/mycelium-prism.definition.js';
export { MyceliumPrismScene, myceliumPrismStyleManifest } from './mycelium-prism/MyceliumPrismScene.js';
export { MyceliumPrismPreviewScene } from './mycelium-prism/MyceliumPrismPreviewScene.js';
export { MyceliumPrismModel, type MyceliumPrismModelOptions, type MyceliumStats } from './mycelium-prism/MyceliumPrismModel.js';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [harmonicSandDefinition, myceliumPrismDefinition, amoebaLampDefinition] as const;

export function getSimulation(id: string): SimulationDefinition | undefined {
  return SIMULATION_REGISTRY.find((simulation) => simulation.id === id);
}
