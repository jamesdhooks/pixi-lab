import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const ORBITAL_SHRAPNEL_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'particleCount', label: 'Debris Count', type: 'number', min: 120, max: 1200, step: 40, default: 520 },
  { key: 'trailColumns', label: 'Trail Field Columns', type: 'number', min: 32, max: 128, step: 8, default: 72 },
  { key: 'gravity', label: 'Planet Gravity', type: 'number', min: 600, max: 3200, step: 50, default: 1550 },
  { key: 'planetRadius', label: 'Planet Radius', type: 'number', min: 22, max: 92, step: 2, default: 46 },
  { key: 'trailFade', label: 'Trail Persistence', type: 'number', min: 0.86, max: 0.995, step: 0.005, default: 0.955 },
];

export const ORBITAL_SHRAPNEL_DEFAULTS: Record<string, unknown> = {
  particleCount: 520,
  trailColumns: 72,
  gravity: 1550,
  planetRadius: 46,
  drag: 0.002,
  trailFade: 0.955,
  style: 'ice-ring',
  debug: false,
  screensaverMs: 60_000,
};
