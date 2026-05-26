import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const MYCELIUM_LATTICE_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'resolution',         label: 'Resolution',              type: 'number', min: 32,   max: 512,  step: 32,   default: 96   },
  { key: 'growthProbability',  label: 'Growth Probability',      type: 'number', min: 0.05, max: 1.00, step: 0.05, default: 0.52 },
  { key: 'branchChance',       label: 'Branch Chance',           type: 'number', min: 0.00, max: 0.50, step: 0.02, default: 0.10 },
  { key: 'generationHueStep',  label: 'Generation Palette Step', type: 'number', min: 1,    max: 40,   step: 1,    default: 13   },
];

export const MYCELIUM_LATTICE_DEFAULTS: Record<string, unknown> = {
  resolution: 96,
  growthProbability: 0.52,
  branchChance: 0.10,
  generationHueStep: 13,
  strainCount: 6,
  initialSpores: 12,
  maxTips: 8000,
  forwardBias: 1.0,
  sideBias: 0.42,
  style: 'earth-overgrowth',
  debug: false,
  screensaverMs: 60_000,
};
