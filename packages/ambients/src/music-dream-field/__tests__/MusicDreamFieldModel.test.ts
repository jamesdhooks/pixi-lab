import { describe, expect, it } from 'vitest';
import { MusicDreamFieldModel } from '../MusicDreamFieldModel.js';

function createModel(seed = 3030) {
  return new MusicDreamFieldModel({
    seed,
    width: 640,
    height: 360,
    orbCount: 128,
    ribbonCount: 36,
    maxBrightness: 0.58,
  });
}

describe('MusicDreamFieldModel', () => {
  it('creates deterministic orbs and ribbons from the same seed', () => {
    const a = createModel(11);
    const b = createModel(11);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps media beat data into bounded ambient state', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'media', timestamp: 0, values: { beat: 82, spectralFlux: 64, bpm: 128 } },
    ]);
    const stats = model.stats();
    expect(stats.beatEnergy).toBeCloseTo(0.82 * (0.35 + 0.68 * 0.85), 4);
    expect(stats.spectralFlux).toBeCloseTo(0.64, 4);
    expect(stats.bpm).toBe(128);
    expect(stats.brightness).toBeLessThanOrEqual(0.58);
  });

  it('uses synthetic fallback beat data when live media is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.5, beat: 0.48, flux: 0.52, bpm: 88 } },
    ]);
    const stats = model.stats();
    expect(stats.beatEnergy).toBeCloseTo(0.48 * (0.35 + 0.68 * 0.85), 4);
    expect(stats.spectralFlux).toBeCloseTo(0.52, 4);
    expect(stats.bpm).toBe(88);
  });

  it('updates particles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel(33);
    model.setSleepMode(false);
    model.setDriftStrength(0.9);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.58);
    }
  });

  it('reduces brightness, visible particles, and motion in sleep or low-motion modes', () => {
    const model = createModel();
    model.setSleepMode(false);
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

  it('applies live intensity, brightness, sensitivity, drift, and resize controls', () => {
    const model = createModel(77);
    model.setSleepMode(false);
    model.setGlobalIntensity(1);
    model.setMaxBrightness(0.24);
    model.setBeatSensitivity(1);
    model.setDriftStrength(1);
    model.resize(320, 180);
    const stats = model.stats();
    expect(stats.beatEnergy).toBeGreaterThan(0);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.24);
    }
  });
});
