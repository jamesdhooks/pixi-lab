import { describe, expect, it } from 'vitest';
import { createAmoebaRawFieldState, injectAmoebaRawSplats } from '../AmoebaLampRawFieldState.js';
import { packAmoebaRawFieldsToRgba } from '../AmoebaLampRawTextureUpload.js';

describe('AmoebaLampRawTextureUpload', () => {
  it('packs density and heat field state into a clamped RGBA upload buffer', () => {
    const state = createAmoebaRawFieldState({ width: 4, height: 3 });
    injectAmoebaRawSplats(state, [
      { x: 0.5, y: 0.5, texelX: 2, texelY: 1, radius: 1, density: 1, heat: 0.5 },
    ]);
    state.density.current[0] = -1;
    state.heat.current[0] = 2;

    const upload = packAmoebaRawFieldsToRgba(state);

    expect(upload.width).toBe(4);
    expect(upload.height).toBe(3);
    expect(upload.data).toBeInstanceOf(Uint8Array);
    expect(upload.data).toHaveLength(4 * 3 * 4);
    expect(Array.from(upload.data.slice(0, 4))).toEqual([0, 255, 0, 255]);
    const center = (1 * 4 + 2) * 4;
    expect(upload.data[center]).toBe(255);
    expect(upload.data[center + 1]).toBe(128);
    expect(upload.data[center + 2]).toBeGreaterThan(0);
    expect(upload.data[center + 3]).toBe(255);
  });

  it('reuses a provided upload buffer without leaving stale alpha data', () => {
    const state = createAmoebaRawFieldState({ width: 2, height: 2 });
    const target = new Uint8Array(2 * 2 * 4);
    target.fill(7);

    const upload = packAmoebaRawFieldsToRgba(state, target);

    expect(upload.data).toBe(target);
    for (let i = 0; i < target.length; i += 4) {
      expect(Array.from(target.slice(i, i + 4))).toEqual([0, 0, 0, 255]);
    }
  });
});
