import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const TIME_ECHO_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'particleCount', label: 'Particle Count', type: 'number', min: 96, max: 900, step: 24, default: 360 },
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 64 },
  { key: 'historyLength', label: 'Echo History', type: 'number', min: 12, max: 84, step: 4, default: 42 },
  { key: 'echoDelay', label: 'Echo Delay', type: 'number', min: 3, max: 28, step: 1, default: 12 },
  { key: 'memoryPull', label: 'Memory Pull', type: 'number', min: 0.12, max: 2.8, step: 0.04, default: 1.15 },
  { key: 'trailFade', label: 'Echo Persistence', type: 'number', min: 0.88, max: 0.996, step: 0.004, default: 0.962 },
];

export const TIME_ECHO_DEFAULTS: Record<string, unknown> = {
  particleCount: 360,
  resolution: 64,
  historyLength: 42,
  echoDelay: 12,
  memoryPull: 1.15,
  trailFade: 0.962,
  drag: 0.012,
  style: 'ghost-loop',
  debug: false,
  screensaverMs: 60_000,
};
