import { describe, expect, it } from 'vitest';
import { EmbersModel } from '../EmbersModel.js';

function createModel(seed = 2026) {
  return new EmbersModel({
    seed,
    width: 640,
    height: 360,
    emberCount: 160,
    maxBrightness: 0.62,
  });
}

describe('EmbersModel', () => {
  it('creates deterministic embers from the same seed', () => {
    const a = createModel(44);
    const b = createModel(44);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected home data into bounded cozy overlay state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'homeAssistant',
        timestamp: 0,
        values: { fireplace: 86, temperatureC: 23 },
      },
    ]);
    const stats = model.stats();
    expect(stats.heat).toBeGreaterThan(0.6);
    expect(stats.heat).toBeLessThanOrEqual(1);
    expect(stats.activity).toBeGreaterThanOrEqual(0);
    expect(stats.activity).toBeLessThanOrEqual(1);
    expect(stats.brightness).toBeLessThanOrEqual(0.62);
  });

  it('uses synthetic fallback when home and weather data are unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.18, intensity: 0.75 } },
    ]);
    const stats = model.stats();
    expect(stats.heat).toBeGreaterThan(0.25);
    expect(stats.activity).toBeGreaterThan(0.2);
    expect(stats.activity).toBeLessThanOrEqual(1);
  });

  it('updates embers without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { temperatureC: -6, windKph: 34 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.embers.length).toBeGreaterThan(48);
    expect(after.embers.length).toBeLessThanOrEqual(160);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.62);
    }
  });

  it('reduces visible embers, brightness, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'homeAssistant', timestamp: 0, values: { heat: 0.9 } },
    ]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.emberCount).toBeLessThan(normal.emberCount);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.emberCount).toBeLessThan(normal.emberCount);
  });

  it('applies live brightness, heat, updraft, intensity, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.2);
    model.setGlobalIntensity(1);
    model.setHeat(1);
    model.setUpdraft(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.2);
    }
  });
});
