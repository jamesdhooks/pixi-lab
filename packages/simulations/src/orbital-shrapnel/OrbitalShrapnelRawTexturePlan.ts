import type { RenderQuality } from '@hooksjam/pixi-lab-core';

export interface OrbitalShrapnelRawTexturePlanOptions {
  readonly width: number;
  readonly height: number;
  readonly quality: RenderQuality;
  readonly particleCount: number;
  readonly trailColumns: number;
  readonly rawParticleTextureSize?: number | string;
  readonly rawTrailTextureWidth?: number | string;
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
const RAW_PARTICLE_TEXTURE_MIN = 256;
const RAW_PARTICLE_TEXTURE_MAX = 1024;
const RAW_TRAIL_TEXTURE_MIN = 320;
const RAW_TRAIL_TEXTURE_MAX = 1024;

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
  const particleWidth = particleTextureWidthForQuality(options.quality, options.rawParticleTextureSize);
  const maxParticleHeight = maxParticleTextureHeightForQuality(options.quality, particleWidth);
  const requestedParticles = Math.max(MIN_EDGE, Math.ceil(finitePositive(options.particleCount) ? options.particleCount : MIN_EDGE));
  const particleHeight = Math.max(1, Math.min(maxParticleHeight, Math.ceil(requestedParticles / particleWidth)));
  const trailWidth = trailTextureWidthForQuality(options.quality, options.rawTrailTextureWidth);

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

function particleTextureWidthForQuality(quality: RenderQuality, rawParticleTextureSize?: number | string): number {
  if (quality === 'raw') return clampTextureSize(rawParticleTextureSize, RAW_PARTICLE_WIDTH, RAW_PARTICLE_TEXTURE_MIN, RAW_PARTICLE_TEXTURE_MAX);
  if (quality === 'enhanced') return ENHANCED_PARTICLE_WIDTH;
  return BASIC_PARTICLE_WIDTH;
}

function maxParticleTextureHeightForQuality(quality: RenderQuality, particleWidth: number): number {
  if (quality === 'raw') return Math.min(128, particleWidth);
  if (quality === 'enhanced') return 84;
  return 64;
}

function trailTextureWidthForQuality(quality: RenderQuality, rawTrailTextureWidth?: number | string): number {
  if (quality === 'raw') return clampTextureSize(rawTrailTextureWidth, RAW_TRAIL_WIDTH, RAW_TRAIL_TEXTURE_MIN, RAW_TRAIL_TEXTURE_MAX);
  if (quality === 'enhanced') return ENHANCED_TRAIL_WIDTH;
  return BASIC_TRAIL_WIDTH;
}

function clampTextureSize(value: number | string | undefined, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!finitePositive(numeric ?? Number.NaN)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric as number)));
}

function resolveAspect(width: number, height: number): number {
  if (!finitePositive(width) || !finitePositive(height)) return 1;
  return width / height;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
