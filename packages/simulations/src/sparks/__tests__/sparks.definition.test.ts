import type { GestureEvent, SettingsValue, SimAIContext } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { SIMULATION_REGISTRY, sparksDefinition } from '../../index.js';
import { RawSparksScene } from '../RawSparksScene.js';
import { SparksPreviewScene } from '../SparksPreviewScene.js';
import { SPARKS_DEFAULTS, SPARKS_SETTINGS_FIELDS } from '../sparks.config.js';

describe('sparks definition', () => {
  it('is registered as a demo-capable raw simulation', () => {
    expect(SIMULATION_REGISTRY).toContain(sparksDefinition);
    expect(sparksDefinition.id).toBe('sparks');
    expect(sparksDefinition.kind).toBe('simulation');
    expect(sparksDefinition.capabilities.demo).toBe(true);
    expect(sparksDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toEqual(['raw']);
    expect(sparksDefinition.modes?.map((mode) => mode.id)).toEqual(['welding', 'pinwheel', 'shower', 'build']);
    expect(sparksDefinition.tutorialPages?.map((page) => page.title)).toEqual(['Welding Mode', 'Pinwheel Mode', 'Shower Mode', 'Build Rails', 'Raw Spark Engine']);
    expect(typeof sparksDefinition.demoAiFactory).toBe('function');
  });

  it('uses dedicated live and preview scenes', () => {
    expect(sparksDefinition.factory()).toBeInstanceOf(RawSparksScene);
    expect(sparksDefinition.previewFactory?.()).toBeInstanceOf(SparksPreviewScene);
  });

  it('keeps settings defaults synchronized and contextual', () => {
    for (const field of SPARKS_SETTINGS_FIELDS) {
      expect(field.default).toBe(SPARKS_DEFAULTS[field.key]);
    }
    expect(SPARKS_SETTINGS_FIELDS.find((field) => field.key === 'renderStyle')?.options?.map((option) => option.value)).toEqual(['basic', 'enhanced', 'ultra']);
    const inputModeFields = SPARKS_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputModeFields.length).toBeGreaterThan(0);
    expect(inputModeFields.every((field) => Array.isArray(field.visibleModes) && field.visibleModes.length > 0)).toBe(true);
    expect(inputModeFields.filter((field) => field.key.startsWith('core')).map((field) => field.key)).toEqual([
      'coreFlashRate',
      'coreFlashSize',
      'coreFlashVariability',
      'coreIntensity',
      'coreAfterglow',
    ]);
    expect(SPARKS_SETTINGS_FIELDS.filter((field) => field.visibleRenderStyles?.includes('enhanced')).map((field) => field.key)).toEqual([
      'trailContinuity',
      'heatRadius',
    ]);
    expect(SPARKS_SETTINGS_FIELDS.filter((field) => field.visibleRenderStyles?.includes('ultra')).map((field) => field.key)).toEqual([
      'trailFade',
      'trailContinuity',
      'bloomStrength',
      'heatRadius',
    ]);
  });

  it('provides palettes and demo AI overhauls', () => {
    expect(sparksDefinition.styleManifest.styles.length).toBeGreaterThanOrEqual(6);
    const settings = new Map<string, SettingsValue>();
    const ctx: SimAIContext = {
      width: 640,
      height: 420,
      dt: 1,
      elapsedTime: 1,
      isPreview: true,
      styleIds: sparksDefinition.styleManifest.styles.map((style) => style.id),
      applyStyle: (styleId) => settings.set('style', styleId),
      applySetting: (key, value) => settings.set(key, value),
      applyNumericSetting: (key, value) => settings.set(key, value),
      pushGestures: () => undefined,
      resetScene: () => undefined,
      clearEmittersOnly: () => undefined,
    };
    const demo = sparksDefinition.demoAiFactory?.(ctx);
    demo?.onActivate(ctx);
    const gestures = demo?.think(ctx) ?? [];
    expect(gestures.some((gesture) => gesture.kind === 'drag')).toBe(true);
    expect(settings.get('style')).toBeDefined();
    expect(settings.get('renderStyle')).toBe('enhanced');
    expect(settings.get('emissionRate')).toBeDefined();
    expect(Number(settings.get('rawParticleTextureSize'))).toBeLessThanOrEqual(256);
  });
});
