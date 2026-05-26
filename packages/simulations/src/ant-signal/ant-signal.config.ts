import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const ANT_SIGNAL_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'antCount', label: 'Ant Count', type: 'number', min: 40, max: 360, step: 20, default: 180 },
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'foodCount', label: 'Food Sources', type: 'number', min: 2, max: 10, step: 1, default: 5 },
  { key: 'pheromoneDecay', label: 'Pheromone Persistence', type: 'number', min: 0.94, max: 0.995, step: 0.002, default: 0.982 },
];

export const ANT_SIGNAL_DEFAULTS: Record<string, unknown> = {
  antCount: 180,
  resolution: 96,
  foodCount: 5,
  pheromoneDecay: 0.982,
  style: 'neon-colony',
  debug: false,
  screensaverMs: 60_000,
};
