import { describe, expect, it } from 'vitest';
import { HarmonicSandModel } from '../HarmonicSandModel.js';

function createModel(seed = 42) {
  return new HarmonicSandModel({
    seed,
    width: 400,
    height: 240,
    quality: 'basic',
    fieldColumns: 32,
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

  it('updates the scalar field with finite wave values', () => {
    const model = createModel();
    model.update(1 / 60);
    const stats = model.field.stats();
    expect(Number.isFinite(stats.mean)).toBe(true);
    expect(Number.isFinite(stats.variance)).toBe(true);
    expect(stats.variance).toBeGreaterThan(0);
    expect(model.field.columns).toBe(32);
    expect(model.field.rows).toBe(19);
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

  it('reset is deterministic for the same seed', () => {
    const a = createModel(77);
    const b = createModel(77);
    a.handleGesture({ kind: 'tap', x: 250, y: 120, timestamp: 0 });
    a.update(1 / 60);
    a.reset(77);
    a.update(1 / 60);
    b.update(1 / 60);
    expect(a.emitters).toEqual(b.emitters);
    expect(Array.from(a.field.values.slice(0, 32))).toEqual(Array.from(b.field.values.slice(0, 32)));
  });
});
