import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const OIL_WATER_UNIVERSE_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'separationRate', label: 'Separation Rate', type: 'number', min: 0.12, max: 1.4, step: 0.02, default: 0.72 },
  { key: 'boundaryTension', label: 'Boundary Tension', type: 'number', min: 0.02, max: 0.62, step: 0.01, default: 0.24 },
  { key: 'viscosity', label: 'Viscosity', type: 'number', min: 0.05, max: 0.72, step: 0.01, default: 0.26 },
  { key: 'stirStrength', label: 'Stir Strength', type: 'number', min: 0.15, max: 1.9, step: 0.05, default: 0.95 },
];

export const OIL_WATER_UNIVERSE_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  separationRate: 0.72,
  boundaryTension: 0.24,
  viscosity: 0.26,
  stirStrength: 0.95,
  style: 'oil-slick',
  debug: false,
  screensaverMs: 60_000,
};
