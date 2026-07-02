/**
 * components/games/ballpit/ballpit.definition.ts
 *
 * Ball Pit SimulationDefinition — registered as an interactive simulation.
 */
import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { BallPitScene } from './BallPitScene';
import { BallPitRawWebGL2Scene } from './BallPitRawWebGL2Scene';
import { BallPitPreviewScene } from './BallPitPreviewScene';
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
    icon: '🧲',
    title: 'Fill the Pit',
    body: 'Closed walls keep balls on-screen, so keep spawning and stirring the pit.',
  },
];

export const ballPitDefinition: SimulationDefinition = {
  kind: 'simulation',
  id: 'ball-pit',
  name: 'Ball Pit',
  short: 'Spawn bouncy balls!',
  long: 'Tap to drop colourful physics balls. Drag to attract them, pour streams, or launch radial bursts.',
  tags: ['physics', 'casual', 'endless'],
  icon: '🔴',
  paletteHint: 'rainbow',
  capabilities: {
    score: false,
    aiAutoplay: false,
    screensaver: false,
    tutorial: true,
    demo: true,
    qualityModes: ['basic', 'enhanced', 'raw'],
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced', 'raw'], { rawBackend: 'webgl2' }),
  },
  settingsFields: BALLPIT_SETTINGS_FIELDS,
  configDefaults: BALLPIT_DEFAULTS,
  modes: [
    { id: 'single', label: 'Single', description: 'Tap once to drop one ball.' },
    { id: 'stream', label: 'Stream', description: 'Hold to pour a continuous stream of balls.' },
    { id: 'explosion', label: 'Explosion', description: 'Tap to launch a burst of balls.' },
  ],
  styleManifest: {
    defaultStyleId: 'rainbow',
    capabilities: { renderLayers: ['primitive'], passes: ['primitive', 'bloom'], qualities: ['basic', 'enhanced', 'raw'] },
    styles: [
      { id: 'rainbow', name: 'Rainbow', description: 'Bright mixed ball colors.', palette: [0x8b5cf6, 0x22d3ee, 0xff6b9d, 0x4ade80, 0xfb923c], background: 0x050816, passes: ['primitive'], uniforms: {} },
      { id: 'pastel', name: 'Pastel', description: 'Soft low-contrast colors.', palette: [0xf0abfc, 0xbfdbfe, 0xfde68a, 0xbbf7d0], background: 0x111827, passes: ['primitive'], uniforms: {} },
      { id: 'neon', name: 'Neon', description: 'High-energy glow palette.', palette: [0x00f5ff, 0xff00e5, 0xd8ff00, 0xff7a00], background: 0x020617, passes: ['primitive', 'bloom'], uniforms: {} },
      { id: 'ocean', name: 'Ocean', description: 'Cool blue-green palette.', palette: [0x38bdf8, 0x0ea5e9, 0x14b8a6, 0xa7f3d0], background: 0x031525, passes: ['primitive'], uniforms: {} },
      { id: 'candy', name: 'Candy', description: 'Sweet saturated palette.', palette: [0xfb7185, 0xf9a8d4, 0xfacc15, 0x93c5fd], background: 0x171124, passes: ['primitive'], uniforms: {} },
    ],
  },
  directorEvents: [],

  factory: (ctx) => (ctx.quality === 'raw' ? new BallPitRawWebGL2Scene() : new BallPitScene()),
  previewFactory: () => new BallPitPreviewScene(),
  tutorialPages,
};
