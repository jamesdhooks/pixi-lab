import { describe, expect, it } from 'vitest';
import { RAW_FLUID_CANVAS_Z_INDEX } from '../GpuFluidTankRenderer.js';
import { setDisplacementScale } from '../PixiFeedbackFluidRenderer.js';

describe('setDisplacementScale', () => {
  it('assigns x and y when the Pixi scale object does not expose set()', () => {
    const scale = { x: 0, y: 0 };

    setDisplacementScale(scale, 42);

    expect(scale).toEqual({ x: 42, y: 42 });
  });

  it('uses set() when the Pixi scale object exposes it', () => {
    const calls: Array<[number, number]> = [];
    const scale = {
      x: 0,
      y: 0,
      set(x: number, y: number) {
        calls.push([x, y]);
      },
    };

    setDisplacementScale(scale, 17);

    expect(calls).toEqual([[17, 17]]);
  });
});

describe('Fluid Tank raw canvas layering', () => {
  it('keeps the raw WebGL adapter above the shared Pixi canvas', () => {
    expect(Number(RAW_FLUID_CANVAS_Z_INDEX)).toBeGreaterThan(2);
  });
});
