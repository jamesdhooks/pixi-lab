import { describe, expect, it } from 'vitest';
import type { SimAIContext } from '@hooksjam/pixi-lab-core';
import { SIMULATION_REGISTRY, particleFluidDefinition } from '../../index.js';
import { PARTICLE_FLUID_DEFAULTS, PARTICLE_FLUID_SETTINGS_FIELDS } from '../particle-fluid.config.js';
import { ParticleFluidPreviewScene } from '../ParticleFluidPreviewScene.js';
import { RawParticleFluidScene } from '../RawParticleFluidScene.js';

describe('particle fluid definition', () => {
  it('is registered as a demo-capable raw simulation', () => {
    expect(SIMULATION_REGISTRY).toContain(particleFluidDefinition);
    expect(particleFluidDefinition.id).toBe('particle-fluid');
    expect(particleFluidDefinition.kind).toBe('simulation');
    expect(particleFluidDefinition.capabilities.demo).toBe(true);
    expect(particleFluidDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toContain('raw');
    expect(typeof particleFluidDefinition.demoAiFactory).toBe('function');
  });

  it('uses the native raw particle-fluid scene for live and preview rendering', () => {
    expect(particleFluidDefinition.factory()).toBeInstanceOf(RawParticleFluidScene);
    expect(particleFluidDefinition.previewFactory()).toBeInstanceOf(ParticleFluidPreviewScene);
  });

  it('has native palettes and visible attribution to the reference project', () => {
    expect(particleFluidDefinition.styleManifest.styles).toHaveLength(10);
    expect(particleFluidDefinition.styleManifest.styles[0]?.id).toBe('haxiomic-cyan');
    expect(particleFluidDefinition.styleManifest.styles.every((style) => typeof style.background === 'number')).toBe(true);
    expect(new Set(particleFluidDefinition.styleManifest.styles.map((style) => style.id)).size).toBe(10);
    expect(particleFluidDefinition.long).toBe('Stir a glowing cloud of particles and watch the current flow.');
    expect(particleFluidDefinition.advancedPhysics?.caveats.join(' ')).toContain('Haxiomic GPU Fluid Experiments');
    expect(particleFluidDefinition.attributions).toEqual([
      {
        label: 'GPU Fluid Experiments',
        href: 'https://github.com/haxiomic/GPU-Fluid-Experiments',
        author: 'Haxiomic',
        license: 'GPL-3.0',
      },
    ]);
  });

  it('keeps source-style interaction and defaults aligned', () => {
    const inputFields = PARTICLE_FLUID_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputFields).toHaveLength(0);
    expect(particleFluidDefinition.modes).toBeUndefined();
    const particleBudget = PARTICLE_FLUID_SETTINGS_FIELDS.find((field) => field.key === 'maxParticles');
    const fluidScale = PARTICLE_FLUID_SETTINGS_FIELDS.find((field) => field.key === 'fieldCellSize');
    const tankScale = PARTICLE_FLUID_SETTINGS_FIELDS.find((field) => field.key === 'simulationScale');
    const renderStyle = PARTICLE_FLUID_SETTINGS_FIELDS.find((field) => field.key === 'renderStyle');
    const bloomStrength = PARTICLE_FLUID_SETTINGS_FIELDS.find((field) => field.key === 'bloomStrength');
    const pulseStrength = PARTICLE_FLUID_SETTINGS_FIELDS.find((field) => field.key === 'pulseStrength');
    expect(renderStyle).toMatchObject({
      label: 'Style',
      type: 'select',
      default: 'basic',
    });
    expect(renderStyle?.options?.map((option) => option.value)).toEqual(['basic', 'enhanced']);
    expect(bloomStrength).toMatchObject({
      label: 'Bloom Strength',
      visibleRenderStyles: ['enhanced'],
      default: 0.9,
    });
    expect(pulseStrength).toMatchObject({
      label: 'Gradient Pulse',
      visibleRenderStyles: ['enhanced'],
      default: 1,
    });
    expect(particleBudget).toMatchObject({
      label: 'Particle Budget',
      min: 1024,
      max: 4194304,
      numericScale: 'powerOfTwo',
      default: 262144,
    });
    expect(fluidScale).toMatchObject({
      label: 'Fluid Scale',
      min: 1,
      max: 10,
      default: 4,
    });
    expect(tankScale).toMatchObject({
      label: 'Tank Scale',
      min: 0.25,
      max: 2.5,
      default: 1,
    });
    for (const field of PARTICLE_FLUID_SETTINGS_FIELDS) {
      expect(field.default).toBe(PARTICLE_FLUID_DEFAULTS[field.key]);
    }
  });

  it('demo AI applies style and every numeric settings field before gesturing', () => {
    const styleCalls: string[] = [];
    const settingCalls: string[] = [];
    const numericCalls: string[] = [];
    const ctx: SimAIContext = {
      width: 320,
      height: 220,
      dt: 1 / 60,
      elapsedTime: 0,
      isPreview: true,
      styleIds: particleFluidDefinition.styleManifest.styles.map((style) => style.id),
      applyStyle: (styleId: string) => styleCalls.push(styleId),
      applySetting: (key: string) => { settingCalls.push(key); },
      applyNumericSetting: (key: string) => { numericCalls.push(key); },
      pushGestures: () => undefined,
      resetScene: () => undefined,
    };
    const demo = particleFluidDefinition.demoAiFactory?.(ctx);
    demo?.onActivate?.(ctx);
    const gestures = demo?.think(ctx) ?? [];
    expect(styleCalls.length).toBeGreaterThan(0);
    expect(settingCalls).toEqual(['renderStyle']);
    for (const field of PARTICLE_FLUID_SETTINGS_FIELDS.filter((candidate) => candidate.type === 'number')) {
      expect(numericCalls).toContain(field.key);
    }
    expect(gestures.some((gesture) => gesture.kind === 'drag')).toBe(true);
  });
});
