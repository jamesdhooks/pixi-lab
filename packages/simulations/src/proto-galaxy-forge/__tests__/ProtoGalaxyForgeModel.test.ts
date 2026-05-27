import { describe, expect, it } from 'vitest';
import { ProtoGalaxyForgeModel, type ProtoGalaxyForgeModelOptions } from '../ProtoGalaxyForgeModel.js';

const makeOptions = (overrides: Partial<ProtoGalaxyForgeModelOptions> = {}): ProtoGalaxyForgeModelOptions => ({
  seed: 12345,
  width: 640,
  height: 360,
  columns: 64,
  rows: 36,
  particleCount: 120,
  wellCount: 4,
  gravityStrength: 0.9,
  spinBias: 0.45,
  fusionRate: 0.62,
  ...overrides,
});

describe('ProtoGalaxyForgeModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new ProtoGalaxyForgeModel(makeOptions());
    const b = new ProtoGalaxyForgeModel(makeOptions());
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.particles.slice(0, 5)).toEqual(b.particles.slice(0, 5));
  });

  it('advances orbital dust state on update', () => {
    const model = new ProtoGalaxyForgeModel(makeOptions());
    const before = model.snapshot();
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    expect(model.stats().motionEnergy).toBeGreaterThan(0);
  });

  it('applies gestures to heat and motion fields', () => {
    const model = new ProtoGalaxyForgeModel(makeOptions());
    const before = model.stats();
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 1 });
    model.update(1 / 60);
    const after = model.stats();
    expect(after.heatMean).toBeGreaterThanOrEqual(before.heatMean);
    expect(after.motionEnergy).toBeGreaterThan(0);
  });

  it('keeps particle and field budgets bounded', () => {
    const model = new ProtoGalaxyForgeModel(makeOptions({ particleCount: 90, wellCount: 3 }));
    for (let i = 0; i < 240; i++) model.update(1 / 60);
    const stats = model.stats();
    expect(stats.particleCount).toBe(90);
    expect(stats.wellCount).toBe(3);
    expect(stats.boundedParticles).toBe(90);
    expect(Math.max(...model.densityField.values)).toBeLessThanOrEqual(1.8);
    expect(Math.max(...model.heatField.values)).toBeLessThanOrEqual(2.2);
  });

  it('reports stagnation after flattened low-contrast state persists', () => {
    const model = new ProtoGalaxyForgeModel(makeOptions());
    model.flattenForTest();
    let report = model.detectStagnation(0.5);
    report = model.detectStagnation(0.6);
    report = model.detectStagnation(0.6);
    expect(report.stagnant).toBe(true);
    expect(report.severity).toBeGreaterThan(0);
  });

  it('stabilize injects useful energy and contrast', () => {
    const model = new ProtoGalaxyForgeModel(makeOptions());
    model.flattenForTest();
    model.stabilize();
    const stats = model.stats();
    expect(stats.heatMean).toBeGreaterThan(0);
    expect(model.detectStagnation(0.1).stagnant).toBe(false);
  });

  it('reset with the same seed reproduces the same state', () => {
    const model = new ProtoGalaxyForgeModel(makeOptions());
    const initial = model.snapshot();
    model.update(0.5);
    model.reset(12345);
    expect(model.snapshot()).toEqual(initial);
  });
});
