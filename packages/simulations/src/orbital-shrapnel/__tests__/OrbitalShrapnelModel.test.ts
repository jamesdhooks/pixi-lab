import { describe, expect, it } from 'vitest';
import { OrbitalShrapnelModel } from '../OrbitalShrapnelModel.js';

function createModel(seed = 7319) {
  return new OrbitalShrapnelModel({
    seed,
    width: 640,
    height: 360,
    particleCount: 180,
    trailColumns: 48,
    trailRows: 27,
    planetRadius: 42,
    gravity: 1550,
    drag: 0.002,
  });
}

describe('OrbitalShrapnelModel', () => {
  it('creates deterministic orbital debris from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update advances orbital angles and deposits bounded trails', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    const stats = model.stats();
    expect(stats.particleCount).toBe(180);
    expect(stats.trailMax).toBeGreaterThan(0);
    expect(stats.meanSpeed).toBeGreaterThan(0);
    expect(stats.meanRadius).toBeGreaterThan(42);
  });

  it('drag gestures swish nearby debris and increase kinetic energy', () => {
    const model = createModel();
    const before = model.stats().kineticEnergy;
    model.handleGesture({ kind: 'drag', x: 360, y: 180, dx: 120, dy: -45, timestamp: 0 });
    expect(model.stats().kineticEnergy).toBeGreaterThan(before);
  });

  it('hold gestures create a temporary gravity well that bends debris', () => {
    const model = createModel();
    const before = model.stats().gravityWellCount;
    model.handleGesture({ kind: 'hold', x: 500, y: 210, timestamp: 0 });
    expect(model.stats().gravityWellCount).toBeGreaterThan(before);
    model.update(1 / 10);
    expect(model.stats().meanSpeed).toBeGreaterThan(0);
  });

  it('fast swipes trigger shockwaves without unbounded particle growth', () => {
    const model = createModel();
    model.handleGesture({ kind: 'fast_swipe', x: 320, y: 180, dx: 260, dy: 30, velocity: 2.6, timestamp: 0 });
    const stats = model.stats();
    expect(stats.shockwaveCount).toBeGreaterThan(0);
    expect(stats.particleCount).toBe(180);
  });

  it('detects collapsed low-energy rings and stabilizes them', () => {
    const model = createModel();
    model.collapseForTest();
    const report = model.detectStagnation(3);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.kineticEnergy).toBeGreaterThan(0);
    expect(stats.radialVariance).toBeGreaterThan(1);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('reset reproduces the same state for the same seed', () => {
    const a = createModel(101);
    const b = createModel(101);
    a.update(1 / 20);
    a.handleGesture({ kind: 'drag', x: 320, y: 180, dx: 80, dy: 12, timestamp: 1 });
    a.reset(101);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
