import { describe, expect, it } from 'vitest';
import { SnowfallModel } from '../SnowfallModel.js';

function createModel(seed = 2026) {
  return new SnowfallModel({
    seed,
    width: 640,
    height: 360,
    flakeCount: 160,
    maxBrightness: 0.58,
  });
}

describe('SnowfallModel', () => {
  it('creates deterministic flakes from the same seed', () => {
    const a = createModel(44);
    const b = createModel(44);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected weather data into bounded overlay state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'weather',
        timestamp: 0,
        values: { temperatureC: -8, snow: 82, windKph: 36 },
      },
    ]);
    const stats = model.stats();
    expect(stats.temperatureC).toBe(-8);
    expect(stats.precipitation).toBeCloseTo(0.82, 4);
    expect(stats.wind).toBeGreaterThanOrEqual(0);
    expect(stats.wind).toBeLessThanOrEqual(1);
    expect(stats.brightness).toBeLessThanOrEqual(0.58);
  });

  it('uses synthetic fallback when weather data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.18, intensity: 0.75 } },
    ]);
    const stats = model.stats();
    expect(stats.precipitation).toBeGreaterThan(0.18);
    expect(stats.temperatureC).toBeLessThanOrEqual(0);
    expect(stats.wind).toBeGreaterThanOrEqual(0);
    expect(stats.wind).toBeLessThanOrEqual(1);
  });

  it('updates flakes without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { precipitation: 0.9, wind: 28, temperatureC: -4 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.flakes.length).toBeGreaterThan(64);
    expect(after.flakes.length).toBeLessThanOrEqual(160);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.58);
    }
  });

  it('reduces visible flakes, brightness, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { precipitation: 0.85, wind: 24, temperatureC: -7 } },
    ]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.flakeCount).toBeLessThan(normal.flakeCount);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.flakeCount).toBeLessThan(normal.flakeCount);
  });

  it('applies live brightness, wind, drift, intensity, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.2);
    model.setGlobalIntensity(1);
    model.setWind(1);
    model.setDepthDrift(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.2);
    }
  });
});
