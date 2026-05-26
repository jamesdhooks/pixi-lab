import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const TURING_SKIN_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'feedRate', label: 'Feed Rate', type: 'number', min: 0.018, max: 0.082, step: 0.001, default: 0.046 },
  { key: 'killRate', label: 'Kill Rate', type: 'number', min: 0.042, max: 0.074, step: 0.001, default: 0.061 },
  { key: 'diffusionA', label: 'Diffusion A', type: 'number', min: 0.55, max: 1.25, step: 0.01, default: 1 },
  { key: 'diffusionB', label: 'Diffusion B', type: 'number', min: 0.18, max: 0.72, step: 0.01, default: 0.5 },
  { key: 'brushStrength', label: 'Brush Strength', type: 'number', min: 0.15, max: 1.8, step: 0.05, default: 0.85 },
];

export const TURING_SKIN_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  feedRate: 0.046,
  killRate: 0.061,
  diffusionA: 1,
  diffusionB: 0.5,
  brushStrength: 0.85,
  style: 'leopard-gold',
  debug: false,
  screensaverMs: 60_000,
};
