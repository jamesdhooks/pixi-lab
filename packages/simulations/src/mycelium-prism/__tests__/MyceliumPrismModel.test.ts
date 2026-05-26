import { describe, expect, it } from 'vitest';
import { MyceliumPrismModel } from '../MyceliumPrismModel.js';

function createModel(seed = 42) {
  return new MyceliumPrismModel({
    seed,
    width: 420,
    height: 260,
    columns: 28,
    rows: 18,
    strainCount: 3,
    initialColonies: 4,
    growthRate: 0.62,
    nutrientDiffusion: 0.18,
  });
}

describe('MyceliumPrismModel', () => {
  it('creates deterministic colonies from the same seed', () => {
    const a = createModel(11);
    const b = createModel(11);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('advances active growth fronts without unbounded cell growth', () => {
    const model = createModel();
    const before = model.stats();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.stats();
    expect(after.activeCells).toBeGreaterThanOrEqual(before.activeCells);
    expect(after.activeCells).toBeLessThanOrEqual(28 * 18);
    expect(after.frontierCells).toBeLessThanOrEqual(after.activeCells);
    expect(Number.isFinite(after.meanNutrient)).toBe(true);
  });

  it('tap gestures seed a new colony at the touched grid position', () => {
    const model = createModel();
    const before = model.stats().activeCells;
    model.handleGesture({ kind: 'tap', x: 210, y: 130, timestamp: 0 });
    expect(model.stats().activeCells).toBeGreaterThan(before);
  });

  it('drag gestures continuously seed spore colonies', () => {
    const model = createModel();
    const before = model.stats().activeCells;
    model.handleGesture({ kind: 'drag', x: 260, y: 120, dx: 35, dy: -10, timestamp: 0 });
    expect(model.stats().activeCells).toBeGreaterThan(before);
  });

  it('detects and stabilizes stagnant states', () => {
    const model = createModel();
    model.drainEnergyForTest();
    const report = model.detectStagnation(3);
    expect(report.stagnant).toBe(true);
    const before = model.stats().activeCells;
    model.stabilize();
    expect(model.stats().activeCells).toBeGreaterThanOrEqual(before);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('soft reset reproduces the same field for the same seed', () => {
    const a = createModel(77);
    const b = createModel(77);
    a.update(1 / 30);
    a.handleGesture({ kind: 'tap', x: 300, y: 140, timestamp: 10 });
    a.reset(77);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
