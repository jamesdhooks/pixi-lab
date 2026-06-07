import type { SimStyle } from '@hooksjam/pixi-lab-core';
import type { AmoebaRawTextureUpload } from './AmoebaLampRawTextureUpload.js';

export interface AmoebaRawCompositeOptions {
  readonly threshold?: number;
  readonly edgeGlow?: number;
  readonly heatStrength?: number;
}

export interface AmoebaRawCompositeOutput {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function compositeAmoebaRawFieldsToRgba(
  upload: AmoebaRawTextureUpload,
  style: SimStyle,
  options: AmoebaRawCompositeOptions = {},
  target?: Uint8Array,
): AmoebaRawCompositeOutput {
  const width = Math.max(1, Math.floor(upload.width));
  const height = Math.max(1, Math.floor(upload.height));
  const output = target && target.length === width * height * 4 ? target : new Uint8Array(width * height * 4);
  const threshold = clamp01(options.threshold ?? numericUniform(style, 'threshold', 0.42));
  const edgeGlow = clamp01(options.edgeGlow ?? numericUniform(style, 'glowStrength', 0.65));
  const heatStrength = clamp01(options.heatStrength ?? 0.75);
  const background = unpackRgb(style.background);
  const cool = unpackRgb(style.palette[2] ?? style.palette[1] ?? style.background);
  const warm = unpackRgb(style.palette[3] ?? style.palette[style.palette.length - 1] ?? style.background);
  const highlight = unpackRgb(style.palette[4] ?? style.palette[style.palette.length - 1] ?? 0xffffff);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const byteIndex = pixelIndex * 4;
      const density = readChannel(upload.data, byteIndex) / 255;
      const heat = readChannel(upload.data, byteIndex + 1) / 255;
      if (density < threshold) {
        writeRgb(output, byteIndex, background);
        continue;
      }

      const membrane = smoothstep(threshold, 1, density);
      const heatMix = clamp01(heat * heatStrength);
      const base = mixRgb(cool, warm, heatMix);
      const gradient = densityGradient(upload.data, width, height, x, y);
      const edge = clamp01(gradient * edgeGlow + (1 - Math.abs(density - threshold) / Math.max(0.001, 1 - threshold)) * edgeGlow * 0.2);
      const lit = mixRgb(base, highlight, clamp01(edge));
      const color = mixRgb(background, lit, membrane);
      writeRgb(output, byteIndex, color);
    }
  }

  return { data: output, width, height };
}

function numericUniform(style: SimStyle, key: string, fallback: number): number {
  const value = style.uniforms[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readChannel(data: Uint8Array, index: number): number {
  return data[index] ?? 0;
}

function densityGradient(data: Uint8Array, width: number, height: number, x: number, y: number): number {
  const left = sampleDensity(data, width, height, x - 1, y);
  const right = sampleDensity(data, width, height, x + 1, y);
  const up = sampleDensity(data, width, height, x, y - 1);
  const down = sampleDensity(data, width, height, x, y + 1);
  return Math.min(1, Math.hypot(right - left, down - up));
}

function sampleDensity(data: Uint8Array, width: number, height: number, x: number, y: number): number {
  const sx = Math.max(0, Math.min(width - 1, x));
  const sy = Math.max(0, Math.min(height - 1, y));
  return readChannel(data, (sy * width + sx) * 4) / 255;
}

function unpackRgb(value: number): RgbColor {
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function mixRgb(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  const t = clamp01(amount);
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

function writeRgb(output: Uint8Array, byteIndex: number, color: RgbColor): void {
  output[byteIndex] = toByte(color.r);
  output[byteIndex + 1] = toByte(color.g);
  output[byteIndex + 2] = toByte(color.b);
  output[byteIndex + 3] = 255;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(0.001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
