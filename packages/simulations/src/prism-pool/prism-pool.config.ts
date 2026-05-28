import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const PRISM_POOL_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'waveSpeed', label: 'Wave Speed', type: 'number', min: 0.15, max: 2.4, step: 0.05, default: 0.92 },
  { key: 'refractionStrength', label: 'Refraction Strength', type: 'number', min: 0.05, max: 1.8, step: 0.05, default: 0.82 },
  { key: 'causticIntensity', label: 'Caustic Intensity', type: 'number', min: 0.1, max: 2.2, step: 0.05, default: 1.05 },
  { key: 'damping', label: 'Damping', type: 'number', min: 0.01, max: 0.42, step: 0.01, default: 0.12 },
];

export const PRISM_POOL_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  waveSpeed: 0.92,
  refractionStrength: 0.82,
  causticIntensity: 1.05,
  damping: 0.12,
  style: 'crystal-caustics',
  debug: false,
  screensaverMs: 60_000,
};
