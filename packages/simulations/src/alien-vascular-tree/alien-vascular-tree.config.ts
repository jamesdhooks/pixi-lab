import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const ALIEN_VASCULAR_TREE_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'branchBudget', label: 'Branch Budget', type: 'number', min: 48, max: 360, step: 8, default: 160 },
  { key: 'growthRate', label: 'Growth Rate', type: 'number', min: 0.15, max: 2.4, step: 0.05, default: 0.9 },
  { key: 'nutrientFlow', label: 'Nutrient Flow', type: 'number', min: 0.1, max: 2.2, step: 0.05, default: 1.0 },
  { key: 'pruneRate', label: 'Prune Rate', type: 'number', min: 0.01, max: 0.9, step: 0.01, default: 0.18 },
];

export const ALIEN_VASCULAR_TREE_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  branchBudget: 160,
  growthRate: 0.9,
  nutrientFlow: 1.0,
  pruneRate: 0.18,
  style: 'neon-roots',
  debug: false,
  screensaverMs: 60_000,
};
