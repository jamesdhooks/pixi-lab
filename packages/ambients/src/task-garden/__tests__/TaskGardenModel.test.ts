import { describe, expect, it } from 'vitest';
import { TaskGardenModel } from '../TaskGardenModel.js';

function createModel(seed = 424242) {
  return new TaskGardenModel({
    seed,
    width: 640,
    height: 360,
    plantCount: 72,
    sparkleCount: 36,
    maxBrightness: 0.56,
  });
}

describe('TaskGardenModel', () => {
  it('creates deterministic gardens from the same seed', () => {
    const a = createModel(42);
    const b = createModel(42);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('maps injected task and calendar data into bounded normalized state', () => {
    const model = createModel();
    model.applyAmbientData([
      {
        source: 'tasks',
        timestamp: 0,
        values: { open: 16, dueSoon: 6, overdue: 2, completedToday: 9, recurring: 4 },
      },
      {
        source: 'calendar',
        timestamp: 0,
        values: { upcoming: 3 },
      },
    ]);
    const stats = model.stats();
    expect(stats.openTasks).toBeCloseTo(0.5, 4);
    expect(stats.dueSoon).toBeCloseTo(0.5, 4);
    expect(stats.overdue).toBeCloseTo(0.25, 4);
    expect(stats.completed).toBeCloseTo(0.5, 4);
    expect(stats.recurring).toBeCloseTo(0.4, 4);
    expect(stats.brightness).toBeLessThanOrEqual(0.56);
  });

  it('uses synthetic fallback when organizer data is unavailable', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'synthetic', timestamp: 0, values: { phase: 0.2, intensity: 0.72, activity: 0.75, completed: 0.6 } },
    ]);
    const stats = model.stats();
    expect(stats.openTasks).toBeGreaterThan(0.35);
    expect(stats.dueSoon).toBeGreaterThanOrEqual(0);
    expect(stats.dueSoon).toBeLessThanOrEqual(1);
    expect(stats.completed).toBeCloseTo(0.6, 4);
  });

  it('updates plants and sparkles without exceeding canvas bounds or brightness caps', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'tasks', timestamp: 0, values: { open: 24, dueSoon: 9, overdue: 3, completed: 12, recurring: 5 } },
    ]);
    const before = model.snapshot();
    model.update(1 / 30);
    model.update(1 / 30);
    const after = model.snapshot();
    expect(after).not.toEqual(before);
    expect(after.particles.length).toBeGreaterThan(24);
    expect(after.particles.length).toBeLessThanOrEqual(108);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeGreaterThanOrEqual(0);
      expect(particle.position.x).toBeLessThanOrEqual(640);
      expect(particle.position.y).toBeGreaterThanOrEqual(0);
      expect(particle.position.y).toBeLessThanOrEqual(360);
      expect(particle.alpha).toBeGreaterThanOrEqual(0);
      expect(particle.alpha).toBeLessThanOrEqual(0.56);
    }
  });

  it('reduces motion, visible particles, and brightness in sleep or low-motion modes', () => {
    const model = createModel();
    model.applyAmbientData([
      { source: 'tasks', timestamp: 0, values: { open: 26, dueSoon: 8, overdue: 2, completed: 11, recurring: 4 } },
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

  it('applies live brightness, intensity, urgency, growth, completion, and resize controls', () => {
    const model = createModel(55);
    model.setMaxBrightness(0.22);
    model.setGlobalIntensity(1);
    model.setUrgencySensitivity(1);
    model.setGrowthRate(1);
    model.setCompletionGlow(1);
    model.resize(320, 180);
    model.update(1 / 30);
    for (const particle of model.renderParticles()) {
      expect(particle.position.x).toBeLessThanOrEqual(320);
      expect(particle.position.y).toBeLessThanOrEqual(180);
      expect(particle.alpha).toBeLessThanOrEqual(0.22);
    }
  });
});
