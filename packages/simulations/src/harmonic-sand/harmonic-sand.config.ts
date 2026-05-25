import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const HARMONIC_SAND_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'fieldResolution',
    label: 'Resolution',
    description: 'Grid columns — crank it for ultra-sharp patterns',
    type: 'number',
    min: 128,
    max: 512,
    step: 16,
    default: 128,
  },
  {
    key: 'baseFrequency',
    label: 'Base Frequency',
    type: 'number',
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 2.4,
  },
];

export const HARMONIC_SAND_DEFAULTS: Record<string, unknown> = {
  fieldResolution: 128,
  baseFrequency: 2.4,
  emitterCount: 0,
  style: 'chladni-gold',
  debug: false,
  screensaverMs: 60_000,
};
