import { describe, expect, it } from 'vitest';
import { CellularOceanModel, type CellularOceanModelOptions } from '../CellularOceanModel.js';

const makeOptions = (overrides: Partial<CellularOceanModelOptions> = {}): CellularOceanModelOptions => ({
  seed: 1234,
  width: 640,
  height: 360,
  columns: 64,
  rows: 36,
  cellCount: 8,
  membranePoints: 12,
  membraneTension: 0.42,
  viscosity: 0.965,
  pulseStrength: 90,
  driftStrength: 0.6,
  ...overrides,
});

describe('CellularOceanModel', () => {
  it('initializes deterministically from the same seed', () => {
    const a = new CellularOceanModel(makeOptions());
    const b = new CellularOceanModel(makeOptions());
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.stats().nodeCount).toBe(96);
  });

  it('advances membrane state over time', () => {
    const model = new CellularOceanModel(makeOptions());
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    expect(model.snapshot()).not.toEqual(before);
    expect(model.stats().fieldMax).toBeGreaterThan(0);
  });

  it('keeps fields and budgets bounded', () => {
    const model = new CellularOceanModel(makeOptions({ cellCount: 14, membranePoints: 18, columns: 80, rows: 45 }));
    for (let i = 0; i < 80; i++) model.update(1 / 60);
    const stats = model.stats();
    expect(stats.cellCount).toBe(14);
    expect(stats.nodeCount).toBe(252);
    expect(stats.edgeCount).toBe(504);
    expect(stats.fieldMax).toBeLessThanOrEqual(1);
  });

  it('responds to tap and drag gestures', () => {
    const model = new CellularOceanModel(makeOptions());
    const before = model.stats().meanSpeed;
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 1 });
    model.handleGesture({ kind: 'drag', x: 320, y: 180, dx: 80, dy: -40, timestamp: 2 });
    expect(model.stats().meanSpeed).toBeGreaterThan(before);
  });

  it('detects and recovers from stagnation', () => {
    const model = new CellularOceanModel(makeOptions({ driftStrength: 0.05 }));
    model.freezeForTest();
    let report = model.detectStagnation(0.75);
    report = model.detectStagnation(0.75);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    expect(model.stats().meanSpeed).toBeGreaterThan(0);
  });

  it('soft reset with the same seed reproduces the same state', () => {
    const model = new CellularOceanModel(makeOptions());
    const first = model.snapshot();
    model.update(1 / 10);
    model.reset(1234);
    expect(model.snapshot()).toEqual(first);
  });

  it('live setters affect future dynamics without rebuilding', () => {
    const model = new CellularOceanModel(makeOptions());
    model.setMembraneTension(0.8);
    model.setViscosity(0.92);
    model.setPulseStrength(140);
    model.setDriftStrength(1.1);
    model.handleGesture({ kind: 'fast_swipe', x: 200, y: 180, dx: 180, dy: 20, timestamp: 3 });
    model.update(1 / 30);
    expect(model.stats().meanSpeed).toBeGreaterThan(0.5);
  });
});
