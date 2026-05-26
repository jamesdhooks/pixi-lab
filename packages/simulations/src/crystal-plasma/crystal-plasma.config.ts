import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const CRYSTAL_PLASMA_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'maxCrystals', label: 'Crystal Budget', type: 'number', min: 80, max: 520, step: 20, default: 260 },
  { key: 'fieldColumns', label: 'Stress Field Columns', type: 'number', min: 32, max: 128, step: 8, default: 72 },
  { key: 'stressDecay', label: 'Stress Persistence', type: 'number', min: 0.94, max: 0.996, step: 0.002, default: 0.986 },
  { key: 'growthBias', label: 'Growth Bias', type: 'number', min: 0.35, max: 1.4, step: 0.05, default: 0.75 },
  { key: 'fractureGlow', label: 'Fracture Glow', type: 'number', min: 0.2, max: 1.4, step: 0.05, default: 0.8 },
];

export const CRYSTAL_PLASMA_DEFAULTS: Record<string, unknown> = {
  maxCrystals: 260,
  fieldColumns: 72,
  stressDecay: 0.986,
  growthBias: 0.75,
  fractureGlow: 0.8,
  style: 'ice-lightning',
  debug: false,
  screensaverMs: 60_000,
};
