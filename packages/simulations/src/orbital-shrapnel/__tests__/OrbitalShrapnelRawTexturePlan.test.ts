import { describe, expect, it } from 'vitest';
import { resolveOrbitalShrapnelRawTexturePlan } from '../OrbitalShrapnelRawTexturePlan.js';

describe('OrbitalShrapnelRawTexturePlan', () => {
  it('keeps raw particle and trail textures bounded while preserving viewport aspect', () => {
    const plan = resolveOrbitalShrapnelRawTexturePlan({
      width: 1920,
      height: 1080,
      quality: 'raw',
      particleCount: 20_000,
      trailColumns: 192,
    });

    expect(plan.particleState.width).toBe(256);
    expect(plan.particleState.height).toBe(79);
    expect(plan.particleState.capacity).toBeGreaterThanOrEqual(20_000);
    expect(plan.particleState.capacity).toBeLessThanOrEqual(256 * 128);
    expect(plan.trailField).toEqual({ width: 320, height: 180 });
  });

  it('uses smaller budgets for non-raw qualities so raw-sized uploads cannot leak', () => {
    const basic = resolveOrbitalShrapnelRawTexturePlan({
      width: 1920,
      height: 1080,
      quality: 'basic',
      particleCount: 20_000,
      trailColumns: 192,
    });
    const enhanced = resolveOrbitalShrapnelRawTexturePlan({
      width: 1920,
      height: 1080,
      quality: 'enhanced',
      particleCount: 20_000,
      trailColumns: 192,
    });

    expect(basic.particleState).toEqual({ width: 128, height: 64, capacity: 8192 });
    expect(basic.trailField).toEqual({ width: 160, height: 90 });
    expect(enhanced.particleState).toEqual({ width: 192, height: 84, capacity: 16128 });
    expect(enhanced.trailField).toEqual({ width: 240, height: 135 });
  });

  it('falls back to minimum safe dimensions for invalid input', () => {
    expect(resolveOrbitalShrapnelRawTexturePlan({
      width: Number.NaN,
      height: 0,
      quality: 'raw',
      particleCount: -5,
      trailColumns: 0,
    })).toEqual({
      particleState: { width: 64, height: 1, capacity: 64 },
      trailField: { width: 64, height: 64 },
    });
  });
});
