import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const PROTO_GALAXY_FORGE_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 128 },
  { key: 'particleCount', label: 'Star Dust Count', type: 'number', min: 80, max: 900, step: 20, default: 360 },
  { key: 'wellCount', label: 'Gravity Wells', type: 'number', min: 2, max: 9, step: 1, default: 5 },
  { key: 'gravityStrength', label: 'Gravity Strength', type: 'number', min: 0.05, max: 2.4, step: 0.05, default: 0.9 },
  { key: 'spinBias', label: 'Spin Bias', type: 'number', min: -1.5, max: 1.5, step: 0.05, default: 0.42 },
  { key: 'fusionRate', label: 'Fusion Rate', type: 'number', min: 0, max: 1.8, step: 0.05, default: 0.62 },
];

export const PROTO_GALAXY_FORGE_DEFAULTS: Record<string, unknown> = {
  resolution: 128,
  particleCount: 360,
  wellCount: 5,
  gravityStrength: 0.9,
  spinBias: 0.42,
  fusionRate: 0.62,
  style: 'stellar-nursery',
  debug: false,
  screensaverMs: 60_000,
};
