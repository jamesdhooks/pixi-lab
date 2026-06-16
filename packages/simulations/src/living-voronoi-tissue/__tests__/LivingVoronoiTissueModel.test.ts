import { describe, expect, it } from 'vitest';
import { LivingVoronoiTissueModel, type LivingVoronoiTissueModelOptions } from '../LivingVoronoiTissueModel.js';

const makeOptions = (seed = 1234): LivingVoronoiTissueModelOptions => ({
  seed,
  width: 800,
  height: 600,
  columns: 64,
  rows: 48,
  cellCount: 48,
  migrationRate: 0.9,
  membraneTension: 0.8,
  signalStrength: 1.0,
  divisionRate: 0.35,
});

describe('LivingVoronoiTissueModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new LivingVoronoiTissueModel(makeOptions(42));
    const b = new LivingVoronoiTissueModel(makeOptions(42));
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('advances bounded tissue fields without exceeding the cell budget', () => {
    const model = new LivingVoronoiTissueModel(makeOptions(7));
    for (let i = 0; i < 120; i++) model.update(1 / 30);
    const stats = model.stats();
    expect(stats.cellCount).toBeGreaterThan(12);
    expect(stats.cellCount).toBeLessThanOrEqual(48);
    expect(stats.boundaryVariance).toBeGreaterThan(0.0001);
    expect(stats.signalVariance).toBeGreaterThan(0.0001);
  });

  it('gestures alter membrane state and motion', () => {
    const model = new LivingVoronoiTissueModel(makeOptions(9));
    model.update(0.2);
    const before = model.snapshot();
    model.handleGesture({ kind: 'drag', x: 420, y: 260, dx: 180, dy: -80, timestamp: 1 });
    model.update(0.2);
    expect(model.snapshot()).not.toEqual(before);
    expect(model.stats().motionEnergy).toBeGreaterThan(0.01);
  });

  it('reports stagnation when fields and motion are flattened', () => {
    const model = new LivingVoronoiTissueModel(makeOptions(11));
    model.flattenForTest();
    let report = model.detectStagnation(0.5);
    report = model.detectStagnation(1.5);
    expect(report.stagnant).toBe(true);
    expect(report.severity).toBeGreaterThan(0);
  });

  it('stabilize restores movement and signal variation', () => {
    const model = new LivingVoronoiTissueModel(makeOptions(13));
    model.flattenForTest();
    model.stabilize();
    const stats = model.stats();
    expect(stats.motionEnergy).toBe(0);
    model.update(0.25);
    const updated = model.stats();
    expect(updated.motionEnergy).toBeGreaterThan(0.01);
    expect(updated.signalVariance).toBeGreaterThan(0.0001);
  });

  it('reset with a seed reproduces the same snapshot', () => {
    const model = new LivingVoronoiTissueModel(makeOptions(21));
    model.update(0.4);
    model.reset(77);
    const first = model.snapshot();
    model.update(0.3);
    model.reset(77);
    expect(model.snapshot()).toEqual(first);
  });
});
