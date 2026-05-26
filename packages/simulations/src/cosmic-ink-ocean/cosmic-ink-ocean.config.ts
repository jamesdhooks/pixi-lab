import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const COSMIC_INK_OCEAN_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'particleCount', label: 'Ink Particles', type: 'number', min: 128, max: 1200, step: 32, default: 520 },
  { key: 'resolution', label: 'Resolution', type: 'number', min: 32, max: 512, step: 32, default: 96 },
  { key: 'turbulence', label: 'Turbulence', type: 'number', min: 0.2, max: 3.2, step: 0.05, default: 1.35 },
  { key: 'flowSpeed', label: 'Flow Speed', type: 'number', min: 0.2, max: 2.4, step: 0.05, default: 1 },
  { key: 'inkDiffusion', label: 'Ink Diffusion', type: 'number', min: 0.86, max: 0.994, step: 0.004, default: 0.964 },
  { key: 'vortexStrength', label: 'Vortex Strength', type: 'number', min: 0.1, max: 2.8, step: 0.05, default: 1.1 },
];

export const COSMIC_INK_OCEAN_DEFAULTS: Record<string, unknown> = {
  particleCount: 520,
  resolution: 96,
  turbulence: 1.35,
  flowSpeed: 1,
  inkDiffusion: 0.964,
  vortexStrength: 1.1,
  style: 'nebula-ink',
  debug: false,
  screensaverMs: 60_000,
};
