import { describe, expect, it } from 'vitest';
import { LeavesPollenModel } from '../LeavesPollenModel.js';

function createModel(seed = 2026) {
  return new LeavesPollenModel({
    seed,
    width: 640,
    height: 360,
    particleCount: 180,
    maxBrightness: 0.6,
  });
}

describe('LeavesPollenModel', () => {
  it('creates deterministic drifters from the same seed', () => {
    const a = createModel(88);
    const b = createModel(88);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected weather and time data into bounded seasonal state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'weather',
        timestamp: 0,
        values: { pollenIndex: 72, windKph: 36 },
      },
      {
        source: 'time',
        timestamp: 0,
        values: { seasonProgress: 0.83 },
      },
    ]);
    const stats = model.stats();
    expect(stats.pollen).toBeCloseTo(0.72, 4);
    expect(stats.seasonality).toBeCloseTo(0.83, 4);
    expect(stats.wind).toBeGreaterThanOrEqual(0);
    expect(stats.wind).toBeLessThanOrEqual(1);
    expect(stats.brightness).toBeLessThanOrEqual(0.6);
  });

  it('uses synthetic fallback when live seasonal data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.28, intensity: 0.72, pollen: 0.64 } },
    ]);
    const stats = model.stats();
    expect(stats.pollen).toBeCloseTo(0.64, 4);
    expect(stats.seasonality).toBeGreaterThan(0.35);
    expect(stats.wind).toBeGreaterThanOrEqual(0);
    expect(stats.wind).toBeLessThanOrEqual(1);
  });

  it('updates particles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { pollen: 0.88, wind: 28 } },
      { source: 'time', timestamp: 0, values: { seasonProgress: 0.76 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.particles.length).toBeGreaterThan(70);
    expect(after.particles.length).toBeLessThanOrEqual(180);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.velocity.y).toBeGreaterThan(0);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.6);
    }
  });

  it('reduces visible particles, brightness, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'weather', timestamp: 0, values: { pollen: 0.86, wind: 22 } },
      { source: 'time', timestamp: 0, values: { seasonProgress: 0.9 } },
    ]);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(sleep.particleCount).toBeLessThan(normal.particleCount);

    model.setSleepMode(false);
    model.setLowMotion(true);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
    expect(lowMotion.particleCount).toBeLessThan(normal.particleCount);
  });

  it('applies live brightness, breeze, speed, pollen mix, intensity, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setBreeze(1);
    model.setDriftSpeed(1);
    model.setPollenMix(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.velocity.y).toBeGreaterThan(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
      expect(particle.color).toBe(0xfef08a);
    }
  });
});
