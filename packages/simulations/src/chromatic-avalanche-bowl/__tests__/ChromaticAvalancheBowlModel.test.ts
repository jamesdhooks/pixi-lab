import { describe, expect, it } from 'vitest';
import { ChromaticAvalancheBowlModel, type ChromaticAvalancheBowlModelOptions } from '../ChromaticAvalancheBowlModel.js';

function makeOptions(overrides: Partial<ChromaticAvalancheBowlModelOptions> = {}): ChromaticAvalancheBowlModelOptions {
  return {
    seed: 777,
    width: 640,
    height: 360,
    columns: 48,
    rows: 28,
    grainCount: 220,
    slopeAngle: 0.58,
    friction: 0.32,
    chromaMix: 0.64,
    pourRate: 0.82,
    ...overrides,
  };
}

describe('ChromaticAvalancheBowlModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new ChromaticAvalancheBowlModel(makeOptions());
    const b = new ChromaticAvalancheBowlModel(makeOptions());
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('updates granular fields while keeping budgets bounded', () => {
    const model = new ChromaticAvalancheBowlModel(makeOptions({ grainCount: 120 }));
    const before = model.snapshot();
    for (let i = 0; i < 8; i++) model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.grainCount).toBeLessThanOrEqual(120);
    expect(stats.pileMean).toBeGreaterThanOrEqual(0);
    expect(stats.pileMean).toBeLessThanOrEqual(1.5);
    expect(stats.pileVariance).toBeGreaterThan(0);
  });

  it('responds to pour gestures', () => {
    const model = new ChromaticAvalancheBowlModel(makeOptions());
    const beforeCount = model.stats().grainCount;
    model.handleGesture({ kind: 'tap', x: 320, y: 120, timestamp: 1 });
    expect(model.stats().grainCount).toBeGreaterThan(beforeCount);
    expect(model.stats().chromaVariance).toBeGreaterThan(0);
  });

  it('keeps avalanche swipes bounded', () => {
    const model = new ChromaticAvalancheBowlModel(makeOptions({ grainCount: 160, friction: 0.08 }));
    for (let i = 0; i < 12; i++) {
      model.handleGesture({ kind: 'fast_swipe', x: 120 + i * 28, y: 160, dx: 480, dy: i % 2 === 0 ? 220 : -120, velocity: 3.4, timestamp: i });
      model.update(1 / 60);
    }
    const stats = model.stats();
    expect(stats.grainCount).toBeLessThanOrEqual(160);
    expect(stats.pileMean).toBeGreaterThanOrEqual(0);
    expect(stats.pileMean).toBeLessThanOrEqual(1.5);
  });

  it('detects collapsed stagnation and recovers through stabilize', () => {
    const model = new ChromaticAvalancheBowlModel(makeOptions());
    model.collapseForTest();
    let report = model.detectStagnation(1.6);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    model.update(1 / 30);
    report = model.detectStagnation(1 / 30);
    expect(report.stagnant).toBe(false);
    expect(model.stats().grainCount).toBeGreaterThan(0);
    expect(model.stats().pileVariance).toBeGreaterThan(0);
  });

  it('reset reproduces the same seeded state', () => {
    const model = new ChromaticAvalancheBowlModel(makeOptions({ seed: 1234 }));
    const initial = model.snapshot();
    model.handleGesture({ kind: 'drag', x: 220, y: 160, dx: 120, dy: 80, timestamp: 10 });
    model.update(1 / 20);
    expect(model.snapshot()).not.toEqual(initial);
    model.reset(1234);
    expect(model.snapshot()).toEqual(initial);
  });
});
