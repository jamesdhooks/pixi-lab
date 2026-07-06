import { describe, expect, it } from 'vitest';
import {
  ORBITAL_SHRAPNEL_DEFAULTS,
  ORBITAL_SHRAPNEL_SETTINGS_FIELDS,
} from '../orbital-shrapnel.config.js';

describe('orbital shrapnel promoted settings', () => {
  it('keeps the Pixi defaults in the enhanced-feeling orbital range', () => {
    expect(ORBITAL_SHRAPNEL_DEFAULTS.particleCount).toBeGreaterThanOrEqual(700);
    expect(ORBITAL_SHRAPNEL_DEFAULTS.resolution).toBeGreaterThanOrEqual(96);
    expect(ORBITAL_SHRAPNEL_DEFAULTS.gravity).toBeGreaterThanOrEqual(1800);
    expect(ORBITAL_SHRAPNEL_DEFAULTS.trailFade).toBeGreaterThanOrEqual(0.97);
    expect(ORBITAL_SHRAPNEL_DEFAULTS.debrisSize).toBeGreaterThanOrEqual(0.7);
    expect(ORBITAL_SHRAPNEL_DEFAULTS.trailGamma).toBeLessThanOrEqual(0.32);
  });

  it('matches visible field defaults with runtime config defaults', () => {
    for (const field of ORBITAL_SHRAPNEL_SETTINGS_FIELDS) {
      if (field.advanced || field.visibleQualities?.includes('raw')) continue;
      expect(field.default).toBe(ORBITAL_SHRAPNEL_DEFAULTS[field.key]);
    }
  });

  it('keeps raw-only controls advanced and hidden from the promoted Pixi settings', () => {
    const rawFields = ORBITAL_SHRAPNEL_SETTINGS_FIELDS.filter((field) =>
      field.visibleQualities?.includes('raw') || field.visibleEngineConfigurations?.includes('raw'),
    );

    expect(rawFields.map((field) => field.key)).toEqual([
      'rawParticleTextureSize',
      'rawTrailTextureWidth',
      'rawMaxSpeed',
      'bloomStrength',
      'streakStrength',
    ]);
    expect(rawFields.every((field) => field.advanced)).toBe(true);
  });
});
