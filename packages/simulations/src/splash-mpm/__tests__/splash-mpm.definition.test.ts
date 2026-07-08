import { describe, expect, it } from 'vitest';
import type { SimAIContext } from '@hooksjam/pixi-lab-core';
import { SIMULATION_REGISTRY, splashMpmDefinition } from '../../index.js';
import { RawSplashMpmScene } from '../RawSplashMpmScene.js';
import { SplashMpmPreviewScene } from '../SplashMpmPreviewScene.js';
import { SPLASH_MPM_DEFAULTS, SPLASH_MPM_SETTINGS_FIELDS } from '../splash-mpm.config.js';

describe('splash mpm definition', () => {
  it('is registered as an independent demo-capable raw simulation', () => {
    expect(SIMULATION_REGISTRY).toContain(splashMpmDefinition);
    expect(splashMpmDefinition.id).toBe('splash-mpm');
    expect(splashMpmDefinition.kind).toBe('simulation');
    expect(splashMpmDefinition.capabilities.demo).toBe(true);
    expect(splashMpmDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toEqual(['raw']);
    expect(typeof splashMpmDefinition.previewFactory).toBe('function');
    expect(typeof splashMpmDefinition.demoAiFactory).toBe('function');
  });

  it('uses its own live and preview scene classes', () => {
    expect(splashMpmDefinition.factory()).toBeInstanceOf(RawSplashMpmScene);
    expect(splashMpmDefinition.previewFactory?.()).toBeInstanceOf(SplashMpmPreviewScene);
  });

  it('documents the Splash attribution and MPM direction', () => {
    expect(splashMpmDefinition.attributions?.[0]).toMatchObject({
      label: 'Splash',
      href: 'https://github.com/matsuoka-601/Splash',
      author: 'matsuoka-601',
      license: 'MIT',
    });
    expect(splashMpmDefinition.advancedPhysics?.engine).toBe('2d-pic-flip-particle-water');
    expect(splashMpmDefinition.advancedPhysics?.reusableFor).toContain('2D MPM water scenes');
  });

  it('offers ten color palettes with explicit backgrounds', () => {
    expect(splashMpmDefinition.styleManifest.styles).toHaveLength(10);
    expect(splashMpmDefinition.styleManifest.styles.every((style) => typeof style.background === 'number')).toBe(true);
    expect(new Set(splashMpmDefinition.styleManifest.styles.map((style) => style.id)).size).toBe(10);
  });

  it('keeps field defaults synchronized with config defaults', () => {
    for (const field of SPLASH_MPM_SETTINGS_FIELDS) {
      expect(field.default).toBe(SPLASH_MPM_DEFAULTS[field.key]);
    }
  });

  it('uses contextual input-mode settings', () => {
    expect(splashMpmDefinition.modes?.map((mode) => mode.id)).toEqual(['splash', 'jet']);
    const inputFields = SPLASH_MPM_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputFields.length).toBeGreaterThan(0);
    expect(inputFields.every((field) => Array.isArray(field.visibleModes) && field.visibleModes.length > 0)).toBe(true);
    expect(SPLASH_MPM_SETTINGS_FIELDS.map((field) => field.key)).toContain('resolution');
    const renderStyleField = SPLASH_MPM_SETTINGS_FIELDS.find((field) => field.key === 'renderStyle');
    expect(renderStyleField?.type).toBe('select');
    expect(renderStyleField?.options?.map((option) => option.value)).toEqual(['basic', 'enhanced', 'raw']);
    expect(renderStyleField?.options?.map((option) => option.label)).toEqual(['Basic', 'Enhanced', 'Ultra']);
    const budgetField = SPLASH_MPM_SETTINGS_FIELDS.find((field) => field.key === 'maxParticles');
    expect(budgetField?.numericScale).toBe('powerOfTwo');
    expect(budgetField?.step).toBe(1);
    const resolutionField = SPLASH_MPM_SETTINGS_FIELDS.find((field) => field.key === 'resolution');
    expect(resolutionField).toMatchObject({
      min: 32,
      max: 512,
      step: 1,
      numericScale: 'powerOfTwo',
    });
    const enhancedFields = SPLASH_MPM_SETTINGS_FIELDS.filter((field) => field.section === 'Enhanced Surface');
    expect(enhancedFields.map((field) => field.key)).toEqual([
      'enhancedQuality',
      'enhancedSplatSize',
      'enhancedDepth',
      'enhancedEdge',
    ]);
    expect(enhancedFields.every((field) => field.type === 'number')).toBe(true);
    expect(enhancedFields.every((field) => field.visibleRenderStyles?.includes('enhanced'))).toBe(true);
  });

  it('provides demo AI style and setting overhauls plus gestures', () => {
    const applyStyleCalls: string[] = [];
    const numericSettings: string[] = [];
    const settings: string[] = [];
    const ctx: SimAIContext = {
      width: 320,
      height: 220,
      dt: 1 / 60,
      elapsedTime: 0,
      isPreview: true,
      styleIds: splashMpmDefinition.styleManifest.styles.map((style) => style.id),
      applyStyle: (styleId: string) => applyStyleCalls.push(styleId),
      applySetting: (key: string) => { settings.push(key); },
      applyNumericSetting: (key: string) => { numericSettings.push(key); },
      pushGestures: () => undefined,
      resetScene: () => undefined,
    };
    const demo = splashMpmDefinition.demoAiFactory?.(ctx);
    demo?.onActivate(ctx);
    const gestures = demo?.think(ctx) ?? [];
    expect(gestures.some((gesture) => gesture.kind === 'drag')).toBe(true);
    expect(applyStyleCalls.length).toBeGreaterThan(0);
    expect(settings).toContain('renderStyle');
    expect(numericSettings).toContain('maxParticles');
    expect(numericSettings).toContain('resolution');
    expect(numericSettings).toContain('stiffness');
  });
});
