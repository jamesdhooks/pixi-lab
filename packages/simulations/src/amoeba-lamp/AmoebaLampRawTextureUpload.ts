import type { AmoebaRawFieldState } from './AmoebaLampRawFieldState.js';

export interface AmoebaRawTextureUpload {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export function packAmoebaRawFieldsToRgba(
  state: AmoebaRawFieldState,
  target?: Uint8Array,
): AmoebaRawTextureUpload {
  const width = state.width;
  const height = state.height;
  const requiredLength = width * height * 4;
  const data = target && target.length === requiredLength ? target : new Uint8Array(requiredLength);

  for (let i = 0; i < width * height; i++) {
    const density = clamp01(state.density.current[i] ?? 0);
    const heat = clamp01(state.heat.current[i] ?? 0);
    const offset = i * 4;
    data[offset] = toByte(density);
    data[offset + 1] = toByte(heat);
    data[offset + 2] = toByte(Math.max(0, density - heat * 0.35));
    data[offset + 3] = 255;
  }

  return { width, height, data };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(clamp01(value) * 255)));
}
