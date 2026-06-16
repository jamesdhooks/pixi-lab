import { describe, expect, it } from 'vitest';
import { HousePulseMapModel } from '../HousePulseMapModel.js';

function createModel(seed = 8675309) {
  return new HousePulseMapModel({
    seed,
    width: 640,
    height: 360,
    nodeCount: 72,
    connectionCount: 96,
    maxBrightness: 0.54,
  });
}

describe('HousePulseMapModel', () => {
  it('creates deterministic house maps from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected home data into bounded normalized state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'homeAssistant',
        timestamp: 0,
        values: { occupancy: 75, energyUse: 44, eventRate: 0.62, securityState: 20 },
      },
    ]);
    const stats = model.stats();
    expect(stats.occupancy).toBeCloseTo(0.75, 4);
    expect(stats.energyUse).toBeCloseTo(0.44, 4);
    expect(stats.eventRate).toBeCloseTo(0.62, 4);
    expect(stats.securityState).toBeCloseTo(0.2, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.54);
  });

  it('uses synthetic fallback when live home data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.2, intensity: 0.7, activity: 0.8 } },
    ]);
    const stats = model.stats();
    expect(stats.occupancy).toBeGreaterThan(0.35);
    expect(stats.energyUse).toBeGreaterThan(0.35);
    expect(stats.eventRate).toBeGreaterThanOrEqual(0);
    expect(stats.eventRate).toBeLessThanOrEqual(1);
  });

  it('updates pulses without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'homeAssistant', timestamp: 0, values: { occupancy: 0.9, energyUse: 0.8, eventRate: 0.85, securityState: 0.4 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.particles.length).toBeGreaterThan(32);
    expect(after.particles.length).toBeLessThanOrEqual(168);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.54);
    }
  });

  it('reduces motion, visible pulses, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'homeAssistant', timestamp: 0, values: { occupancy: 0.8, energyUse: 0.7, eventRate: 0.75 } },
    ]);
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

  it('applies live brightness, intensity, sensitivity, speed, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setEventSensitivity(1);
    model.setPulseSpeed(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
