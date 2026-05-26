import { describe, expect, it } from 'vitest';
import { TimeEchoModel } from '../TimeEchoModel.js';

function createModel(seed = 880421) {
  return new TimeEchoModel({
    seed,
    width: 640,
    height: 360,
    particleCount: 180,
    trailColumns: 48,
    trailRows: 27,
    historyLength: 34,
    echoDelay: 10,
    memoryPull: 1.15,
    trailFade: 0.962,
    drag: 0.012,
  });
}

describe('TimeEchoModel', () => {
  it('creates deterministic particle histories from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('update advances particles and deposits bounded echo trails', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    const stats = model.stats();
    expect(stats.particleCount).toBe(180);
    expect(stats.historyLength).toBe(34);
    expect(stats.trailMax).toBeGreaterThan(0);
    expect(stats.meanSpeed).toBeGreaterThan(0);
  });

  it('tap gestures create temporary time anchors', () => {
    const model = createModel();
    const before = model.stats().anchorCount;
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 0 });
    expect(model.stats().anchorCount).toBeGreaterThan(before);
  });

  it('hold and fast swipe gestures are no longer user-facing effects', () => {
    const model = createModel();
    model.handleGesture({ kind: 'hold', x: 320, y: 180, timestamp: 0 });
    model.handleGesture({ kind: 'fast_swipe', x: 320, y: 180, dx: 200, dy: 40, velocity: 2, timestamp: 16 });
    const stats = model.stats();
    expect(stats.freezeCount).toBe(0);
    expect(stats.anchorCount).toBe(0);
    expect(stats.particleCount).toBe(180);
  });

  it('drag gestures shear nearby histories and increase kinetic energy', () => {
    const model = createModel();
    const before = model.stats().kineticEnergy;
    model.handleGesture({ kind: 'drag', x: 320, y: 180, dx: 180, dy: -60, timestamp: 0 });
    expect(model.stats().kineticEnergy).toBeGreaterThan(before);
  });

  it('detects collapsed timelines and stabilizes them', () => {
    const model = createModel();
    model.collapseForTest();
    const report = model.detectStagnation(3);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.kineticEnergy).toBeGreaterThan(0);
    expect(stats.echoSeparation).toBeGreaterThan(0);
    expect(model.detectStagnation(1 / 60).stagnant).toBe(false);
  });

  it('reset reproduces state for the same seed', () => {
    const a = createModel(101);
    const b = createModel(101);
    a.update(1 / 20);
    a.handleGesture({ kind: 'drag', x: 300, y: 160, dx: 260, dy: 30, timestamp: 1 });
    a.reset(101);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
