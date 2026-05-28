import { describe, expect, it } from 'vitest';
import { HomeWeatherGlassModel } from '../HomeWeatherGlassModel.js';

function createModel(seed = 1776) {
  return new HomeWeatherGlassModel({
    seed,
    width: 640,
    height: 360,
    dropletCount: 128,
    maxBrightness: 0.58,
  });
}

describe('HomeWeatherGlassModel', () => {
  it('creates deterministic weather glass droplets from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected weather data into bounded normalized state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'weather',
        timestamp: 0,
        values: { temperatureC: 4, humidity: 82, precipitation: 65, cloudCover: 74, windKph: 32 },
      },
    ]);
    const stats = model.stats();
    expect(stats.temperatureC).toBe(4);
    expect(stats.humidity).toBeCloseTo(0.82, 4);
    expect(stats.precipitation).toBeCloseTo(0.65, 4);
    expect(stats.cloudCover).toBeCloseTo(0.74, 4);
    expect(stats.wind).toBeCloseTo(0.5, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.58);
  });

  it('uses synthetic fallback when live weather data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.2, intensity: 0.7 } },
    ]);
    const stats = model.stats();
    expect(stats.humidity).toBeGreaterThan(0.45);
    expect(stats.precipitation).toBeGreaterThan(0.12);
    expect(stats.cloudCover).toBeGreaterThanOrEqual(0);
    expect(stats.cloudCover).toBeLessThanOrEqual(1);
  });

  it('updates droplets without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { precipitation: 0.9, humidity: 0.8, wind: 18 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.droplets.length).toBeGreaterThan(64);
    expect(after.droplets.length).toBeLessThanOrEqual(128);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.58);
    }
  });

  it('reduces motion, visible droplets, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { precipitation: 0.8, humidity: 0.7, wind: 24 } },
    ]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.dropletCount).toBeLessThan(normal.dropletCount);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.dropletCount).toBeLessThan(normal.dropletCount);
  });

  it('applies live brightness, blur, intensity, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setGlassBlur(1);
    model.resize(320, 180);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
