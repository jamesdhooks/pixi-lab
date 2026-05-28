import { describe, expect, it } from 'vitest';
import { ConfettiModel } from '../ConfettiModel.js';

function createModel(seed = 2026) {
  return new ConfettiModel({
    seed,
    width: 640,
    height: 360,
    pieceCount: 180,
    maxBrightness: 0.66,
  });
}

describe('ConfettiModel', () => {
  it('creates deterministic confetti from the same seed', () => {
    const a = createModel(44);
    const b = createModel(44);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected task and calendar data into bounded celebration state', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'tasks', timestamp: 0, values: { completed: 86 } },
      { source: 'calendar', timestamp: 0, values: { celebration: 0.8 } },
    ]);
    const stats = model.stats();
    expect(stats.celebration).toBeGreaterThan(0.6);
    expect(stats.celebration).toBeLessThanOrEqual(1);
    expect(stats.brightness).toBeLessThanOrEqual(0.66);
  });

  it('uses synthetic fallback when task and calendar data are unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.18, intensity: 0.75 } },
    ]);
    const stats = model.stats();
    expect(stats.celebration).toBeGreaterThan(0.25);
    expect(stats.celebration).toBeLessThanOrEqual(1);
  });

  it('updates pieces without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'calendar', timestamp: 0, values: { eventPulse: 1 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.pieces.length).toBeGreaterThan(48);
    expect(after.pieces.length).toBeLessThanOrEqual(180);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.66);
    }
  });

  it('reduces visible pieces, brightness, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'tasks', timestamp: 0, values: { completion: 0.9 } },
    ]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.pieceCount).toBeLessThan(normal.pieceCount);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.pieceCount).toBeLessThan(normal.pieceCount);
  });

  it('applies live brightness, burst, gravity, spread, intensity, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.2);
    model.setGlobalIntensity(1);
    model.setBurst(1);
    model.setGravity(1);
    model.setSpread(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.2);
    }
  });
});
