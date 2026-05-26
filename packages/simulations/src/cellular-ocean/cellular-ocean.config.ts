import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const CELLULAR_OCEAN_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 256, step: 16, default: 96 },
  { key: 'cellCount', label: 'Cell Count', type: 'number', min: 4, max: 18, step: 1, default: 10 },
  { key: 'membranePoints', label: 'Membrane Points', type: 'number', min: 8, max: 24, step: 2, default: 16 },
  { key: 'membraneTension', label: 'Membrane Tension', type: 'number', min: 0.08, max: 0.9, step: 0.01, default: 0.38 },
  { key: 'viscosity', label: 'Viscosity', type: 'number', min: 0.86, max: 0.995, step: 0.005, default: 0.965 },
  { key: 'pulseStrength', label: 'Pulse Strength', type: 'number', min: 15, max: 180, step: 5, default: 85 },
  { key: 'driftStrength', label: 'Ocean Drift', type: 'number', min: 0.05, max: 1.4, step: 0.05, default: 0.55 },
];

export const CELLULAR_OCEAN_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  cellCount: 10,
  membranePoints: 16,
  membraneTension: 0.38,
  viscosity: 0.965,
  pulseStrength: 85,
  driftStrength: 0.55,
  style: 'lagoon-cells',
  debug: false,
  screensaverMs: 60_000,
};
