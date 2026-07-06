import type { GestureEvent, SettingsValue, SimAIContext } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { ORBITAL_SHRAPNEL_SETTINGS_FIELDS } from '../orbital-shrapnel.config.js';
import { OrbitalShrapnelDemoAI } from '../OrbitalShrapnelDemoAI.js';

const EXPECTED_KEYS = ORBITAL_SHRAPNEL_SETTINGS_FIELDS.map((field) => field.key);

function createContext(settings: Map<string, SettingsValue>, isPreview = false): SimAIContext {
  const gestures: GestureEvent[] = [];
  return {
    width: 1024,
    height: 768,
    dt: 0,
    elapsedTime: 0,
    isPreview,
    styleIds: ['realistic', 'solar-debris', 'ink-paper'],
    applyStyle: (styleId) => settings.set('style', styleId),
    applySetting: (key, value) => settings.set(key, value),
    applyNumericSetting: (key, value) => settings.set(key, value),
    pushGestures: (nextGestures) => gestures.push(...nextGestures),
    resetScene: () => undefined,
    clearEmittersOnly: () => undefined,
  };
}

describe('OrbitalShrapnelDemoAI', () => {
  it('randomizes every Orbital Shrapnel settings field on activation', () => {
    const settings = new Map<string, SettingsValue>();
    const ai = new OrbitalShrapnelDemoAI();

    ai.onActivate(createContext(settings));

    expect([...settings.keys()]).toEqual(expect.arrayContaining(EXPECTED_KEYS.concat(['style'])));
    expect(typeof settings.get('rawParticleTextureSize')).toBe('string');

    for (const field of ORBITAL_SHRAPNEL_SETTINGS_FIELDS) {
      const value = settings.get(field.key);
      expect(value).toBeDefined();
      if (field.type === 'number') {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(field.min ?? Number.NEGATIVE_INFINITY);
        expect(value).toBeLessThanOrEqual(field.max ?? Number.POSITIVE_INFINITY);
      } else if (field.type === 'boolean') {
        expect(typeof value).toBe('boolean');
      } else if (field.type === 'select') {
        const options = field.options?.map((option) => option.value) ?? [];
        expect(typeof value).toBe('string');
        expect(options.includes(String(value))).toBe(true);
      }
    }

    const style = settings.get('style');
    expect(typeof style).toBe('string');
    expect(['realistic', 'solar-debris', 'ink-paper']).toContain(style);
  });

  it('caps raw particle texture size in lite preview mode', () => {
    const settings = new Map<string, SettingsValue>();
    const ai = new OrbitalShrapnelDemoAI({
      liteMode: true,
      rawParticleTextureSizeMax: 256,
    });
    const previewDensityOptions = ORBITAL_SHRAPNEL_SETTINGS_FIELDS.find((field) => field.key === 'rawParticleTextureSize')
      ?.options
      ?.filter((option) => Number(option.value) <= 256)
      .map((option) => option.value);
    expect(previewDensityOptions?.length).toBeGreaterThan(0);

    for (let i = 0; i < 16; i += 1) {
      ai.onActivate(createContext(settings, true));
      const value = Number(settings.get('rawParticleTextureSize'));
      expect(previewDensityOptions).toContain(String(value));
    }
  });
});
