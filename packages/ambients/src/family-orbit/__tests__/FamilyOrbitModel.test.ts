import { describe, expect, it } from 'vitest';
import { FamilyOrbitModel } from '../FamilyOrbitModel.js';

function createModel(seed = 515151) {
  return new FamilyOrbitModel({
    seed,
    width: 640,
    height: 360,
    memberCount: 7,
    cometCount: 42,
    maxBrightness: 0.54,
  });
}

describe('FamilyOrbitModel', () => {
  it('creates deterministic orbits from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected presence and calendar data into bounded normalized state', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'presence', timestamp: 0, values: { peopleHome: 4, peopleAway: 1, activity: 6, closeness: 0.72 } },
      { source: 'calendar', timestamp: 0, values: { events: 5 } },
    ]);
    const stats = model.stats();
    expect(stats.peopleHome).toBeCloseTo(4 / 7 - 1 / 7 * 0.18, 4);
    expect(stats.activity).toBeCloseTo(0.6, 4);
    expect(stats.closeness).toBeCloseTo(0.72, 4);
    expect(stats.calendarLoad).toBeCloseTo(5 / 12, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.54);
  });

  it('uses synthetic fallback when presence data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'synthetic', timestamp: 0, values: { phase: 0.2, intensity: 0.72, activity: 0.75, closeness: 0.66 } }]);
    const stats = model.stats();
    expect(stats.peopleHome).toBeGreaterThan(0.35);
    expect(stats.activity).toBeGreaterThan(0.45);
    expect(stats.closeness).toBeCloseTo(0.66, 4);
  });

  it('updates particles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'presence', timestamp: 0, values: { peopleHome: 5, activity: 8, closeness: 0.7 } }]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.particles.length).toBeGreaterThan(7);
    expect(after.particles.length).toBeLessThanOrEqual(49);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.54);
    }
  });

  it('reduces motion, visible particles, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'presence', timestamp: 0, values: { peopleHome: 5, activity: 8, closeness: 0.74 } }]);
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

  it('applies live brightness, intensity, closeness, pulse, speed, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setCloseness(1);
    model.setActivityPulse(1);
    model.setOrbitSpeed(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
