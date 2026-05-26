import { describe, expect, it } from 'vitest';
import { AntSignalModel } from '../AntSignalModel.js';

const makeModel = (seed = 42) => new AntSignalModel({ seed, width: 800, height: 450, columns: 64, rows: 36, antCount: 90, foodCount: 4, pheromoneDecay: 0.982 });

describe('AntSignalModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = makeModel(7);
    const b = makeModel(7);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('advances ant positions and lays bounded pheromone trails', () => {
    const model = makeModel(9);
    const before = model.snapshot();
    for (let i = 0; i < 12; i++) model.update(1 / 60);
    expect(model.snapshot()).not.toEqual(before);
    const stats = model.stats();
    expect(stats.antCount).toBe(90);
    expect(stats.trailMax).toBeGreaterThan(0);
    expect(stats.trailMax).toBeLessThanOrEqual(1);
  });

  it('tap and drag gestures add food sources', () => {
    const model = makeModel(11);
    const beforeFood = model.stats().foodCount;
    model.handleGesture({ kind: 'tap', x: 400, y: 225, timestamp: 0 });
    model.handleGesture({ kind: 'drag', x: 420, y: 230, dx: 80, dy: 12, timestamp: 16 });
    expect(model.stats().foodCount).toBeGreaterThan(beforeFood);
    model.update(1 / 30);
    const stats = model.stats();
    expect(stats.foodSignalMax).toBeGreaterThan(0);
    expect(stats.trailMax).toBeGreaterThan(0);
  });

  it('fast swipe wipes trails without growing unbounded state', () => {
    const model = makeModel(13);
    model.handleGesture({ kind: 'drag', x: 300, y: 180, dx: 120, dy: 0, timestamp: 0 });
    for (let i = 0; i < 10; i++) model.update(1 / 30);
    const before = model.stats().trailTotal;
    model.handleGesture({ kind: 'fast_swipe', x: 320, y: 180, dx: 200, dy: 0, velocity: 2.4, timestamp: 40 });
    const after = model.stats();
    expect(after.trailTotal).toBeLessThan(before);
    expect(after.antCount).toBe(90);
  });

  it('detects and recovers from stagnation', () => {
    const model = makeModel(15);
    model.drainForTest();
    expect(model.detectStagnation(1.3).stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.foodCount).toBeGreaterThan(0);
    expect(stats.trailMax).toBeGreaterThan(0);
  });

  it('soft reset reproduces a seed', () => {
    const model = makeModel(17);
    model.update(1 / 30);
    model.reset(23);
    const first = model.snapshot();
    model.update(1 / 20);
    model.reset(23);
    expect(model.snapshot()).toEqual(first);
  });
});
