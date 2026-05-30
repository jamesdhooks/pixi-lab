import { describe, expect, it } from 'vitest';
import type { SimStyle } from '@hooksjam/pixi-lab-core';
import { compositeAmoebaRawFieldsToRgba } from '../AmoebaLampRawCompositeMapper.js';

const style: SimStyle = {
  id: 'test-membrane',
  name: 'Test Membrane',
  background: 0x020406,
  palette: [0x020406, 0x103060, 0x30d0ff, 0xff50c8, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'normalLighting'],
  uniforms: { threshold: 0.4, glowStrength: 0.8, normalStrength: 0.5 },
};

describe('AmoebaLampRawCompositeMapper', () => {
  it('thresholds density into a membrane while preserving dark background outside the organism', () => {
    const densityHeat = new Uint8Array([
      0, 0, 0, 255,
      230, 20, 0, 255,
      0, 0, 0, 255,
    ]);

    const output = compositeAmoebaRawFieldsToRgba({ data: densityHeat, width: 3, height: 1 }, style, {
      threshold: 0.4,
      edgeGlow: 0.7,
      heatStrength: 0.6,
    });

    expect(output.width).toBe(3);
    expect(output.height).toBe(1);
    expect(Array.from(output.data.slice(0, 4))).toEqual([2, 4, 6, 255]);
    expect(Array.from(output.data.slice(8, 12))).toEqual([2, 4, 6, 255]);
    expect(output.data[4]).toBeGreaterThan(16);
    expect(output.data[5]).toBeGreaterThan(48);
    expect(output.data[6]).toBeGreaterThan(96);
    expect(output.data[7]).toBe(255);
  });

  it('uses heat to tint equally dense membrane pixels toward the warm palette and reuses caller storage', () => {
    const densityHeat = new Uint8Array([
      220, 16, 0, 255,
      220, 240, 0, 255,
    ]);
    const target = new Uint8Array(2 * 1 * 4);

    const output = compositeAmoebaRawFieldsToRgba({ data: densityHeat, width: 2, height: 1 }, style, {
      threshold: 0.35,
      edgeGlow: 0,
      heatStrength: 1,
    }, target);

    expect(output.data).toBe(target);
    const coldRed = output.data[0];
    const coldBlue = output.data[2];
    const hotRed = output.data[4];
    const hotBlue = output.data[6];

    expect(hotRed).toBeGreaterThan(coldRed);
    expect(hotBlue).toBeLessThanOrEqual(coldBlue);
    expect(output.data[3]).toBe(255);
    expect(output.data[7]).toBe(255);
  });
});
