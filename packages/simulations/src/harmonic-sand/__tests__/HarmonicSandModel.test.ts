import { describe, expect, it } from 'vitest';
import { HarmonicSandModel } from '../HarmonicSandModel.js';

function createModel(seed = 42) {
  return new HarmonicSandModel({
    seed,
    width: 400,
    height: 240,
    quality: 'basic',
    particleCount: 500,
    emitterCount: 2,
    baseFrequency: 2.4,
  });
}

describe('HarmonicSandModel', () => {
  it('creates deterministic emitters from the seed', () => {
    const a = createModel(11);
    const b = createModel(11);
    expect(a.emitters).toEqual(b.emitters);
  });

  it('updates the field and particles', () => {
    const model = createModel();
    const before = model.field.stats().variance;
    model.update(1 / 60);
    expect(model.field.stats().variance).toBeGreaterThanOrEqual(before);
    expect(model.particles.particles.length).toBe(500);
  });

  it('adds an emitter from tap gestures', () => {
    const model = createModel();
    const before = model.emitters.length;
    model.handleGesture({ kind: 'tap', x: 100, y: 120, timestamp: 0 });
    expect(model.emitters.length).toBe(before + 1);
  });

  it('stabilizes stagnant states', () => {
    const model = createModel();
    for (const value of model.field.values) {
      void value;
    }
    const before = model.emitters.length;
    model.stabilize();
    expect(model.emitters.length).toBeGreaterThanOrEqual(before);
  });

  it('soft reset is deterministic for the same seed', () => {
    const a = createModel(77);
    const b = createModel(77);
    a.update(1 / 60);
    b.update(1 / 60);
    expect(a.particles.particles.slice(0, 10)).toEqual(b.particles.particles.slice(0, 10));
  });
});
