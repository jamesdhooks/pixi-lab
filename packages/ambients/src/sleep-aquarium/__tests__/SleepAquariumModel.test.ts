import { describe, expect, it } from 'vitest';
import { SleepAquariumModel } from '../SleepAquariumModel.js';

function createModel(seed = 2027) {
  return new SleepAquariumModel({
    seed,
    width: 640,
    height: 360,
    fishCount: 96,
    bubbleCount: 72,
    maxBrightness: 0.5,
  });
}

describe('SleepAquariumModel', () => {
  it('creates deterministic fish and bubble particles from the same seed', () => {
    const a = createModel(11);
    const b = createModel(11);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps time and synthetic sleep data into bounded ambient state', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'time', timestamp: 0, values: { hour: 23 } },
      { source: 'synthetic', timestamp: 0, values: { intensity: 82, sleepMode: true } },
    ]);
    const stats = model.stats();
    expect(stats.circadianPhase).toBeCloseTo(23 / 24, 4);
    expect(stats.dreamIntensity).toBeCloseTo(0.82, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.5);
    expect(stats.motionScale).toBeLessThan(0.4);
  });

  it('uses synthetic fallback phase when live time data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.88, intensity: 0.64 } },
    ]);
    const stats = model.stats();
    expect(stats.circadianPhase).toBeCloseTo(0.88, 4);
    expect(stats.dreamIntensity).toBeCloseTo(0.64, 4);
  });

  it('updates particles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel(33);
    model.setSleepMode(false);
    model.setCurrentStrength(0.9);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.5);
    }
  });

  it('reduces brightness, visible particles, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.setSleepMode(false);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.visibleParticles).toBeLessThan(normal.visibleParticles);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.visibleParticles).toBeLessThan(normal.visibleParticles);
  });

  it('applies live intensity, brightness, current, and resize controls', () => {
    const model = createModel(77);
    model.setSleepMode(false);
    model.setGlobalIntensity(1);
    model.setMaxBrightness(0.22);
    model.setCurrentStrength(1);
    model.resize(320, 180);
    const stats = model.stats();
    expect(stats.currentStrength).toBe(1);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
