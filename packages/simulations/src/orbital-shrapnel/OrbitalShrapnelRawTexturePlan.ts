import type { RenderQuality } from '@hooksjam/pixi-lab-core';

export interface OrbitalShrapnelRawTexturePlanOptions {
  readonly width: number;
  readonly height: number;
  readonly quality: RenderQuality;
  readonly particleCount: number;
  readonly trailColumns: number;
}

export interface OrbitalShrapnelRawTexturePlan {
  readonly particleState: {
    readonly width: number;
    readonly height: number;
    readonly capacity: number;
  };
  readonly trailField: {
    readonly width: number;
    readonly height: number;
  };
}

const MIN_EDGE = 64;
const RAW_PARTICLE_WIDTH = 256;
const ENHANCED_PARTICLE_WIDTH = 192;
const BASIC_PARTICLE_WIDTH = 128;
const RAW_TRAIL_WIDTH = 320;
const ENHANCED_TRAIL_WIDTH = 240;
const BASIC_TRAIL_WIDTH = 160;

export function resolveOrbitalShrapnelRawTexturePlan(
  options: OrbitalShrapnelRawTexturePlanOptions,
): OrbitalShrapnelRawTexturePlan {
  if (!finitePositive(options.width) || !finitePositive(options.height)) {
    return {
      particleState: { width: MIN_EDGE, height: 1, capacity: MIN_EDGE },
      trailField: { width: MIN_EDGE, height: MIN_EDGE },
    };
  }

  const aspect = resolveAspect(options.width, options.height);
  const particleWidth = particleTextureWidthForQuality(options.quality);
  const maxParticleHeight = maxParticleTextureHeightForQuality(options.quality);
  const requestedParticles = Math.max(MIN_EDGE, Math.ceil(finitePositive(options.particleCount) ? options.particleCount : MIN_EDGE));
  const particleHeight = Math.max(1, Math.min(maxParticleHeight, Math.ceil(requestedParticles / particleWidth)));
  const trailWidth = trailTextureWidthForQuality(options.quality);

  return {
    particleState: {
      width: particleWidth,
      height: particleHeight,
      capacity: particleWidth * particleHeight,
    },
    trailField: {
      width: trailWidth,
      height: Math.max(MIN_EDGE, Math.round(trailWidth / aspect)),
    },
  };
}

function particleTextureWidthForQuality(quality: RenderQuality): number {
  if (quality === 'raw') return RAW_PARTICLE_WIDTH;
  if (quality === 'enhanced') return ENHANCED_PARTICLE_WIDTH;
  return BASIC_PARTICLE_WIDTH;
}

function maxParticleTextureHeightForQuality(quality: RenderQuality): number {
  if (quality === 'raw') return 128;
  if (quality === 'enhanced') return 84;
  return 64;
}

function trailTextureWidthForQuality(quality: RenderQuality): number {
  if (quality === 'raw') return RAW_TRAIL_WIDTH;
  if (quality === 'enhanced') return ENHANCED_TRAIL_WIDTH;
  return BASIC_TRAIL_WIDTH;
}

function resolveAspect(width: number, height: number): number {
  if (!finitePositive(width) || !finitePositive(height)) return 1;
  return width / height;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
