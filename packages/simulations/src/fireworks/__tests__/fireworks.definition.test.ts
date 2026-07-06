import { describe, expect, it } from 'vitest';
import { SIMULATION_REGISTRY, fireworksDefinition } from '../../index.js';
import { FIREWORKS_SETTINGS_FIELDS } from '../fireworks.config.js';

describe('fireworks definition', () => {
  it('is registered as a demo-capable raw simulation', () => {
    expect(SIMULATION_REGISTRY).toContain(fireworksDefinition);
    expect(fireworksDefinition.id).toBe('fireworks');
    expect(fireworksDefinition.kind).toBe('simulation');
    expect(fireworksDefinition.capabilities.demo).toBe(true);
    expect(fireworksDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toContain('raw');
    expect(typeof fireworksDefinition.demoAiFactory).toBe('function');
  });

  it('keeps mode-specific controls scoped to their input modes', () => {
    const inputModeFields = FIREWORKS_SETTINGS_FIELDS.filter((field) => field.section === 'Input Mode');
    expect(inputModeFields.length).toBeGreaterThan(0);
    expect(inputModeFields.every((field) => Array.isArray(field.visibleModes) && field.visibleModes.length > 0)).toBe(true);
  });
});
