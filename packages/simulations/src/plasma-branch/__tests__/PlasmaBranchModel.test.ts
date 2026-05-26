import { describe, expect, it } from 'vitest';
import { PlasmaBranchModel } from '../PlasmaBranchModel.js';

const makeModel = (seed = 4242) => new PlasmaBranchModel({
  seed,
  width: 640,
  height: 360,
  columns: 48,
  rows: 27,
  maxBranches: 220,
  chargeDecay: 0.982,
});

describe('PlasmaBranchModel', () => {
  it('initializes deterministically from the same seed', () => {
    expect(makeModel(7).snapshot()).toEqual(makeModel(7).snapshot());
  });

  it('advances charge and branch state over time', () => {
    const model = makeModel();
    const before = model.stats();
    for (let i = 0; i < 12; i++) model.update(1 / 60);
    const after = model.stats();
    expect(after.totalCharge).not.toBe(before.totalCharge);
    expect(after.activeBranchCount).toBeGreaterThanOrEqual(before.activeBranchCount);
    expect(after.scarMax).toBeGreaterThan(0);
  });

  it('tap and drag gestures add plasma branches', () => {
    const model = makeModel();
    model.handleGesture({ kind: 'tap', x: 320, y: 180, timestamp: 0 });
    const afterTap = model.stats();
    model.handleGesture({ kind: 'drag', x: 360, y: 190, dx: 80, dy: 20, timestamp: 16 });
    const afterGestures = model.stats();
    expect(afterGestures.totalCharge).toBeGreaterThan(afterTap.totalCharge);
    expect(afterGestures.branchCount).toBeGreaterThan(afterTap.branchCount);
  });

  it('detects a low-energy stagnant state and stabilize injects new arcs', () => {
    const model = makeModel();
    model.drainForTest();
    let report = model.detectStagnation(1.4);
    report = model.detectStagnation(1.4);
    expect(report.stagnant).toBe(true);
    model.stabilize();
    const stats = model.stats();
    expect(stats.totalCharge).toBeGreaterThan(0.5);
    expect(stats.branchCount).toBeGreaterThan(0);
  });

  it('soft reset with a seed reproduces state', () => {
    const model = makeModel(9);
    model.update(1 / 30);
    model.reset(99);
    const first = model.snapshot();
    model.update(1 / 30);
    model.reset(99);
    expect(model.snapshot()).toEqual(first);
  });
});
