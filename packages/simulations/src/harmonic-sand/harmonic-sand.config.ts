import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const HARMONIC_SAND_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'particleCount',
    label: 'Particle Count',
    type: 'number',
    min: 1000,
    max: 20000,
    step: 500,
    default: 5000,
  },
  {
    key: 'baseFrequency',
    label: 'Base Frequency',
    type: 'number',
    min: 0.5,
    max: 8,
    step: 0.1,
    default: 2.4,
  },
  {
    key: 'emitterCount',
    label: 'Emitter Count',
    type: 'number',
    min: 1,
    max: 6,
    step: 1,
    default: 3,
  },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: [
      { label: 'Chladni Gold', value: 'chladni-gold' },
      { label: 'Laser Plate', value: 'laser-plate' },
      { label: 'Ghost Frequency', value: 'ghost-frequency' },
    ],
    default: 'chladni-gold',
  },
  {
    key: 'debug',
    label: 'Debug Overlay',
    type: 'boolean',
    default: false,
  },
];

export const HARMONIC_SAND_DEFAULTS: Record<string, unknown> = {
  particleCount: 5000,
  baseFrequency: 2.4,
  emitterCount: 3,
  style: 'chladni-gold',
  debug: false,
  screensaverMs: 60_000,
};
