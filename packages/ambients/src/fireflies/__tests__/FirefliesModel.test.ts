import { describe, expect, it } from 'vitest';
import { FirefliesModel } from '../FirefliesModel.js';

function createModel(seed = 20260704) {
  return new FirefliesModel({ seed, width: 640, height: 360, fireflyCount: 220, maxBrightness: 0.62 });
}

describe('FirefliesModel', () => {
  it('creates deterministic firefly fields from the same seed', () => {
    expect(createModel(42).snapshot()).toEqual(createModel(42).snapshot());
  });

  it('maps injected weather and time data into bounded normalized state', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { humidity: 80, cloudCover: 0.4 } },
      { source: 'time', timestamp: 0, values: { daylight: 0.1 } },
      { source: 'presence', timestamp: 0, values: { peopleHome: 4 } },
    ]);
    const stats = model.stats();
    expect(stats.humidity).toBeCloseTo(0.8, 4);
    expect(stats.night).toBeCloseTo(0.964, 3);
    expect(stats.meadow).toBeCloseTo(0.5, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.62);
  });

  it('uses synthetic fallback when weather data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'synthetic', timestamp: 0, values: { phase: 0.74, intensity: 0.72, daylight: 0.12 } }]);
    const stats = model.stats();
    expect(stats.humidity).toBeGreaterThan(0.45);
    expect(stats.night).toBeGreaterThan(0.5);
  });

  it('updates particles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'weather', timestamp: 0, values: { humidity: 0.9, cloudCover: 0.5 } }]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.fireflies.length).toBeGreaterThan(24);
    expect(after.fireflies.length).toBeLessThanOrEqual(220);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.62);
    }
  });

  it('reduces motion, visible particles, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'weather', timestamp: 0, values: { humidity: 0.9, cloudCover: 0.5 } }]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.fireflyCount).toBeLessThan(normal.fireflyCount);
    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.fireflyCount).toBeLessThan(normal.fireflyCount);
  });

  it('applies live brightness, intensity, glow, drift, meadow, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setGlow(1);
    model.setDrift(1);
    model.setMeadow(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
