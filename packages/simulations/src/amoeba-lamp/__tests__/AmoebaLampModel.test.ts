import { describe, expect, it } from 'vitest';
import { AmoebaLampModel } from '../AmoebaLampModel.js';

function createModel(seed = 4242) {
  return new AmoebaLampModel({
    seed,
    width: 480,
    height: 300,
    columns: 40,
    rows: 25,
    blobCount: 7,
    particleBudget: 42,
    densityRadius: 3.4,
    heatDiffusion: 0.16,
    surfaceTension: 0.72,
    buoyancy: 58,
  });
}

describe('AmoebaLampModel', () => {
  it('creates deterministic blob particles and fields from the same seed', () => {
    const a = createModel(17);
    const b = createModel(17);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update moves blobs while maintaining bounded particle and field state', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    const stats = model.stats();
    expect(stats.particleCount).toBeGreaterThan(0);
    expect(stats.particleCount).toBeLessThanOrEqual(42);
    expect(stats.densityMax).toBeGreaterThan(0);
    expect(Number.isFinite(stats.meanSpeed)).toBe(true);
    for (const particle of model.particleSnapshot()) {
      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(480);
      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(300);
    }
  });

  it('drag gestures swish nearby blobs', () => {
    const model = createModel();
    const before = model.stats().meanSpeed;
    model.handleGesture({ kind: 'drag', x: 240, y: 150, dx: 90, dy: -35, timestamp: 0 });
    expect(model.stats().meanSpeed).toBeGreaterThan(before);
  });

  it('addAmoeba adds blobs in empty space without exceeding budget', () => {
    const model = createModel();
    const before = model.stats();
    model.addAmoeba(32, 32, 5);
    const after = model.stats();
    expect(after.particleCount).toBeGreaterThan(before.particleCount);
    expect(after.blobCount).toBeGreaterThanOrEqual(before.blobCount);
    expect(after.particleCount).toBeLessThanOrEqual(42);
  });

  it('detects stagnation and recovers by adding heat or splitting variation', () => {
    const model = createModel();
    model.freezeForTest();
    const report = model.detectStagnation(3);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.meanSpeed + stats.meanHeat).toBeGreaterThan(0);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('reset reproduces the same state for the same seed', () => {
    const a = createModel(99);
    const b = createModel(99);
    a.update(1 / 30);
    a.handleGesture({ kind: 'drag', x: 320, y: 100, dx: 70, dy: 8, timestamp: 3 });
    a.reset(99);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
