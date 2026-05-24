/**
 * components/games/ballpit/ballpit.config.ts
 *
 * Ball Pit settings field definitions.
 */
import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const BALLPIT_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'maxBalls',
    label: 'Max Balls',
    type: 'number',
    min: 50,
    max: 300,
    step: 10,
    default: 200,
  },
  {
    key: 'gravity',
    label: 'Gravity',
    type: 'number',
    min: 0.1,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  {
    key: 'bounciness',
    label: 'Bounciness',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.6,
  },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: [
      { label: 'Rainbow', value: 'rainbow' },
      { label: 'Pastel', value: 'pastel' },
      { label: 'Neon', value: 'neon' },
      { label: 'Ocean', value: 'ocean' },
      { label: 'Candy', value: 'candy' },
    ],
    default: 'rainbow',
  },
  {
    key: 'audio',
    label: 'Sound Effects',
    type: 'boolean',
    default: true,
  },
];

export const BALLPIT_DEFAULTS: Record<string, unknown> = {
  maxBalls: 200,
  gravity: 1.0,
  bounciness: 0.6,
  style: 'rainbow',
  audio: true,
  screensaverMs: 60_000,
};
