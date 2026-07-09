import type { RenderQuality } from '../types.js';

export type AdvancedPhysicsEngineKind =
  | 'advanced-circle-particles'
  | 'custom-raw-model'
  | 'gpu-cellular-field'
  | 'gpu-height-field'
  | 'gpu-instanced-vascular-graph'
  | 'gpu-ping-pong-field'
  | 'gpu-stable-fluid'
  | '2d-pic-flip-particle-water'
  | '2d-sph-double-density-relaxation-water'
  | 'raymarched-lava-lamp'
  | 'shared-liquid-surface-lava'
  | 'viscous-amoeba-particles';
export type AdvancedPhysicsShapeKind =
  | 'circle'
  | 'capsule'
  | 'box'
  | 'chain'
  | 'field'
  | 'instanced-capsule-segments'
  | 'soft-body';
export type AdvancedPhysicsPortability = 'reusable-core' | 'demo-adapter' | 'one-off';

export interface AdvancedPhysicsFidelityProfile {
  readonly quality: RenderQuality;
  readonly particleScale: number;
  readonly spawnRateScale: number;
  readonly solverPassCap: number;
  readonly substepCap: number;
  readonly renderScale: number;
}

export interface AdvancedPhysicsMetadata {
  readonly renderer: 'raw-webgl2';
  readonly engine: AdvancedPhysicsEngineKind;
  readonly portability: AdvancedPhysicsPortability;
  readonly supportedShapes: readonly AdvancedPhysicsShapeKind[];
  readonly reusableFor: readonly string[];
  readonly caveats?: readonly string[];
}

export interface AdvancedPhysicsEngine<TSettings, TStats> {
  readonly kind: AdvancedPhysicsEngineKind;
  readonly capacity: number;
  readonly count: number;
  configure(settings: Partial<TSettings>): void;
  setBounds(width: number, height: number): void;
  clear(): void;
  step(deltaSeconds: number): TStats;
  getStats(): TStats;
}

export const ADVANCED_PHYSICS_FIDELITY_PROFILES: Record<RenderQuality, AdvancedPhysicsFidelityProfile> = {
  basic: {
    quality: 'basic',
    particleScale: 0.25,
    spawnRateScale: 0.36,
    solverPassCap: 2,
    substepCap: 1,
    renderScale: 0.75,
  },
  enhanced: {
    quality: 'enhanced',
    particleScale: 0.55,
    spawnRateScale: 0.72,
    solverPassCap: 3,
    substepCap: 2,
    renderScale: 0.9,
  },
  raw: {
    quality: 'raw',
    particleScale: 1,
    spawnRateScale: 1,
    solverPassCap: 8,
    substepCap: 5,
    renderScale: 1,
  },
};

export function resolveAdvancedPhysicsFidelityProfile(quality: RenderQuality): AdvancedPhysicsFidelityProfile {
  return ADVANCED_PHYSICS_FIDELITY_PROFILES[quality] ?? ADVANCED_PHYSICS_FIDELITY_PROFILES.raw;
}
