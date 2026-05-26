import { describe, expect, it } from 'vitest';
import { NeonRiverDeltaModel, type NeonRiverDeltaModelOptions } from '../NeonRiverDeltaModel.js';

const makeOptions = (seed = 42): NeonRiverDeltaModelOptions => ({
  seed,
  width: 800,
  height: 600,
  columns: 48,
  rows: 36,
  rainfall: 0.72,
  erosionRate: 0.46,
  sedimentGlow: 0.9,
  flowSpeed: 1,
});

describe('NeonRiverDeltaModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new NeonRiverDeltaModel(makeOptions(123));
    const b = new NeonRiverDeltaModel(makeOptions(123));
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('advances bounded water and sediment fields', () => {
    const model = new NeonRiverDeltaModel(makeOptions(7));
    const before = model.snapshot();
    for (let i = 0; i < 12; i++) model.update(1 / 30);
    const stats = model.stats();
    expect(model.snapshot()).not.toEqual(before);
    expect(stats.waterMean).toBeGreaterThanOrEqual(0);
    expect(stats.sedimentMean).toBeGreaterThanOrEqual(0);
    expect(stats.waterMean).toBeLessThan(1.6);
    expect(stats.sedimentMean).toBeLessThan(1.8);
  });

  it('gestures reshape the delta state', () => {
    const model = new NeonRiverDeltaModel(makeOptions(55));
    const before = model.snapshot();
    model.handleGesture({ kind: 'drag', x: 420, y: 160, dx: 120, dy: 260, timestamp: 1 });
    model.handleGesture({ kind: 'tap', x: 280, y: 120, timestamp: 2 });
    expect(model.snapshot()).not.toEqual(before);
  });

  it('detects stagnation on flattened dry terrain and recovers through stabilize', () => {
    const model = new NeonRiverDeltaModel(makeOptions(88));
    model.flattenForTest();
    const report = model.detectStagnation(2);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.waterVariance + stats.sedimentVariance + stats.flowEnergy).toBeGreaterThan(0);
  });

  it('soft reset with the same seed reproduces state via reset', () => {
    const model = new NeonRiverDeltaModel(makeOptions(99));
    const initial = model.snapshot();
    model.update(0.5);
    model.handleGesture({ kind: 'fast_swipe', x: 360, y: 220, dx: 180, dy: 360, velocity: 3, timestamp: 3 });
    model.reset(99);
    expect(model.snapshot()).toEqual(initial);
  });
});
