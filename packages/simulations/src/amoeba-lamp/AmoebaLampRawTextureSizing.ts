import type { RenderQuality } from '@hooksjam/pixi-lab-core';

export interface AmoebaRawTextureSizeOptions {
  readonly width: number;
  readonly height: number;
  readonly quality: RenderQuality;
}

const MIN_TEXTURE_EDGE = 64;
const RAW_TEXTURE_EDGE = 256;
const ENHANCED_TEXTURE_EDGE = 192;
const BASIC_TEXTURE_EDGE = 160;

export function resolveAmoebaRawTextureSize(options: AmoebaRawTextureSizeOptions): { width: number; height: number } {
  if (!Number.isFinite(options.width) || !Number.isFinite(options.height) || options.width <= 0 || options.height <= 0) {
    return { width: MIN_TEXTURE_EDGE, height: MIN_TEXTURE_EDGE };
  }

  const maxEdge = options.quality === 'raw'
    ? RAW_TEXTURE_EDGE
    : options.quality === 'enhanced'
      ? ENHANCED_TEXTURE_EDGE
      : BASIC_TEXTURE_EDGE;
  const aspect = options.width / options.height;
  if (aspect >= 1) {
    return {
      width: maxEdge,
      height: Math.max(MIN_TEXTURE_EDGE, Math.round(maxEdge / aspect)),
    };
  }

  return {
    width: Math.max(MIN_TEXTURE_EDGE, Math.round(maxEdge * aspect)),
    height: maxEdge,
  };
}
