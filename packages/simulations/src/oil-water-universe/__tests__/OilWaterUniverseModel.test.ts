import { describe, expect, it } from 'vitest';
import { OilWaterUniverseModel, type OilWaterUniverseModelOptions } from '../OilWaterUniverseModel.js';

function makeOptions(overrides: Partial<OilWaterUniverseModelOptions> = {}): OilWaterUniverseModelOptions {
  return {
    seed: 777,
    width: 640,
    height: 360,
    columns: 48,
    rows: 28,
    separationRate: 0.72,
    boundaryTension: 0.24,
    viscosity: 0.26,
    stirStrength: 0.95,
    ...overrides,
  };
}

describe('OilWaterUniverseModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new OilWaterUniverseModel(makeOptions());
    const b = new OilWaterUniverseModel(makeOptions());
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('updates the phase field while keeping values bounded', () => {
    const model = new OilWaterUniverseModel(makeOptions());
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.fieldMean).toBeGreaterThanOrEqual(0);
    expect(stats.fieldMean).toBeLessThanOrEqual(1.4);
    expect(stats.fieldVariance).toBeGreaterThan(0);
    expect(stats.boundaryEnergy).toBeGreaterThan(0);
  });

  it('responds to droplet gestures', () => {
    const model = new OilWaterUniverseModel(makeOptions());
    const before = model.snapshot();
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 1 });
    expect(model.snapshot()).not.toEqual(before);
    expect(model.stats().fieldVariance).toBeGreaterThan(0);
  });

  it('keeps swipe stirring bounded', () => {
    const model = new OilWaterUniverseModel(makeOptions({ stirStrength: 1.7 }));
    for (let i = 0; i < 12; i++) {
      model.handleGesture({ kind: 'fast_swipe', x: 80 + i * 24, y: 180, dx: 420, dy: i % 2 === 0 ? 180 : -180, velocity: 3.2, timestamp: i });
      model.update(1 / 60);
    }
    const values = model.snapshot();
    expect(values.every((value) => Number.isFinite(value) && value >= -1.25 && value <= 1.25)).toBe(true);
  });

  it('detects collapsed stagnation and recovers through stabilize', () => {
    const model = new OilWaterUniverseModel(makeOptions());
    model.collapseForTest();
    let report = model.detectStagnation(1.6);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    model.update(1 / 30);
    report = model.detectStagnation(1 / 30);
    expect(report.stagnant).toBe(false);
    expect(model.stats().fieldVariance).toBeGreaterThan(0);
  });

  it('reset reproduces the same seeded state', () => {
    const model = new OilWaterUniverseModel(makeOptions({ seed: 1234 }));
    const initial = model.snapshot();
    model.handleGesture({ kind: 'drag', x: 220, y: 160, dx: 120, dy: -80, timestamp: 10 });
    model.update(1 / 20);
    expect(model.snapshot()).not.toEqual(initial);
    model.reset(1234);
    expect(model.snapshot()).toEqual(initial);
  });
});
