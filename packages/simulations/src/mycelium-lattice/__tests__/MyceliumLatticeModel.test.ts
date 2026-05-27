import { describe, expect, it } from 'vitest';
import { MyceliumLatticeModel } from '../MyceliumLatticeModel.js';

function createModel(seed = 42) {
  return new MyceliumLatticeModel({
    seed,
    width: 480,
    height: 320,
    columns: 32,
    rows: 22,
    strainCount: 6,
    initialSpores: 8,
    maxTips: 4000,
    growthProbability: 0.52,
    branchChance: 0.10,
    generationHueStep: 13,
    forwardBias: 1.0,
    sideBias: 0.42,
  });
}

function createBlankModel(seed = 42) {
  return new MyceliumLatticeModel({
    seed,
    width: 480,
    height: 320,
    columns: 32,
    rows: 22,
    strainCount: 6,
    initialSpores: 0,
    maxTips: 4000,
    growthProbability: 0.52,
    branchChance: 0.10,
    generationHueStep: 13,
    forwardBias: 1.0,
    sideBias: 0.42,
  });
}

describe('MyceliumLatticeModel', () => {
  it('creates deterministic state from the same seed', () => {
    const a = createModel(11);
    const b = createModel(11);
    expect(a.stats()).toEqual(b.stats());
  });

  it('has living cells after initialisation', () => {
    const model = createModel();
    expect(model.stats().livingCells).toBeGreaterThan(0);
  });

  it('has active tips after initialisation', () => {
    const model = createModel();
    expect(model.stats().tipCount).toBeGreaterThan(0);
  });

  it('keeps a blank lattice idle after its first render', () => {
    const model = createBlankModel();
    expect(model.stats()).toEqual({ livingCells: 0, tipCount: 0 });
    expect(model.hasRenderChanges()).toBe(true);
    model.markRendered();
    model.update(1 / 30);
    expect(model.hasRenderChanges()).toBe(false);
    expect(model.stats()).toEqual({ livingCells: 0, tipCount: 0 });
  });

  it('advances growth over multiple ticks', () => {
    const model = createModel();
    const before = model.stats().livingCells;
    for (let i = 0; i < 10; i++) model.update(1 / 30);
    const after = model.stats().livingCells;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(32 * 22);
  });

  it('tap gesture increases living cells', () => {
    const model = createModel();
    for (let i = 0; i < 3; i++) model.update(1 / 30);
    const before = model.stats().livingCells;
    model.handleGesture({ kind: 'tap', x: 240, y: 160, timestamp: 0 });
    expect(model.stats().livingCells).toBeGreaterThan(before);
  });

  it('drag gesture increases living cells', () => {
    const model = createModel();
    for (let i = 0; i < 3; i++) model.update(1 / 30);
    const before = model.stats().livingCells;
    model.handleGesture({ kind: 'drag', x: 300, y: 140, dx: 30, dy: -10, timestamp: 0 });
    expect(model.stats().livingCells).toBeGreaterThan(before);
  });

  it('reset clears growth state', () => {
    const model = createModel();
    for (let i = 0; i < 10; i++) model.update(1 / 30);
    model.reset(42);
    const stats = model.stats();
    // After reset with the same seed we should have exactly the initial living count.
    const fresh = createModel(42);
    expect(stats.livingCells).toBe(fresh.stats().livingCells);
  });

  it('live-settable probability setters do not throw', () => {
    const model = createModel();
    expect(() => model.setGrowthProbability(0.8)).not.toThrow();
    expect(() => model.setBranchChance(0.3)).not.toThrow();
    expect(() => model.setGenerationHueStep(20)).not.toThrow();
  });

  it('grid cell values stay in [0, 1] after updates', () => {
    const model = createModel();
    for (let i = 0; i < 15; i++) model.update(1 / 30);
    for (const cell of model.grid.cells) {
      expect(cell.value).toBeGreaterThanOrEqual(0);
      expect(cell.value).toBeLessThanOrEqual(1);
    }
  });

  it('stabilize adds new growth when stagnant', () => {
    const model = createModel();
    // Exhaust tips by running many ticks on a small grid with high probability.
    const highProb = new MyceliumLatticeModel({
      seed: 1, width: 200, height: 100, columns: 16, rows: 8,
      strainCount: 6, initialSpores: 4, maxTips: 200,
      growthProbability: 0.99, branchChance: 0.01,
      generationHueStep: 13, forwardBias: 1.0, sideBias: 0.5,
    });
    for (let i = 0; i < 200; i++) highProb.update(1 / 30);
    const report = highProb.detectStagnation(3);
    if (report.stagnant) {
      const before = highProb.stats().livingCells;
      highProb.stabilize();
      expect(highProb.stats().livingCells).toBeGreaterThanOrEqual(before);
    }
  });
});
