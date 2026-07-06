import type { GestureEvent, SettingsValue, SimAIContext } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { HarmonicSandDemoAI } from '../HarmonicSandDemoAI.js';

const EXPECTED_SETTINGS = [
  'renderStyle',
  'resolution',
  'baseFrequency',
  'wavePeriod',
  'rawParticleCount',
  'rawParticleDensity',
  'rawEmitterLimit',
  'rawLineSharpness',
  'rawGlow',
];

function createContext(settings: Map<string, SettingsValue>): SimAIContext {
  const gestures: GestureEvent[] = [];
  return {
    width: 800,
    height: 600,
    dt: 0,
    elapsedTime: 0,
    styleIds: ['chladni-gold', 'aurora-plate'],
    applyStyle: (styleId) => settings.set('style', styleId),
    applySetting: (key, value) => settings.set(key, value),
    applyNumericSetting: (key, value) => settings.set(key, value),
    pushGestures: (nextGestures) => gestures.push(...nextGestures),
    resetScene: () => undefined,
    clearEmittersOnly: () => undefined,
    isPreview: false,
  };
}

describe('HarmonicSandDemoAI', () => {
  it('randomizes every promoted Harmonic Sand setting on activation', () => {
    const settings = new Map<string, SettingsValue>();
    const ai = new HarmonicSandDemoAI();

    ai.onActivate(createContext(settings));

    expect([...settings.keys()]).toEqual(expect.arrayContaining(EXPECTED_SETTINGS));
    expect(settings.get('renderStyle')).toEqual(expect.stringMatching(/^(basic|enhanced|ultra)$/));
    expect(settings.get('resolution')).toSatisfy((value: SettingsValue) => typeof value === 'number' && value >= 32 && value <= 2048);
    expect(settings.get('rawParticleCount')).toSatisfy((value: SettingsValue) => typeof value === 'number' && value >= 25_000 && value <= 2_000_000);
    expect(settings.get('rawEmitterLimit')).toSatisfy((value: SettingsValue) => typeof value === 'number' && value >= 1 && value <= 16);
  });

  it('places multiple emitters after applying a settings overhaul', () => {
    const settings = new Map<string, SettingsValue>();
    const gestures: GestureEvent[] = [];
    const ai = new HarmonicSandDemoAI();
    const ctx = {
      ...createContext(settings),
      pushGestures: (nextGestures: GestureEvent[]) => gestures.push(...nextGestures),
    };

    ai.onActivate(ctx);

    expect(gestures.length).toBeGreaterThanOrEqual(1);
    expect(gestures.every((gesture: GestureEvent) => gesture.kind === 'tap')).toBe(true);
  });

  it('keeps preview demo presets in the smaller, squishier envelope', () => {
    const settings = new Map<string, SettingsValue>();
    const ai = new HarmonicSandDemoAI({ previewMode: true });
    ai.onActivate({
      ...createContext(settings),
      isPreview: true,
    });

    const particleCount = settings.get('rawParticleCount');
    const particleDensity = settings.get('rawParticleDensity');
    const lineSharpness = settings.get('rawLineSharpness');
    const glow = settings.get('rawGlow');

    expect(particleCount).toBeLessThanOrEqual(125_000);
    expect(particleDensity).toBeLessThanOrEqual(1.6);
    expect(lineSharpness).toBeLessThanOrEqual(1.0);
    expect(glow).toBeLessThanOrEqual(1.6);
  });
});
