import type { AmoebaRawFieldSplat } from './AmoebaLampRawSplatMapper.js';

export interface AmoebaRawFieldStateOptions {
  readonly width: number;
  readonly height: number;
}

export interface AmoebaRawPingPongField {
  current: Float32Array;
  next: Float32Array;
}

export interface AmoebaRawFieldState {
  readonly width: number;
  readonly height: number;
  readonly density: AmoebaRawPingPongField;
  readonly heat: AmoebaRawPingPongField;
}

export interface AmoebaRawFieldStepOptions {
  readonly densityDecay: number;
  readonly heatDecay: number;
  readonly diffusion: number;
  readonly heatRise: number;
}

export function createAmoebaRawFieldState(options: AmoebaRawFieldStateOptions): AmoebaRawFieldState {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const length = width * height;
  return {
    width,
    height,
    density: { current: new Float32Array(length), next: new Float32Array(length) },
    heat: { current: new Float32Array(length), next: new Float32Array(length) },
  };
}

export function injectAmoebaRawSplats(state: AmoebaRawFieldState, splats: readonly AmoebaRawFieldSplat[]): void {
  for (const splat of splats) {
    const cx = clampInt(Math.round(splat.texelX), 0, state.width - 1);
    const cy = clampInt(Math.round(splat.texelY), 0, state.height - 1);
    const radius = Math.max(0.5, splat.radius);
    const radiusPixels = Math.max(1, Math.ceil(radius));
    const density = clamp01(splat.density);
    const heat = clamp01(splat.heat);

    for (let y = Math.max(0, cy - radiusPixels); y <= Math.min(state.height - 1, cy + radiusPixels); y++) {
      for (let x = Math.max(0, cx - radiusPixels); x <= Math.min(state.width - 1, cx + radiusPixels); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const falloff = Math.max(0, 1 - (dx * dx + dy * dy) / (radius * radius));
        if (falloff <= 0) continue;
        const index = y * state.width + x;
        state.density.current[index] = Math.min(1, state.density.current[index] + density * falloff);
        state.heat.current[index] = Math.min(1, state.heat.current[index] + heat * falloff);
      }
    }
  }
}

export function stepAmoebaRawFieldState(state: AmoebaRawFieldState, options: AmoebaRawFieldStepOptions): void {
  stepField(state, state.density, clamp01(options.densityDecay), clamp01(options.diffusion), 0);
  stepField(state, state.heat, clamp01(options.heatDecay), clamp01(options.diffusion), clamp01(options.heatRise));
}

function stepField(
  state: AmoebaRawFieldState,
  field: AmoebaRawPingPongField,
  decay: number,
  diffusion: number,
  rise: number,
): void {
  const width = state.width;
  const height = state.height;
  field.next.fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const center = field.current[index];
      const below = y + 1 < height ? field.current[(y + 1) * width + x] : center;
      const risen = center * (1 - rise) + below * rise;
      const left = field.current[y * width + Math.max(0, x - 1)];
      const right = field.current[y * width + Math.min(width - 1, x + 1)];
      const up = field.current[Math.max(0, y - 1) * width + x];
      const down = field.current[Math.min(height - 1, y + 1) * width + x];
      const neighborAverage = (left + right + up + down) * 0.25;
      const diffused = risen * (1 - diffusion) + neighborAverage * diffusion;
      field.next[index] = clamp01(diffused * decay);
    }
  }

  const previous = field.current;
  field.current = field.next;
  field.next = previous;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
