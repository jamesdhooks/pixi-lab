import { describe, expect, it } from 'vitest';
import { SIMULATION_REGISTRY, waterTankDefinition } from '../../index.js';
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

  it('has a complete ten-palette style set', () => {
    expect(waterTankDefinition.styleManifest.styles).toHaveLength(10);
    expect(new Set(waterTankDefinition.styleManifest.styles.map((style) => style.id)).size).toBe(10);
  });

  it('keeps render style separate from color palettes', () => {
    const field = WATER_TANK_SETTINGS_FIELDS.find((candidate) => candidate.key === 'renderStyle');
    expect(field?.section).toBe('Rendering');
    expect(field?.type).toBe('select');
    expect(field?.options?.map((option) => option.value)).toEqual(['particles', 'surface', 'glass']);
  });

  it('supports pour, build, and interact modes with contextual input controls', () => {
    expect(waterTankDefinition.modes?.map((mode) => mode.id)).toEqual(['pour', 'build', 'interact']);
    const inputFields = WATER_TANK_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputFields.length).toBeGreaterThan(0);
    expect(inputFields.every((field) => Array.isArray(field.visibleModes) && field.visibleModes.length > 0)).toBe(true);
  });

  it('matches visible field defaults with runtime config defaults', () => {
    for (const field of WATER_TANK_SETTINGS_FIELDS) {
      expect(field.default).toBe(WATER_TANK_DEFAULTS[field.key]);
    }
  });
});
