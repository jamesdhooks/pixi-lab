import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const PEGBOARD_DEFAULTS = {
  maxDrops: 12,
  gravity: 720,
  bounce: 0.86,
  sparkleIntensity: 1,
} as const;

export const PEGBOARD_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'maxDrops',
    label: 'Drops per round',
    description: 'How many balls the player gets before the result screen.',
    section: 'Game Rules',
    type: 'number',
    min: 5,
    max: 24,
    step: 1,
    default: PEGBOARD_DEFAULTS.maxDrops,
  },
  {
    key: 'gravity',
    label: 'Gravity',
    description: 'Higher values make balls tumble through the pegs faster.',
    section: 'Board Physics',
    type: 'number',
    min: 420,
    max: 1080,
    step: 30,
    default: PEGBOARD_DEFAULTS.gravity,
  },
  {
    key: 'bounce',
    label: 'Peg bounce',
    description: 'Controls how energetic peg ricochets feel.',
    section: 'Board Physics',
    type: 'number',
    min: 0.55,
    max: 1.15,
    step: 0.05,
    default: PEGBOARD_DEFAULTS.bounce,
  },
  {
    key: 'sparkleIntensity',
    label: 'Sparkle intensity',
    description: 'Controls score bursts, glows, and celebratory particles.',
    section: 'Visuals',
    type: 'number',
    min: 0,
    max: 2,
    step: 0.25,
    default: PEGBOARD_DEFAULTS.sparkleIntensity,
  },
];
