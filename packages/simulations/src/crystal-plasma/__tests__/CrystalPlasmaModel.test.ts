import { describe, expect, it } from 'vitest';
import { CrystalPlasmaModel } from '../CrystalPlasmaModel.js';

const makeModel = (seed = 7321) => new CrystalPlasmaModel({
  seed,
  width: 640,
  height: 360,
  columns: 48,
  rows: 27,
  maxCrystals: 260,
  stressDecay: 0.986,
});

describe('CrystalPlasmaModel', () => {
  it('initializes deterministically from the same seed', () => {
    expect(makeModel(14).snapshot()).toEqual(makeModel(14).snapshot());
  });

  it('advances crystal growth, stress, and fracture state over time', () => {
    const model = makeModel();
    const before = model.stats();
    for (let i = 0; i < 18; i++) model.update(1 / 60);
    const after = model.stats();
    expect(after.crystalCount).toBeGreaterThanOrEqual(before.crystalCount);
    expect(after.totalStress).not.toBe(before.totalStress);
    expect(after.fractureMax).toBeGreaterThan(0);
  });

  it('tap, hold, and fast swipe gestures seed crystals, charge stress, and fracture facets', () => {
    const model = makeModel();
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 0 });
    const afterTap = model.stats();
    model.handleGesture({ kind: 'hold', x: 340, y: 190, timestamp: 16 });
    model.handleGesture({ kind: 'fast_swipe', x: 350, y: 180, dx: 180, dy: -20, velocity: 2.4, timestamp: 32 });
    const afterGestures = model.stats();
    expect(afterGestures.crystalCount).toBeGreaterThan(afterTap.crystalCount);
    expect(afterGestures.totalStress).toBeGreaterThan(afterTap.totalStress);
    expect(afterGestures.fractureMax).toBeGreaterThan(0);
  });

  it('detects a uniform dead state and stabilize injects fresh crystal energy', () => {
    const model = makeModel();
    model.drainForTest();
    let report = model.detectStagnation(1.3);
    report = model.detectStagnation(1.3);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.crystalCount).toBeGreaterThan(0);
    expect(stats.totalStress).toBeGreaterThan(0.5);
  });

  it('soft reset with a seed reproduces state', () => {
    const model = makeModel(18);
    model.update(1 / 30);
    model.reset(404);
    const first = model.snapshot();
    model.update(1 / 30);
    model.reset(404);
    expect(model.snapshot()).toEqual(first);
  });
});
