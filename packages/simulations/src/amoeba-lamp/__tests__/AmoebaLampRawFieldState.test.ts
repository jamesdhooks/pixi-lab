import { describe, expect, it } from 'vitest';
import {
  createAmoebaRawFieldState,
  injectAmoebaRawSplats,
  stepAmoebaRawFieldState,
} from '../AmoebaLampRawFieldState.js';
import type { AmoebaRawFieldSplat } from '../AmoebaLampRawSplatMapper.js';

describe('AmoebaLampRawFieldState', () => {
  it('injects bounded density and heat splats into active field buffers', () => {
    const state = createAmoebaRawFieldState({ width: 16, height: 12 });
    const splats: AmoebaRawFieldSplat[] = [
      { x: 0.5, y: 0.5, texelX: 8, texelY: 6, radius: 3, density: 1.2, heat: 0.75 },
      { x: 0, y: 0, texelX: -4, texelY: 30, radius: 2, density: 10, heat: 5 },
    ];

    injectAmoebaRawSplats(state, splats);

    expect(state.density.current.some((value) => value > 0)).toBe(true);
    expect(state.heat.current.some((value) => value > 0)).toBe(true);
    expect(Math.max(...state.density.current)).toBeLessThanOrEqual(1);
    expect(Math.max(...state.heat.current)).toBeLessThanOrEqual(1);
    expect(state.density.current[6 * 16 + 8]).toBe(1);
    expect(state.heat.current[6 * 16 + 8]).toBeCloseTo(0.75, 5);
  });

  it('ping-pongs persistent density and heat with decay, diffusion, and upward heat drift', () => {
    const state = createAmoebaRawFieldState({ width: 9, height: 9 });
    injectAmoebaRawSplats(state, [
      { x: 0.5, y: 0.55, texelX: 4, texelY: 5, radius: 1, density: 1, heat: 1 },
    ]);
    const beforeDensity = state.density.current;
    const beforeHeat = state.heat.current;

    stepAmoebaRawFieldState(state, {
      densityDecay: 0.9,
      heatDecay: 0.8,
      diffusion: 0.25,
      heatRise: 0.5,
    });

    expect(state.density.current).not.toBe(beforeDensity);
    expect(state.heat.current).not.toBe(beforeHeat);
    expect(Math.max(...state.density.current)).toBeLessThan(1);
    expect(Math.max(...state.heat.current)).toBeLessThan(1);
    expect(state.density.current[5 * 9 + 4]).toBeGreaterThan(state.density.current[0]);
    expect(state.heat.current[4 * 9 + 4]).toBeGreaterThan(state.heat.current[6 * 9 + 4]);
  });
});
