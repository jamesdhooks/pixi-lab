import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const AMOEBA_LAMP_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'gridColumns', label: 'Density Grid Columns', type: 'number', min: 28, max: 96, step: 4, default: 56 },
  { key: 'blobCount', label: 'Seed Blobs', type: 'number', min: 3, max: 14, step: 1, default: 8 },
  { key: 'particleBudget', label: 'Blob Particle Budget', type: 'number', min: 24, max: 96, step: 4, default: 56 },
  { key: 'surfaceTension', label: 'Surface Tension', type: 'number', min: 0.2, max: 1.4, step: 0.05, default: 0.72 },
  { key: 'buoyancy', label: 'Buoyancy', type: 'number', min: 10, max: 110, step: 5, default: 58 },
  { key: 'densityRadius', label: 'Metaball Radius', type: 'number', min: 2, max: 6, step: 0.25, default: 3.4 },
];

export const AMOEBA_LAMP_DEFAULTS: Record<string, unknown> = {
  gridColumns: 56,
  blobCount: 8,
  particleBudget: 56,
  densityRadius: 3.4,
  heatDiffusion: 0.16,
  surfaceTension: 0.72,
  buoyancy: 58,
  style: 'bio-plasma',
  debug: false,
  screensaverMs: 60_000,
};
