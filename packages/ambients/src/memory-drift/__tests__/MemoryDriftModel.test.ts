import { describe, expect, it } from 'vitest';
import { MemoryDriftModel } from '../MemoryDriftModel.js';

function createModel(seed = 616161) {
  return new MemoryDriftModel({
    seed,
    width: 640,
    height: 360,
    memoryCount: 36,
    moteCount: 96,
    maxBrightness: 0.5,
  });
}

describe('MemoryDriftModel', () => {
  it('creates deterministic memory fields from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected photo palette data into bounded normalized state', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'photos', timestamp: 0, values: { photoCount: 60, paletteEnergy: 0.82, warmth: 0.7, nostalgia: 0.64 } }]);
    const stats = model.stats();
    expect(stats.photoActivity).toBeCloseTo(0.5, 4);
    expect(stats.paletteEnergy).toBeCloseTo(0.82, 4);
    expect(stats.warmth).toBeCloseTo(0.7, 4);
    expect(stats.nostalgia).toBeCloseTo(0.64, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.5);
  });

  it('uses synthetic fallback when photo data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'synthetic', timestamp: 0, values: { phase: 0.2, intensity: 0.72, activity: 0.75, nostalgia: 0.66 } }]);
    const stats = model.stats();
    expect(stats.photoActivity).toBeGreaterThan(0.35);
    expect(stats.paletteEnergy).toBeGreaterThan(0.45);
    expect(stats.nostalgia).toBeCloseTo(0.66, 4);
  });

  it('updates particles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'photos', timestamp: 0, values: { photoCount: 96, paletteEnergy: 0.9, warmth: 0.62 } }]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.particles.length).toBeGreaterThan(36);
    expect(after.particles.length).toBeLessThanOrEqual(132);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.5);
    }
  });

  it('reduces motion, visible particles, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([{ source: 'photos', timestamp: 0, values: { photoCount: 96, paletteEnergy: 0.86, warmth: 0.7 } }]);
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

  it('applies live brightness, intensity, warmth, nostalgia, speed, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setPaletteWarmth(1);
    model.setNostalgia(1);
    model.setDriftSpeed(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
