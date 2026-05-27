import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const CHROMATIC_AVALANCHE_BOWL_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'grainCount', label: 'Grain Count', type: 'number', min: 80, max: 1400, step: 20, default: 520 },
  { key: 'slopeAngle', label: 'Slope Angle', type: 'number', min: 0.12, max: 1.15, step: 0.01, default: 0.58 },
  { key: 'friction', label: 'Friction', type: 'number', min: 0.05, max: 0.86, step: 0.01, default: 0.32 },
  { key: 'chromaMix', label: 'Chroma Mix', type: 'number', min: 0.04, max: 1.2, step: 0.02, default: 0.64 },
  { key: 'pourRate', label: 'Pour Rate', type: 'number', min: 0.05, max: 1.8, step: 0.05, default: 0.82 },
];

export const CHROMATIC_AVALANCHE_BOWL_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  grainCount: 520,
  slopeAngle: 0.58,
  friction: 0.32,
  chromaMix: 0.64,
  pourRate: 0.82,
  style: 'powder-prism',
  debug: false,
  screensaverMs: 60_000,
};
