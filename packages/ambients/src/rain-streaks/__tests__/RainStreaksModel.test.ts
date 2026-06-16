import { describe, expect, it } from 'vitest';
import { RainStreaksModel } from '../RainStreaksModel.js';

function createModel(seed = 2026) {
  return new RainStreaksModel({
    seed,
    width: 640,
    height: 360,
    streakCount: 180,
    maxBrightness: 0.56,
  });
}

describe('RainStreaksModel', () => {
  it('creates deterministic streaks from the same seed', () => {
    const a = createModel(88);
    const b = createModel(88);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected weather data into bounded overlay state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'weather',
        timestamp: 0,
        values: { rain: 78, windKph: 41, humidity: 86 },
      },
    ]);
    const stats = model.stats();
    expect(stats.precipitation).toBeCloseTo(0.78, 4);
    expect(stats.humidity).toBeCloseTo(0.86, 4);
    expect(stats.wind).toBeGreaterThanOrEqual(0);
    expect(stats.wind).toBeLessThanOrEqual(1);
    expect(stats.brightness).toBeLessThanOrEqual(0.56);
  });

  it('uses synthetic fallback when weather data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.28, intensity: 0.72 } },
    ]);
    const stats = model.stats();
    expect(stats.precipitation).toBeGreaterThan(0.2);
    expect(stats.humidity).toBeGreaterThan(0.45);
    expect(stats.wind).toBeGreaterThanOrEqual(0);
    expect(stats.wind).toBeLessThanOrEqual(1);
  });

  it('updates streaks without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { precipitation: 0.92, wind: 30, humidity: 0.8 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.streaks.length).toBeGreaterThan(70);
    expect(after.streaks.length).toBeLessThanOrEqual(180);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.velocity.y).toBeGreaterThan(0);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.56);
    }
  });

  it('reduces visible streaks, brightness, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { precipitation: 0.88, wind: 24, humidity: 0.9 } },
    ]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.streakCount).toBeLessThan(normal.streakCount);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.streakCount).toBeLessThan(normal.streakCount);
  });

  it('applies live brightness, wind, speed, trail, intensity, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setWind(1);
    model.setSpeed(1);
    model.setTrailLength(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.velocity.y).toBeGreaterThan(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
