/**
 * components/games/ballpit/ballpit.definition.ts
 *
 * Ball Pit GameDefinition — register this in components/games/registry.ts.
 */
import type { GameDefinition } from '@hooksjam/pixi-lab-core';
import { BallPitScene } from './BallPitScene';
import { BallPitPreviewScene } from './BallPitPreviewScene';
import { BallPitAI } from './BallPitAI';
import { BALLPIT_SETTINGS_FIELDS, BALLPIT_DEFAULTS } from './ballpit.config';

export const tutorialPages = [
  {
    icon: '👆',
    title: 'Tap to Spawn',
    body: 'Tap anywhere on screen to drop a colourful bouncy ball.',
  },
  {
    icon: '✋',
    title: 'Drag to Attract',
    body: 'Hold and drag your finger to pull the balls toward you.',
  },
  {
    icon: '🕳️',
    title: 'Drain & Score',
    body: 'Balls that fall off the bottom earn you 5 bonus points each!',
  },
];

export const ballPitDefinition: GameDefinition = {
  kind: 'game',
  id: 'ball-pit',
  name: 'Ball Pit',
  short: 'Spawn bouncy balls!',
  long: 'Tap to drop colourful physics balls. Drag to attract them. Rack up a high score!',
  tags: ['physics', 'casual', 'endless'],
  icon: '🔴',
  paletteHint: 'rainbow',
  capabilities: {
    score: true,
    aiAutoplay: true,
    screensaver: true,
    tutorial: true,
  },
  settingsFields: BALLPIT_SETTINGS_FIELDS,
  configDefaults: BALLPIT_DEFAULTS,

  factory: (_ctx) => new BallPitScene(),
  previewFactory: (_ctx) => new BallPitPreviewScene(),
  screensaverFactory: (_ctx) => new BallPitPreviewScene(),

  aiFactory: (_ctx) => new BallPitAI(),
  tutorialPages,
};
