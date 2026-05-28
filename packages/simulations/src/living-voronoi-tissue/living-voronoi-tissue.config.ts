import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const LIVING_VORONOI_TISSUE_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'cellCount', label: 'Cell Count', type: 'number', min: 12, max: 220, step: 4, default: 72 },
  { key: 'migrationRate', label: 'Migration Rate', type: 'number', min: 0.05, max: 2.4, step: 0.05, default: 0.85 },
  { key: 'membraneTension', label: 'Membrane Tension', type: 'number', min: 0.05, max: 1.8, step: 0.05, default: 0.72 },
  { key: 'signalStrength', label: 'Signal Strength', type: 'number', min: 0.05, max: 2.2, step: 0.05, default: 0.95 },
  { key: 'divisionRate', label: 'Division Rate', type: 'number', min: 0, max: 1.2, step: 0.02, default: 0.32 },
];

export const LIVING_VORONOI_TISSUE_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  cellCount: 72,
  migrationRate: 0.85,
  membraneTension: 0.72,
  signalStrength: 0.95,
  divisionRate: 0.32,
  style: 'biolume-tissue',
  debug: false,
  screensaverMs: 60_000,
};
