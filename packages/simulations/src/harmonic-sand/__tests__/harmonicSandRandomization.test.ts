import type { SettingsValue } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { HARMONIC_PREVIEW_PROFILES, randomizeHarmonicSandSettings } from '../harmonicSandRandomization.js';

describe('harmonicSandRandomization', () => {
  it('keeps preview randomization complete but capped for tile performance', () => {
    const settings = new Map<string, SettingsValue>();

    randomizeHarmonicSandSettings(
      {
        applySetting: (key, value) => settings.set(key, value),
        applyNumericSetting: (key, value) => settings.set(key, value),
      },
      HARMONIC_PREVIEW_PROFILES,
    );

    expect([...settings.keys()]).toEqual(expect.arrayContaining([
      'renderStyle',
      'resolution',
      'baseFrequency',
      'wavePeriod',
      'rawParticleCount',
      'rawParticleDensity',
      'rawEmitterLimit',
      'rawLineSharpness',
      'rawGlow',
    ]));
    expect(settings.get('resolution')).toSatisfy((value: SettingsValue) => typeof value === 'number' && value >= 32 && value <= 352);
    expect(settings.get('rawParticleCount')).toSatisfy((value: SettingsValue) => typeof value === 'number' && value >= 25_000 && value <= 140_000);
    expect(settings.get('rawEmitterLimit')).toSatisfy((value: SettingsValue) => typeof value === 'number' && value >= 1 && value <= 6);
  });
});
