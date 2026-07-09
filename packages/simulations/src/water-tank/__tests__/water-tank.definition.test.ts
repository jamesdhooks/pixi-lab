import { describe, expect, it } from 'vitest';
import type { SimAIContext } from '@hooksjam/pixi-lab-core';
import { SIMULATION_REGISTRY, waterTankDefinition } from '../../index.js';
import { RawGpuParticleWaterScene } from '../RawGpuParticleWaterScene.js';
import { WATER_TANK_DEFAULTS, WATER_TANK_SETTINGS_FIELDS } from '../water-tank.config.js';

describe('water tank definition', () => {
  it('is registered as a demo-capable raw simulation', () => {
    expect(SIMULATION_REGISTRY).toContain(waterTankDefinition);
    expect(waterTankDefinition.id).toBe('water-tank');
    expect(waterTankDefinition.kind).toBe('simulation');
    expect(waterTankDefinition.capabilities.demo).toBe(true);
    expect(waterTankDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toContain('raw');
    expect(typeof waterTankDefinition.previewFactory).toBe('function');
    expect(typeof waterTankDefinition.demoAiFactory).toBe('function');
  });

  it('uses the raw WebGL particle water scene for live and preview rendering', () => {
    expect(waterTankDefinition.factory()).toBeInstanceOf(RawGpuParticleWaterScene);
    expect(waterTankDefinition.previewFactory?.()).toBeInstanceOf(RawGpuParticleWaterScene);
  });

  it('has a complete ten-palette style set', () => {
    expect(waterTankDefinition.styleManifest.styles).toHaveLength(10);
    expect(new Set(waterTankDefinition.styleManifest.styles.map((style) => style.id)).size).toBe(10);
  });

  it('keeps render style separate from color palettes', () => {
    const field = WATER_TANK_SETTINGS_FIELDS.find((candidate) => candidate.key === 'renderStyle');
    expect(field?.section).toBe('Rendering');
    expect(field?.type).toBe('select');
    expect(field?.options?.map((option) => option.value)).toEqual(['basic', 'enhanced', 'ultra']);
    expect(WATER_TANK_SETTINGS_FIELDS.some((candidate) => candidate.key === 'renderScale')).toBe(false);
    expect(WATER_TANK_DEFAULTS.renderScale).toBeUndefined();
  });

  it('supports pour, splash, and build modes with contextual input controls', () => {
    expect(waterTankDefinition.modes?.map((mode) => mode.id)).toEqual(['pour', 'splash', 'build']);
    const inputFields = WATER_TANK_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputFields.length).toBeGreaterThan(0);
    expect(inputFields.every((field) => Array.isArray(field.visibleModes) && field.visibleModes.length > 0)).toBe(true);
    expect(WATER_TANK_SETTINGS_FIELDS.map((field) => field.key)).toEqual(expect.arrayContaining(['obstacleRamps', 'obstaclePegs']));
    expect(WATER_TANK_SETTINGS_FIELDS.filter((field) => field.section === 'Tank Layout').map((field) => field.key)).toEqual(['obstacleRamps', 'obstaclePegs']);
  });

  it('matches visible field defaults with runtime config defaults', () => {
    for (const field of WATER_TANK_SETTINGS_FIELDS) {
      expect(field.default).toBe(WATER_TANK_DEFAULTS[field.key]);
    }
  });

  it('documents raw WebGL particle-water direction', () => {
    expect(waterTankDefinition.advancedPhysics?.renderer).toBe('raw-webgl2');
    expect(waterTankDefinition.advancedPhysics?.engine).toBe('2d-sph-double-density-relaxation-water');
    expect(waterTankDefinition.advancedPhysics?.portability).toBe('reusable-core');
    expect(waterTankDefinition.advancedPhysics?.reusableFor).toContain('particle fluid tanks');
    expect(waterTankDefinition.advancedPhysics?.reusableFor).toContain('SPH-inspired 2D liquid toys');
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
      styleIds: waterTankDefinition.styleManifest.styles.map((style) => style.id),
      applyStyle: (styleId: string) => applyStyleCalls.push(styleId),
      applySetting: (key: string) => { settings.push(key); },
      applyNumericSetting: (key: string) => { numericSettings.push(key); },
      pushGestures: () => undefined,
      resetScene: () => undefined,
    };
    const demo = waterTankDefinition.demoAiFactory?.(ctx);
    demo?.onActivate(ctx);
    const gestures = demo?.think(ctx) ?? [];
    expect(gestures.some((gesture) => gesture.kind === 'drag')).toBe(true);
    expect(applyStyleCalls.length).toBeGreaterThan(0);
    expect(settings).toContain('renderStyle');
    expect(numericSettings).toContain('maxParticles');
    expect(numericSettings).toContain('obstacleRamps');
    expect(numericSettings).toContain('obstaclePegs');
  });
});
