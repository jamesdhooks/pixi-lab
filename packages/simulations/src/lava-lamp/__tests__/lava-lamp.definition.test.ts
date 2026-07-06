import { describe, expect, it } from 'vitest';
import { SIMULATION_REGISTRY, lavaLampDefinition } from '../../index.js';
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

  it('has a complete ten-palette style set', () => {
    expect(lavaLampDefinition.styleManifest.styles).toHaveLength(10);
    expect(new Set(lavaLampDefinition.styleManifest.styles.map((style) => style.id)).size).toBe(10);
  });

  it('keeps render style separate from color palettes', () => {
    const field = LAVA_LAMP_SETTINGS_FIELDS.find((candidate) => candidate.key === 'renderStyle');
    expect(field?.section).toBe('Rendering');
    expect(field?.type).toBe('select');
    expect(field?.options?.map((option) => option.value)).toEqual(['smooth', 'glow', 'cellular']);
  });

  it('exposes explicit raise/lower thermal input modes and controls', () => {
    expect(lavaLampDefinition.modes?.map((mode) => mode.id)).toEqual(['heat', 'cool']);
    const inputFields = LAVA_LAMP_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputFields.map((field) => field.key)).toEqual(['inputRadius', 'inputLift', 'inputThermalRate']);
    expect(inputFields.every((field) => field.visibleModes?.join(',') === 'heat,cool')).toBe(true);
  });

  it('matches visible field defaults with runtime config defaults', () => {
    for (const field of LAVA_LAMP_SETTINGS_FIELDS) {
      expect(field.default).toBe(LAVA_LAMP_DEFAULTS[field.key]);
    }
  });
});
