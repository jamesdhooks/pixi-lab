import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const FLUID_TANK_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'cellSize', label: 'Resolution / Cell Size', type: 'number', min: 0.85, max: 3.2, step: 0.05, default: 1.2 },
  { key: 'fingerForce', label: 'Finger Force', type: 'number', min: 1, max: 32, step: 0.5, default: 8 },
  { key: 'fingerRadius', label: 'Finger Size', type: 'number', min: 0.01, max: 0.06, step: 0.001, default: 0.026 },
  { key: 'viscosity', label: 'Viscosity / Damping', type: 'number', min: 0, max: 1, step: 0.01, default: 0.22 },
  { key: 'curl', label: 'Swirl Memory', type: 'number', min: 0, max: 24, step: 0.5, default: 6 },
  { key: 'eddyAssist', label: 'Finger Eddy Assist', type: 'number', min: 0, max: 0.35, step: 0.01, default: 0 },
  { key: 'dyePersistence', label: 'Dye Persistence', type: 'number', min: 0.995, max: 1, step: 0.0001, default: 0.9996 },
  { key: 'pressureIterations', label: 'Pressure Solve', type: 'number', min: 10, max: 36, step: 1, default: 24 },
  { key: 'ambient', label: 'Ambient Stir', type: 'boolean', default: false },
];

export const FLUID_TANK_DEFAULTS: Record<string, unknown> = {
  cellSize: 1.2,
  fingerForce: 8,
  fingerRadius: 0.026,
  viscosity: 0.22,
  curl: 6,
  eddyAssist: 0,
  dyePersistence: 0.9996,
  pressureIterations: 24,
  ambient: false,
  style: 'bounded-cyan',
  screensaverMs: 60_000,
};
