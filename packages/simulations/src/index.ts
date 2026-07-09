import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { alienVascularTreeDefinition } from './alien-vascular-tree/alien-vascular-tree.definition.js';
import { chainRainDefinition } from './chain-rain/chain-rain.definition.js';
import { fireworksDefinition } from './fireworks/fireworks.definition.js';
import { fluidTankDefinition } from './fluid-tank/fluid-tank.definition.js';
import { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
import { lavaLampDefinition } from './lava-lamp/lava-lamp.definition.js';
import { myceliumDefinition } from './mycelium/mycelium.definition.js';
import { orbitalShrapnelDefinition } from './orbital-shrapnel/orbital-shrapnel.definition.js';
import { particleFluidDefinition } from './particle-fluid/particle-fluid.definition.js';
import { softBodyBlobDefinition } from './soft-body-blob/soft-body-blob.definition.js';
import { splashMpmDefinition } from './splash-mpm/splash-mpm.definition.js';
import { sparksDefinition } from './sparks/sparks.definition.js';
import { turingSkinDefinition } from './turing-skin/turing-skin.definition.js';
import { waterTankDefinition } from './water-tank/water-tank.definition.js';

export { alienVascularTreeDefinition, alienVascularTreeStyleManifest } from './alien-vascular-tree/alien-vascular-tree.definition.js';
export { GpuVascularTreeScene } from './alien-vascular-tree/GpuVascularTreeScene.js';
export { chainRainDefinition } from './chain-rain/chain-rain.definition.js';
export { fireworksDefinition } from './fireworks/fireworks.definition.js';
export { fireworksStyleManifest } from './fireworks/fireworksStyleManifest.js';
export { RawFireworksScene } from './fireworks/RawFireworksScene.js';
export { FireworksPreviewScene } from './fireworks/FireworksPreviewScene.js';
export { fluidTankDefinition } from './fluid-tank/fluid-tank.definition.js';
export { fluidTankStyleManifest } from './fluid-tank/fluidTankStyleManifest.js';
export { RawFluidTankScene } from './fluid-tank/RawFluidTankScene.js';
export { FluidTankPreviewScene } from './fluid-tank/FluidTankPreviewScene.js';
export { harmonicSandDefinition } from './harmonic-sand/harmonic-sand.definition.js';
export { harmonicSandStyleManifest } from './harmonic-sand/harmonicSandStyleManifest.js';
export { RawHarmonicSandScene } from './harmonic-sand/RawHarmonicSandScene.js';
export { HarmonicSandPreviewScene } from './harmonic-sand/HarmonicSandPreviewScene.js';
export { lavaLampDefinition, lavaLampStyleManifest } from './lava-lamp/lava-lamp.definition.js';

export { myceliumDefinition, myceliumStyleManifest } from './mycelium/mycelium.definition.js';
export { GpuMyceliumScene } from './mycelium/GpuMyceliumScene.js';
export { orbitalShrapnelDefinition } from './orbital-shrapnel/orbital-shrapnel.definition.js';
export { RawOrbitalShrapnelReferenceScene } from './orbital-shrapnel/RawOrbitalShrapnelReferenceScene.js';
export { orbitalShrapnelStyleManifest } from './orbital-shrapnel/orbitalShrapnelStyleManifest.js';
export { OrbitalShrapnelPreviewScene } from './orbital-shrapnel/OrbitalShrapnelPreviewScene.js';
export { particleFluidDefinition, particleFluidStyleManifest } from './particle-fluid/particle-fluid.definition.js';
export { RawParticleFluidScene } from './particle-fluid/RawParticleFluidScene.js';
export { ParticleFluidPreviewScene } from './particle-fluid/ParticleFluidPreviewScene.js';
export { softBodyBlobDefinition } from './soft-body-blob/soft-body-blob.definition.js';
export { splashMpmDefinition, splashMpmStyleManifest } from './splash-mpm/splash-mpm.definition.js';
export { RawSplashMpmScene } from './splash-mpm/RawSplashMpmScene.js';
export { SplashMpmPreviewScene } from './splash-mpm/SplashMpmPreviewScene.js';
export { sparksDefinition } from './sparks/sparks.definition.js';
export { sparksStyleManifest } from './sparks/sparksStyleManifest.js';
export { RawSparksScene } from './sparks/RawSparksScene.js';
export { SparksPreviewScene } from './sparks/SparksPreviewScene.js';
export { AdvancedConstraintParticlesRawScene } from './advanced-physics/AdvancedConstraintParticlesRawScene.js';
export { turingSkinDefinition, turingSkinStyleManifest } from './turing-skin/turing-skin.definition.js';
export { GpuTuringSkinScene } from './turing-skin/GpuTuringSkinScene.js';
export { waterTankDefinition, waterTankStyleManifest } from './water-tank/water-tank.definition.js';
export { RawParticleMetaballScene } from './shared/RawParticleMetaballScene.js';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [
  chainRainDefinition,
  softBodyBlobDefinition,
  harmonicSandDefinition,
  myceliumDefinition,
  orbitalShrapnelDefinition,
  fluidTankDefinition,
  particleFluidDefinition,
  lavaLampDefinition,
  waterTankDefinition,
  splashMpmDefinition,
  fireworksDefinition,
  sparksDefinition,
  turingSkinDefinition,
  alienVascularTreeDefinition,
] as const;

export function getSimulation(id: string): SimulationDefinition | undefined {
  return SIMULATION_REGISTRY.find((simulation) => simulation.id === id);
}
