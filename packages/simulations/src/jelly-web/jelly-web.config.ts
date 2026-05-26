import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const JELLY_WEB_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution', label: 'Field Resolution', type: 'number', min: 32, max: 256, step: 16, default: 96 },
  { key: 'ringCount', label: 'Web Rings', type: 'number', min: 3, max: 8, step: 1, default: 5 },
  { key: 'spokeCount', label: 'Web Spokes', type: 'number', min: 8, max: 24, step: 2, default: 16 },
  { key: 'springTension', label: 'Spring Tension', type: 'number', min: 0.08, max: 0.95, step: 0.01, default: 0.42 },
  { key: 'damping', label: 'Gel Damping', type: 'number', min: 0.86, max: 0.995, step: 0.005, default: 0.965 },
  { key: 'pulseStrength', label: 'Pulse Strength', type: 'number', min: 20, max: 220, step: 5, default: 95 },
  { key: 'resonance', label: 'Resonance', type: 'number', min: 0.4, max: 2.4, step: 0.05, default: 1.15 },
];

export const JELLY_WEB_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  ringCount: 5,
  spokeCount: 16,
  springTension: 0.42,
  damping: 0.965,
  pulseStrength: 95,
  resonance: 1.15,
  style: 'moon-jelly',
  debug: false,
  screensaverMs: 60_000,
};
