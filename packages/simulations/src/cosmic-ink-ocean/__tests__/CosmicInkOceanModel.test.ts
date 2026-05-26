import { describe, expect, it } from 'vitest';
import { CosmicInkOceanModel } from '../CosmicInkOceanModel.js';

function createModel(seed = 260526) {
  return new CosmicInkOceanModel({
    seed,
    width: 640,
    height: 360,
    columns: 64,
    rows: 36,
    particleCount: 220,
    turbulence: 1.35,
    flowSpeed: 1,
    inkDiffusion: 0.964,
    vortexStrength: 1.1,
  });
}

describe('CosmicInkOceanModel', () => {
  it('creates deterministic ink particles from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update advances particles and keeps ink fields bounded', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.particleCount).toBe(220);
    expect(stats.inkMax).toBeGreaterThan(0);
    expect(stats.inkMax).toBeLessThanOrEqual(1.8);
    expect(stats.vectorEnergy).toBeGreaterThan(0);
  });

  it('tap and hold gestures create bounded vortices', () => {
    const model = createModel();
    const before = model.stats().vortexCount;
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 0 });
    model.handleGesture({ kind: 'hold', x: 260, y: 150, timestamp: 16 });
    expect(model.stats().vortexCount).toBeGreaterThan(before);
    for (let i = 0; i < 20; i++) model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: i });
    expect(model.stats().vortexCount).toBeLessThanOrEqual(10);
  });

  it('drag gestures shear nearby particles and increase kinetic energy', () => {
    const model = createModel();
    const before = model.stats().kineticEnergy;
    model.handleGesture({ kind: 'drag', x: 320, y: 180, dx: 260, dy: -120, timestamp: 0 });
    expect(model.stats().kineticEnergy).toBeGreaterThan(before);
  });

  it('detects collapsed ink flow and stabilizes it', () => {
    const model = createModel();
    model.collapseForTest();
    const report = model.detectStagnation(3);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.kineticEnergy).toBeGreaterThan(0);
    expect(stats.inkMax).toBeGreaterThan(0);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('reset reproduces state for the same seed', () => {
    const a = createModel(101);
    const b = createModel(101);
    a.update(1 / 20);
    a.handleGesture({ kind: 'fast_swipe', x: 300, y: 160, dx: 260, dy: 30, velocity: 2, timestamp: 1 });
    a.reset(101);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
