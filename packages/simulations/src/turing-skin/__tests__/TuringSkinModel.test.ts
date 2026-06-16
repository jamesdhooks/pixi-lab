import { describe, expect, it } from 'vitest';
import { TuringSkinModel } from '../TuringSkinModel.js';

function createModel(seed = 260527) {
  return new TuringSkinModel({
    seed,
    width: 640,
    height: 360,
    columns: 64,
    rows: 36,
    feedRate: 0.046,
    killRate: 0.061,
    diffusionA: 1,
    diffusionB: 0.5,
    brushStrength: 0.85,
  });
}

describe('TuringSkinModel', () => {
  it('initializes deterministic morphogen fields from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update advances reaction state and keeps fields bounded', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.columns).toBe(64);
    expect(stats.rows).toBe(36);
    expect(stats.fieldMax).toBeGreaterThan(0);
    expect(stats.fieldMax).toBeLessThanOrEqual(1.6);
    expect(stats.reagentMean).toBeGreaterThan(0);
  });

  it('tap and hold gestures change pigment variance', () => {
    const model = createModel();
    const before = model.stats().fieldVariance;
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 0 });
    model.handleGesture({ kind: 'hold', x: 260, y: 150, timestamp: 16 });
    expect(model.stats().fieldVariance).not.toBe(before);
  });

  it('drag and swipe gestures inject bounded reaction trails', () => {
    const model = createModel();
    model.handleGesture({ kind: 'drag', x: 320, y: 180, dx: 260, dy: -120, timestamp: 0 });
    model.handleGesture({ kind: 'fast_swipe', x: 280, y: 160, dx: -320, dy: 80, velocity: 3, timestamp: 16 });
    const stats = model.stats();
    expect(stats.fieldMax).toBeGreaterThan(0);
    expect(stats.fieldMax).toBeLessThanOrEqual(1.6);
  });

  it('detects collapsed reactions and stabilizes them', () => {
    const model = createModel();
    model.collapseForTest();
    const report = model.detectStagnation(3);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    expect(model.stats().fieldMax).toBeGreaterThan(0);
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
