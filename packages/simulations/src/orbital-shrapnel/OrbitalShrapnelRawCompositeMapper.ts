import type { SimStyle, TrailField } from '@hooksjam/pixi-lab-core';

export interface OrbitalShrapnelRawCompositeOptions {
  readonly width?: number;
  readonly height?: number;
}

export function compositeOrbitalShrapnelRawTrailToRgba(
  field: TrailField,
  style: SimStyle,
  output?: Uint8Array,
  options: OrbitalShrapnelRawCompositeOptions = {},
): Uint8Array {
  const width = finitePositiveInteger(options.width) ? options.width : field.columns;
  const height = finitePositiveInteger(options.height) ? options.height : field.rows;
  const requiredLength = width * height * 4;
  const pixels = output?.length === requiredLength ? output : new Uint8Array(requiredLength);
  const palette = style.palette.length > 0 ? style.palette : [style.background, 0xffffff];

  for (let y = 0; y < height; y++) {
    const ny = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x++) {
      const nx = width <= 1 ? 0 : x / (width - 1);
      const value = clamp01(field.sampleBilinearNormalized(nx, ny));
      const color = samplePalette(palette, Math.pow(value, 0.42));
      const offset = (y * width + x) * 4;
      pixels[offset] = (color >> 16) & 0xff;
      pixels[offset + 1] = (color >> 8) & 0xff;
      pixels[offset + 2] = color & 0xff;
      pixels[offset + 3] = Math.round(clamp01(value * 1.6) * 255);
    }
  }

  return pixels;
}

function samplePalette(palette: readonly number[], t: number): number {
  if (palette.length === 1) return palette[0];
  const scaled = clamp01(t) * (palette.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(palette.length - 1, left + 1);
  const mix = scaled - left;
  return mixRgb(palette[left], palette[right], mix);
}

function mixRgb(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function finitePositiveInteger(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
