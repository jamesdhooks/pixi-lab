import { describe, expect, it } from 'vitest';
import { createAmoebaRawFramePipeline, stepAmoebaRawFramePipeline } from '../AmoebaLampRawFramePipeline.js';

describe('AmoebaLampRawFramePipeline', () => {
  it('maps particles into persistent fields and reuses the upload buffer across matching frames', () => {
    const pipeline = createAmoebaRawFramePipeline({ textureWidth: 8, textureHeight: 6 });

    const first = stepAmoebaRawFramePipeline(pipeline, {
      particles: [{ x: 40, y: 30, heat: 0.75 }],
      width: 80,
      height: 60,
      densityRadius: 4,
      maxSplats: 8,
      densityDecay: 0.98,
      heatDecay: 0.96,
      diffusion: 0.12,
      heatRise: 0.1,
    });
    const firstBuffer = first.data;
    const firstEnergy = pipeline.state.density.current.reduce((sum, value) => sum + value, 0);

    const second = stepAmoebaRawFramePipeline(pipeline, {
      particles: [{ x: 42, y: 28, heat: 0.9 }],
      width: 80,
      height: 60,
      densityRadius: 4,
      maxSplats: 8,
      densityDecay: 0.98,
      heatDecay: 0.96,
      diffusion: 0.12,
      heatRise: 0.1,
    });
    const secondEnergy = pipeline.state.density.current.reduce((sum, value) => sum + value, 0);

    expect(first.width).toBe(8);
    expect(first.height).toBe(6);
    expect(second.data).toBe(firstBuffer);
    expect(firstEnergy).toBeGreaterThan(0);
    expect(secondEnergy).toBeGreaterThan(firstEnergy);
    expect(Array.from(second.data).some((value) => value > 0)).toBe(true);
  });

  it('resizes field state and upload storage when raw texture dimensions change', () => {
    const pipeline = createAmoebaRawFramePipeline({ textureWidth: 4, textureHeight: 4 });
    const first = stepAmoebaRawFramePipeline(pipeline, {
      particles: [{ x: 10, y: 10, heat: 0.5 }],
      width: 20,
      height: 20,
      densityRadius: 2,
      densityDecay: 1,
      heatDecay: 1,
      diffusion: 0,
      heatRise: 0,
    });

    const resized = stepAmoebaRawFramePipeline(pipeline, {
      particles: [{ x: 10, y: 10, heat: 0.5 }],
      width: 20,
      height: 20,
      textureWidth: 6,
      textureHeight: 3,
      densityRadius: 2,
      densityDecay: 1,
      heatDecay: 1,
      diffusion: 0,
      heatRise: 0,
    });

    expect(first.data).toHaveLength(4 * 4 * 4);
    expect(resized.width).toBe(6);
    expect(resized.height).toBe(3);
    expect(resized.data).toHaveLength(6 * 3 * 4);
    expect(resized.data).not.toBe(first.data);
    expect(pipeline.state.width).toBe(6);
    expect(pipeline.state.height).toBe(3);
  });
});
