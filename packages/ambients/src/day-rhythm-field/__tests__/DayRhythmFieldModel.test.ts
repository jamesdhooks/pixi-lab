import { describe, expect, it } from 'vitest';
import { DayRhythmFieldModel } from '../DayRhythmFieldModel.js';

function createModel(seed = 1337) {
  return new DayRhythmFieldModel({
    seed,
    width: 640,
    height: 360,
    particleCount: 96,
    maxBrightness: 0.65,
  });
}

describe('DayRhythmFieldModel', () => {
  it('creates deterministic particles from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps time of day to a smooth phase and palette temperature', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'time', timestamp: 0, values: { hour: 6, minute: 0 } },
    ]);
    expect(model.stats().phase).toBeCloseTo(0.25, 4);
    const dawn = model.renderParticles()[0].color;

    model.applyAmbientData([
      { source: 'time', timestamp: 0, values: { hour: 18, minute: 0 } },
    ]);
    expect(model.stats().phase).toBeCloseTo(0.75, 4);
    expect(model.renderParticles()[0].color).not.toBe(dawn);
  });

  it('uses synthetic fallback phase when explicit time data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.4, intensity: 0.8 } },
    ]);
    expect(model.stats().phase).toBeCloseTo(0.4, 4);
    expect(model.stats().brightness).toBeLessThanOrEqual(0.65);
  });

  it('updates particles without exceeding bounds or budget', () => {
    const model = createModel();
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.particles).toHaveLength(96);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.65);
    }
  });

  it('reduces motion, particle output, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.setGlobalIntensity(1);
    const normal = model.stats();
    model.setSleepMode(true);
    const sleep = model.stats();
    expect(sleep.brightness).toBeLessThan(normal.brightness);
    expect(model.renderParticles().length).toBeLessThan(96);

    model.setSleepMode(false);
    model.setLowMotion(true);
    model.update(1);
    const lowMotion = model.stats();
    expect(lowMotion.motionScale).toBeLessThan(normal.motionScale);
  });

  it('resizes deterministically while preserving particle budget', () => {
    const model = createModel(55);
    model.resize(320, 180);
    expect(model.renderParticles()).toHaveLength(96);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
    }
  });
});
