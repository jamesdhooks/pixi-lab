import { describe, expect, it } from 'vitest';
import type { SimAIContext } from '@hooksjam/pixi-lab-core';
import { SIMULATION_REGISTRY, lavaLampDefinition } from '../../index.js';
import { RawParticleMetaballScene } from '../../shared/RawParticleMetaballScene.js';
import { LAVA_LAMP_DEFAULTS, LAVA_LAMP_SETTINGS_FIELDS } from '../lava-lamp.config.js';

describe('lava lamp definition', () => {
  it('is registered as a demo-capable raw simulation', () => {
    expect(SIMULATION_REGISTRY).toContain(lavaLampDefinition);
    expect(lavaLampDefinition.id).toBe('lava-lamp');
    expect(lavaLampDefinition.kind).toBe('simulation');
    expect(lavaLampDefinition.capabilities.demo).toBe(true);
    expect(lavaLampDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toContain('raw');
    expect(typeof lavaLampDefinition.previewFactory).toBe('function');
    expect(typeof lavaLampDefinition.demoAiFactory).toBe('function');
  });

  it('uses the shared raw particle-metaball scene for live and preview rendering', () => {
    expect(lavaLampDefinition.factory()).toBeInstanceOf(RawParticleMetaballScene);
    expect(lavaLampDefinition.previewFactory?.()).toBeInstanceOf(RawParticleMetaballScene);
  });

  it('has a complete ten-palette style set', () => {
    expect(lavaLampDefinition.styleManifest.styles).toHaveLength(10);
    expect(new Set(lavaLampDefinition.styleManifest.styles.map((style) => style.id)).size).toBe(10);
  });

  it('credits the reference lava lamp work and shader lineage', () => {
    expect(lavaLampDefinition.attributions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'WebGL Lava Lamp',
        href: 'https://github.com/brybrant/lava-lamp',
        author: 'Matt Bryant',
        license: 'GPL-3.0',
      }),
      expect.objectContaining({
        label: 'Raymarch lava lamp shader',
        href: 'https://www.shadertoy.com/view/fsKXDm',
        author: '@Arrangemonk',
      }),
    ]));
  });

  it('keeps render style separate from color palettes', () => {
    const field = LAVA_LAMP_SETTINGS_FIELDS.find((candidate) => candidate.key === 'renderStyle');
    expect(field?.section).toBe('Rendering');
    expect(field?.type).toBe('select');
    expect(field?.options?.map((option) => option.value)).toEqual(['smooth', 'glow', 'cellular']);
    expect(LAVA_LAMP_SETTINGS_FIELDS.some((candidate) => candidate.key === 'renderScale')).toBe(false);
    expect(LAVA_LAMP_DEFAULTS.renderScale).toBeUndefined();
  });

  it('exposes explicit raise/lower thermal input modes and controls', () => {
    expect(lavaLampDefinition.modes?.map((mode) => mode.id)).toEqual(['heat', 'cool']);
    const inputFields = LAVA_LAMP_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputFields.map((field) => field.key)).toEqual(['inputRadius', 'inputLift', 'inputThermalRate']);
    expect(inputFields.every((field) => field.visibleModes?.join(',') === 'heat,cool')).toBe(true);
    expect(LAVA_LAMP_SETTINGS_FIELDS.map((field) => field.key)).toContain('thermalContrast');
    expect(LAVA_LAMP_SETTINGS_FIELDS.filter((field) => field.section === 'Thermal Motion').map((field) => field.key)).toEqual(['buoyancy', 'heatRate', 'coolRate', 'waxViscosity']);
  });

  it('matches visible field defaults with runtime config defaults', () => {
    for (const field of LAVA_LAMP_SETTINGS_FIELDS) {
      expect(field.default).toBe(LAVA_LAMP_DEFAULTS[field.key]);
    }
  });

  it('documents raw WebGL raymarch acceleration on the shared particle scene', () => {
    expect(lavaLampDefinition.advancedPhysics?.renderer).toBe('raw-webgl2');
    expect(lavaLampDefinition.advancedPhysics?.engine).toBe('raymarched-lava-lamp');
    expect(lavaLampDefinition.advancedPhysics?.portability).toBe('reusable-core');
    expect(lavaLampDefinition.advancedPhysics?.reusableFor).toContain('raymarched lava lamps');
  });

  it('provides demo AI gestures for both full scene and preview tile mode', () => {
    const applyStyleCalls: string[] = [];
    const numericSettings: string[] = [];
    const settings: string[] = [];
    const ctx: SimAIContext = {
      width: 320,
      height: 220,
      dt: 1 / 60,
      elapsedTime: 0,
      isPreview: true,
      styleIds: lavaLampDefinition.styleManifest.styles.map((style) => style.id),
      applyStyle: (styleId: string) => applyStyleCalls.push(styleId),
      applySetting: (key: string) => { settings.push(key); },
      applyNumericSetting: (key: string) => { numericSettings.push(key); },
      pushGestures: () => undefined,
      resetScene: () => undefined,
    };
    const demo = lavaLampDefinition.demoAiFactory?.(ctx);
    demo?.onActivate(ctx);
    const gestures = demo?.think(ctx) ?? [];
    expect(gestures.some((gesture) => gesture.kind === 'drag')).toBe(true);
    expect(gestures).toHaveLength(2);
    expect(gestures.some((gesture) => (gesture.strength ?? 0) < 0)).toBe(true);
    expect(gestures.some((gesture) => (gesture.strength ?? 0) > 0)).toBe(true);
    expect(applyStyleCalls.length).toBeGreaterThan(0);
    expect(settings).toContain('renderStyle');
    expect(numericSettings).toContain('maxParticles');
    expect(numericSettings).toContain('thermalContrast');
    expect(numericSettings).toContain('waxViscosity');
  });
});
