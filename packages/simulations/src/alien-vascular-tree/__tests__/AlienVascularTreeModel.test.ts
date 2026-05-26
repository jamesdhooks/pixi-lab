import { describe, expect, it } from 'vitest';
import { AlienVascularTreeModel, type AlienVascularTreeModelOptions } from '../AlienVascularTreeModel.js';

const makeOptions = (seed = 1234): AlienVascularTreeModelOptions => ({
  seed,
  width: 800,
  height: 600,
  columns: 64,
  rows: 48,
  branchBudget: 96,
  growthRate: 1.1,
  nutrientFlow: 1.0,
  pruneRate: 0.16,
});

describe('AlienVascularTreeModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new AlienVascularTreeModel(makeOptions(42));
    const b = new AlienVascularTreeModel(makeOptions(42));
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('advances bounded branch growth without exceeding budget', () => {
    const model = new AlienVascularTreeModel(makeOptions(7));
    for (let i = 0; i < 120; i++) model.update(1 / 30);
    const stats = model.stats();
    expect(stats.branchCount).toBeGreaterThan(8);
    expect(stats.branchCount).toBeLessThanOrEqual(93);
    expect(model.particles.length).toBeLessThanOrEqual(93);
  });

  it('gestures inject nutrients and alter deterministic state', () => {
    const model = new AlienVascularTreeModel(makeOptions(9));
    model.update(0.2);
    const before = model.snapshot();
    model.handleGesture({ kind: 'hold', x: 420, y: 260, timestamp: 1 });
    model.update(0.2);
    expect(model.snapshot()).not.toEqual(before);
    expect(model.stats().meanNutrient).toBeGreaterThan(0.05);
  });

  it('reports stagnation when all tips are starved', () => {
    const model = new AlienVascularTreeModel(makeOptions(11));
    model.starveForTest();
    let report = model.detectStagnation(0.5);
    report = model.detectStagnation(1.5);
    expect(report.stagnant).toBe(true);
    expect(report.severity).toBeGreaterThan(0);
  });

  it('stabilize restores active growth and nutrient variance', () => {
    const model = new AlienVascularTreeModel(makeOptions(13));
    model.starveForTest();
    model.stabilize();
    const stats = model.stats();
    expect(stats.activeTips).toBeGreaterThan(0);
    expect(stats.growthEnergy).toBeGreaterThan(0.5);
  });

  it('reset with a seed reproduces the same snapshot', () => {
    const model = new AlienVascularTreeModel(makeOptions(21));
    model.update(0.4);
    model.reset(77);
    const first = model.snapshot();
    model.update(0.3);
    model.reset(77);
    expect(model.snapshot()).toEqual(first);
  });
});
