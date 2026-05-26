import { describe, expect, it } from 'vitest';
import { ElectroOsmoticAmoebaModel } from '../ElectroOsmoticAmoebaModel.js';

function createModel(seed = 9090) {
  return new ElectroOsmoticAmoebaModel({
    seed,
    width: 520,
    height: 320,
    columns: 48,
    rows: 30,
    cellCount: 8,
    particleBudget: 80,
    voltage: 0.45,
    osmoticPressure: 0.75,
    membraneElasticity: 0.62,
    ionDiffusion: 0.28,
    fieldRadius: 3.6,
  });
}

describe('ElectroOsmoticAmoebaModel', () => {
  it('creates deterministic charged membranes from the same seed', () => {
    const a = createModel(17);
    const b = createModel(17);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update moves ions while keeping bounded particles and fields', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.particleCount).toBeGreaterThan(0);
    expect(stats.particleCount).toBeLessThanOrEqual(80);
    expect(stats.densityMax).toBeGreaterThan(0);
    expect(stats.potentialVariance).toBeGreaterThan(0);
    for (const particle of model.particleSnapshot()) {
      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(520);
      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(320);
    }
  });

  it('drag gestures accelerate ion flow', () => {
    const model = createModel();
    const before = model.stats().meanSpeed;
    model.handleGesture({ kind: 'drag', x: 260, y: 160, dx: 110, dy: -25, timestamp: 0 });
    expect(model.stats().meanSpeed).toBeGreaterThan(before);
  });

  it('hold gestures raise charge variance', () => {
    const model = createModel();
    const before = model.stats().potentialVariance;
    model.handleGesture({ kind: 'hold', x: 260, y: 160, timestamp: 0 });
    expect(model.stats().potentialVariance).toBeGreaterThanOrEqual(before);
    expect(model.stats().meanCharge).toBeGreaterThan(0);
  });

  it('fast swipe gestures split membranes without exceeding budget', () => {
    const model = createModel();
    model.mergeAllForTest();
    const before = model.stats().cellCount;
    model.handleGesture({ kind: 'fast_swipe', x: 260, y: 160, dx: 240, dy: 10, velocity: 2.3, timestamp: 0 });
    const after = model.stats();
    expect(after.cellCount).toBeGreaterThan(before);
    expect(after.particleCount).toBeLessThanOrEqual(80);
  });

  it('detects stagnation and recovers with renewed charge flow', () => {
    const model = createModel();
    model.freezeForTest();
    expect(model.detectStagnation(3).stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.meanSpeed + stats.meanCharge).toBeGreaterThan(0);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('reset reproduces the same state for the same seed', () => {
    const a = createModel(99);
    const b = createModel(99);
    a.update(1 / 30);
    a.handleGesture({ kind: 'hold', x: 320, y: 120, timestamp: 3 });
    a.reset(99);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
