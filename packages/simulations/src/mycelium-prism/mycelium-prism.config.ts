import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const MYCELIUM_PRISM_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'gridColumns', label: 'Grid Columns', type: 'number', min: 24, max: 96, step: 4, default: 56 },
  { key: 'growthRate', label: 'Growth Rate', type: 'number', min: 0.1, max: 1.2, step: 0.05, default: 0.62 },
  { key: 'nutrientDiffusion', label: 'Nutrient Diffusion', type: 'number', min: 0.02, max: 0.5, step: 0.02, default: 0.18 },
];

export const MYCELIUM_PRISM_DEFAULTS: Record<string, unknown> = {
  gridColumns: 56,
  growthRate: 0.62,
  nutrientDiffusion: 0.18,
  initialColonies: 5,
  strainCount: 4,
  style: 'neon-mold',
  debug: false,
  screensaverMs: 60_000,
};
