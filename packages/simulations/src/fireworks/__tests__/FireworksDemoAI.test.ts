import type { GestureEvent, SettingsValue, SimAIContext } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { FIREWORKS_SETTINGS_FIELDS } from '../fireworks.config.js';
import { FireworksDemoAI } from '../FireworksDemoAI.js';

const EXPECTED_KEYS = FIREWORKS_SETTINGS_FIELDS.map((field) => field.key);

function createContext(settings: Map<string, SettingsValue>, isPreview = false): SimAIContext {
  const gestures: GestureEvent[] = [];
  return {
    width: 1024,
    height: 768,
    dt: 0,
    elapsedTime: 0,
    isPreview,
    styleIds: ['festival-night', 'gold-willow', 'neon-smoke'],
    applyStyle: (styleId) => settings.set('style', styleId),
    applySetting: (key, value) => settings.set(key, value),
    applyNumericSetting: (key, value) => settings.set(key, value),
    pushGestures: (nextGestures) => gestures.push(...nextGestures),
    resetScene: () => undefined,
    clearEmittersOnly: () => undefined,
  };
}

describe('FireworksDemoAI', () => {
  it('randomizes every fireworks setting and a style on activation', () => {
    const settings = new Map<string, SettingsValue>();
    const ai = new FireworksDemoAI();

    ai.onActivate(createContext(settings));

    expect([...settings.keys()]).toEqual(expect.arrayContaining(EXPECTED_KEYS.concat(['style'])));
    for (const field of FIREWORKS_SETTINGS_FIELDS) {
      const value = settings.get(field.key);
      expect(value).toBeDefined();
      if (field.type === 'number') {
        expect(typeof value).toBe('number');
        expect(value as number).toBeGreaterThanOrEqual(field.min ?? Number.NEGATIVE_INFINITY);
        expect(value as number).toBeLessThanOrEqual(field.max ?? Number.POSITIVE_INFINITY);
      } else if (field.type === 'select') {
        expect(field.options?.map((option) => option.value)).toContain(String(value));
      }
    }
  });

  it('uses stable negative pointer ids for generated demo gestures', () => {
    const ai = new FireworksDemoAI();
    const ctx = createContext(new Map<string, SettingsValue>());
    ai.onActivate(ctx);
    const gestures = ai.think({ ...ctx, dt: 1, elapsedTime: 1 });

    expect(gestures.length).toBeGreaterThan(0);
    expect(gestures.every((gesture) => typeof gesture.id === 'number' && gesture.id < 0)).toBe(true);
  });

  it('caps raw density choices in preview mode', () => {
    const settings = new Map<string, SettingsValue>();
    const ai = new FireworksDemoAI({ liteMode: true, rawParticleTextureSizeMax: 256 });
    for (let index = 0; index < 12; index += 1) {
      ai.onActivate(createContext(settings, true));
      expect(Number(settings.get('rawParticleTextureSize'))).toBeLessThanOrEqual(256);
    }
  });
});
