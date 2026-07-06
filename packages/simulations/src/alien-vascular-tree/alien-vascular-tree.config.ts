import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const ALIEN_VASCULAR_TREE_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'timeScale', label: 'Timescale', section: 'Simulation', type: 'number', min: 0, max: 2, step: 0.05, default: 1 },
  { key: 'resolution', label: 'Resolution', section: 'Simulation', type: 'number', min: 48, max: 1024, step: 16, default: 128 },
  { key: 'branchBudget', label: 'Branch Budget', section: 'Growth', type: 'number', min: 80, max: 900, step: 10, default: 320 },
  { key: 'growthRate', label: 'Growth Rate', section: 'Growth', type: 'number', min: 0.15, max: 3.2, step: 0.05, default: 1.15 },
  { key: 'nutrientFlow', label: 'Nutrient Flow', section: 'Growth', type: 'number', min: 0.1, max: 2.4, step: 0.05, default: 1 },
  { key: 'pruneRate', label: 'Prune Rate', section: 'Growth', type: 'number', min: 0.01, max: 1.4, step: 0.01, default: 0.22 },
];

export const ALIEN_VASCULAR_TREE_DEFAULTS: Record<string, unknown> = {
  timeScale: 1,
  resolution: 128,
  branchBudget: 320,
  growthRate: 1.15,
  nutrientFlow: 1,
  pruneRate: 0.22,
  style: 'coral-veins',
  screensaverMs: 60_000,
};
