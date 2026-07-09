import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const COLOR_PIT_DEFAULTS = {
  roundBalls: 36,
  spawnCadence: 0.72,
  gravity: 520,
  overflowLimit: 8,
} as const;

export const COLOR_PIT_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'roundBalls', label: 'Balls per round', description: 'How many colored balls enter the arena before the result state.', section: 'Game Rules', type: 'number', min: 12, max: 72, step: 1, default: COLOR_PIT_DEFAULTS.roundBalls },
  { key: 'spawnCadence', label: 'Spawn cadence', description: 'Seconds between falling balls. Lower values increase pressure.', section: 'Game Rules', type: 'number', min: 0.35, max: 1.4, step: 0.05, default: COLOR_PIT_DEFAULTS.spawnCadence },
  { key: 'gravity', label: 'Gravity', description: 'How quickly balls fall through the sorting pit.', section: 'Pit Physics', type: 'number', min: 320, max: 880, step: 20, default: COLOR_PIT_DEFAULTS.gravity },
  { key: 'overflowLimit', label: 'Overflow limit', description: 'Mismatched balls allowed before the round busts.', section: 'Game Rules', type: 'number', min: 3, max: 16, step: 1, default: COLOR_PIT_DEFAULTS.overflowLimit },
];
