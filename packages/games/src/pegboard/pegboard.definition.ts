import { createEngineConfigurations, type GameDefinition } from '@hooksjam/pixi-lab-core';
import { PEGBOARD_DEFAULTS, PEGBOARD_SETTINGS_FIELDS } from './pegboard.config';
import { PegboardAI } from './PegboardAI';
import { PegboardPreviewScene } from './PegboardPreviewScene';
import { PegboardScene } from './PegboardScene';

export const pegboardTutorialPages = [
  {
    icon: '▶️',
    title: 'Start',
    body: 'Pegboard opens in a calm start state. Tap or drag in the glowing drop zone to release the first ball and begin the round.',
  },
  {
    icon: '🎯',
    title: 'Play',
    body: 'Drop balls through the neon pegs. Center bins score higher, and consecutive scores build the combo multiplier.',
  },
  {
    icon: '🏁',
    title: 'Result',
    body: 'When the drop counter reaches zero and all balls settle into bins, the game shows the result state and emits the final score.',
  },
  {
    icon: '🔁',
    title: 'Restart',
    body: 'Use the reusable Reset control from the Pixi Lab shell to clear the board, reset score/combo, and return to Start.',
  },
];

export const pegboardDefinition: GameDefinition = {
  kind: 'game',
  id: 'pegboard',
  name: 'Pegboard Pachinko',
  short: 'Drop neon balls into jackpot bins.',
  long: 'A touchscreen-first pachinko game with explicit start, play, result, and restart states. Drop balls through a glowing peg field, chase combo scores, and use the shared shell reset/tutorial/settings UI.',
  tags: ['game', 'touch', 'physics', 'score', 'pachinko'],
  icon: '🔻',
  paletteHint: 'neon',
  capabilities: {
    score: true,
    reset: true,
    tutorial: true,
    aiAutoplay: true,
    settings: true,
    qualityModes: ['basic', 'enhanced'],
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
  },
  settingsFields: PEGBOARD_SETTINGS_FIELDS,
  configDefaults: PEGBOARD_DEFAULTS,
  modes: [
    { id: 'drop', label: 'Drop', icon: '•', description: 'Tap or drag to choose the next ball drop position.' },
  ],
  tutorialPages: pegboardTutorialPages,
  factory: () => new PegboardScene(),
  previewFactory: () => new PegboardPreviewScene(),
  aiFactory: () => new PegboardAI(),
};
