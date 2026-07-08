import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const TURING_SKIN_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'renderStyle', label: 'Pattern', section: 'Rendering', type: 'select', default: 'spots', options: [{ label: 'Animal Spots', value: 'spots' }, { label: 'Zebra Bands', value: 'bands' }] },
  { key: 'timeScale', label: 'Timescale', section: 'Simulation', type: 'number', min: 0, max: 2, step: 0.05, default: 1 },
  { key: 'resolution', label: 'Resolution', section: 'Simulation', type: 'number', min: 64, max: 4096, step: 1, numericScale: 'powerOfTwo', default: 128 },
  { key: 'feedRate', label: 'Pattern Growth', section: 'Chemistry', type: 'number', min: 0.018, max: 0.082, step: 0.001, default: 0.044 },
  { key: 'killRate', label: 'Pattern Breakup', section: 'Chemistry', type: 'number', min: 0.042, max: 0.074, step: 0.001, default: 0.06 },
  { key: 'diffusionA', label: 'Background Spread', section: 'Chemistry', type: 'number', min: 0.55, max: 1.25, step: 0.01, default: 1 },
  { key: 'diffusionB', label: 'Pigment Spread', section: 'Chemistry', type: 'number', min: 0.18, max: 0.72, step: 0.01, default: 0.46 },
  { key: 'brushStrength', label: 'Paint Strength', section: 'Input Mode', type: 'number', min: 0.15, max: 1.8, step: 0.05, default: 0.75, visibleModes: ['paint', 'erase'] },
];

export const TURING_SKIN_DEFAULTS: Record<string, unknown> = {
  renderStyle: 'spots',
  timeScale: 1,
  resolution: 128,
  feedRate: 0.044,
  killRate: 0.06,
  diffusionA: 1,
  diffusionB: 0.46,
  brushStrength: 0.75,
  style: 'leopard-gold',
  screensaverMs: 60_000,
};
