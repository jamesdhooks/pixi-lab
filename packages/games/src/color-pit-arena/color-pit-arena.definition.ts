import type { GameDefinition } from '@hooksjam/pixi-lab-core';
import { COLOR_PIT_DEFAULTS, COLOR_PIT_SETTINGS_FIELDS } from './color-pit-arena.config';
import { ColorPitAI } from './ColorPitAI';
import { ColorPitPreviewScene } from './ColorPitPreviewScene';
import { ColorPitScene } from './ColorPitScene';

export const colorPitTutorialPages = [
  { icon: '▶️', title: 'Start', body: 'Color Pit starts idle. Tap the pit to release the first colored ball and begin the round.' },
  { icon: '🎨', title: 'Play', body: 'Balls fall into four labeled color lanes. Tap near a falling ball to nudge it toward the matching lane before it drains.' },
  { icon: '⚠️', title: 'Overflow', body: 'Matched colors score and build a streak. Mismatches add overflow pressure; too much overflow busts the run.' },
  { icon: '🔁', title: 'Restart', body: 'Use the shared Reset control to clear score, overflow, active balls, and return to Start.' },
];

export const colorPitArenaDefinition: GameDefinition = {
  kind: 'game', id: 'color-pit-arena', name: 'Color Pit Arena', short: 'Nudge falling colors into matching lanes.',
  long: 'A touchscreen sorting game with explicit start, play, overflow, result, and restart flow. Route colored balls into matching bins, build streaks, and prevent the pit from overflowing.',
  tags: ['game', 'touch', 'physics', 'score', 'sorting'], icon: '🎨', paletteHint: 'neon',
  capabilities: { score: true, reset: true, tutorial: true, aiAutoplay: true, settings: true },
  settingsFields: COLOR_PIT_SETTINGS_FIELDS, configDefaults: COLOR_PIT_DEFAULTS,
  modes: [{ id: 'nudge', label: 'Nudge', icon: '↔', description: 'Tap near falling balls to nudge them toward the matching color lane.' }],
  tutorialPages: colorPitTutorialPages,
  factory: () => new ColorPitScene(), previewFactory: () => new ColorPitPreviewScene(), aiFactory: () => new ColorPitAI(),
};
