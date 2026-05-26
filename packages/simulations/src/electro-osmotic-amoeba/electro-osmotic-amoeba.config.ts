import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const ELECTRO_OSMOTIC_AMOEBA_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'cellCount', label: 'Membrane Cells', type: 'number', min: 4, max: 18, step: 1, default: 9 },
  { key: 'particleBudget', label: 'Ion Particle Budget', type: 'number', min: 48, max: 180, step: 6, default: 96 },
  { key: 'voltage', label: 'Membrane Voltage', type: 'number', min: -1.2, max: 1.2, step: 0.05, default: 0.45 },
  { key: 'osmoticPressure', label: 'Osmotic Pressure', type: 'number', min: 0.1, max: 1.8, step: 0.05, default: 0.75 },
  { key: 'membraneElasticity', label: 'Membrane Elasticity', type: 'number', min: 0.15, max: 1.4, step: 0.05, default: 0.62 },
  { key: 'ionDiffusion', label: 'Ion Diffusion', type: 'number', min: 0.06, max: 0.75, step: 0.03, default: 0.28 },
];

export const ELECTRO_OSMOTIC_AMOEBA_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  cellCount: 9,
  particleBudget: 96,
  voltage: 0.45,
  osmoticPressure: 0.75,
  membraneElasticity: 0.62,
  ionDiffusion: 0.28,
  fieldRadius: 3.6,
  style: 'ion-bloom',
  debug: false,
  screensaverMs: 60_000,
};
