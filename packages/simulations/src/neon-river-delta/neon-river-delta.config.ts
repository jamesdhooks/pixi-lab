import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const NEON_RIVER_DELTA_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'rainfall', label: 'Rainfall', type: 'number', min: 0.05, max: 1.8, step: 0.05, default: 0.72 },
  { key: 'erosionRate', label: 'Erosion Rate', type: 'number', min: 0.02, max: 1.2, step: 0.02, default: 0.46 },
  { key: 'sedimentGlow', label: 'Sediment Glow', type: 'number', min: 0.05, max: 1.8, step: 0.05, default: 0.9 },
  { key: 'flowSpeed', label: 'Flow Speed', type: 'number', min: 0.15, max: 2.6, step: 0.05, default: 1.0 },
];

export const NEON_RIVER_DELTA_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  rainfall: 0.72,
  erosionRate: 0.46,
  sedimentGlow: 0.9,
  flowSpeed: 1.0,
  style: 'electric-estuary',
  debug: false,
  screensaverMs: 60_000,
};
