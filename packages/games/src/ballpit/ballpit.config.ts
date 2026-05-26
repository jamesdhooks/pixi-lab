/**
 * components/games/ballpit/ballpit.config.ts
 *
 * Ball Pit settings field definitions.
 */
import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const BALLPIT_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'ballSize',
    label: 'Ball Size',
    type: 'number',
    min: 5,
    max: 200,
    step: 1,
    default: 19,
  },
  {
    key: 'rapidSpeed',
    label: 'Spawn Rate',
    type: 'number',
    min: 5,
    max: 100,
    step: 5,
    default: 10,
    visibleModes: ['rapid'],
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
    key: 'explodeStrength',
    label: 'Explode Force',
    type: 'number',
    min: 10,
    max: 200,
    step: 10,
    default: 50,
    visibleModes: ['explode'],
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
  ballSize: 19,
  rapidSpeed: 10,
  explodeStrength: 50,
  gravity: 1.0,
  bounciness: 0.6,
  style: 'rainbow',
  audio: true,
  screensaverMs: 60_000,
};
