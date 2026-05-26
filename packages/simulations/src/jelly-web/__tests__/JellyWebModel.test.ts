import { describe, expect, it } from 'vitest';
import { JellyWebModel } from '../JellyWebModel.js';

function createModel(seed = 1010) {
  return new JellyWebModel({
    seed,
    width: 520,
    height: 320,
    columns: 48,
    rows: 30,
    ringCount: 5,
    spokeCount: 14,
    springTension: 0.42,
    damping: 0.965,
    pulseStrength: 95,
    resonance: 1.15,
  });
}

describe('JellyWebModel', () => {
  it('creates a deterministic spring web from the same seed', () => {
    const a = createModel(17);
    const b = createModel(17);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update advances nodes while keeping them bounded', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.nodeCount).toBeGreaterThan(0);
    expect(stats.edgeCount).toBeGreaterThan(stats.nodeCount);
    expect(stats.fieldMax).toBeGreaterThan(0);
    for (const node of model.nodeSnapshot()) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(520);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(320);
    }
  });

  it('tap gestures inject resonance energy', () => {
    const model = createModel();
    model.freezeForTest();
    const before = model.stats().meanSpeed;
    model.handleGesture({ kind: 'tap', x: 260, y: 160, timestamp: 0 });
    expect(model.stats().meanSpeed).toBeGreaterThan(before);
  });

  it('drag gestures shear the web', () => {
    const model = createModel();
    model.freezeForTest();
    model.handleGesture({ kind: 'drag', x: 260, y: 160, dx: 120, dy: -40, timestamp: 0 });
    expect(model.stats().meanSpeed).toBeGreaterThan(0);
  });

  it('detects stagnation and recovers with a stabilizing pulse', () => {
    const model = createModel();
    model.freezeForTest();
    expect(model.detectStagnation(3).stagnant).toBe(true);
    model.stabilize();
    expect(model.stats().meanSpeed).toBeGreaterThan(0);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('reset reproduces the same state for the same seed', () => {
    const a = createModel(99);
    const b = createModel(99);
    a.update(1 / 30);
    a.handleGesture({ kind: 'hold', x: 260, y: 160, timestamp: 3 });
    a.reset(99);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
