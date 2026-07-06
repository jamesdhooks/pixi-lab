/**
 * components/games/ballpit/ballpit.definition.ts
 *
 * Ball Pit SimulationDefinition — registered as an interactive simulation.
 */
import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
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
  long: 'A raw WebGL physics stress scene for dense circle piles using the shared advanced solver.',
  tags: ['physics', 'simulation', 'raw-webgl', 'advanced-engine'],
  icon: '🔴',
  paletteHint: 'rainbow',
  capabilities: {
    score: false,
    aiAutoplay: false,
    screensaver: false,
    tutorial: true,
    demo: true,
    reset: true,
    qualityModes: ['raw'],
    engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }),
  },
  settingsFields: BALLPIT_SETTINGS_FIELDS,
  configDefaults: BALLPIT_DEFAULTS,
  modes: [
    { id: 'single', label: 'Single', icon: '•', description: 'Tap once to drop one ball.' },
    { id: 'stream', label: 'Stream', icon: '⋯', description: 'Hold to pour a continuous stream of balls.' },
    { id: 'interact', label: 'Interact', icon: '✋', description: 'Drag existing balls around directly.' },
    { id: 'explosion', label: 'Explosion', icon: '◎', description: 'Tap to push nearby balls outward with a force impulse.' },
  ],
  styleManifest: {
    defaultStyleId: 'rainbow',
    capabilities: { renderLayers: ['primitive'], passes: ['primitive', 'bloom'], qualities: ['raw'] },
    styles: [
      { id: 'rainbow', name: 'Rainbow', description: 'Bright mixed ball colors.', palette: [0x8b5cf6, 0x22d3ee, 0xff6b9d, 0x4ade80, 0xfb923c], background: 0x050816, passes: ['primitive'], uniforms: {} },
      { id: 'pastel', name: 'Pastel', description: 'Soft low-contrast colors.', palette: [0xf0abfc, 0xbfdbfe, 0xfde68a, 0xbbf7d0], background: 0x111827, passes: ['primitive'], uniforms: {} },
      { id: 'neon', name: 'Neon', description: 'High-energy glow palette.', palette: [0x00f5ff, 0xff00e5, 0xd8ff00, 0xff7a00], background: 0x020617, passes: ['primitive', 'bloom'], uniforms: {} },
      { id: 'ocean', name: 'Ocean', description: 'Cool blue-green palette.', palette: [0x38bdf8, 0x0ea5e9, 0x14b8a6, 0xa7f3d0], background: 0x031525, passes: ['primitive'], uniforms: {} },
      { id: 'candy', name: 'Candy', description: 'Sweet saturated palette.', palette: [0xfb7185, 0xf9a8d4, 0xfacc15, 0x93c5fd], background: 0x171124, passes: ['primitive'], uniforms: {} },
      { id: 'rubber-room', name: 'Rubber Room', description: 'Primary toy-bin colors with a clean arcade floor.', palette: [0xef4444, 0x2563eb, 0xfacc15, 0x22c55e, 0xffffff], background: 0x07101f, passes: ['primitive'], uniforms: {} },
      { id: 'soda-pop', name: 'Soda Pop', description: 'Fizzy pink, orange, lime, and blue plastic balls.', palette: [0xff4d8d, 0xff8a2a, 0xc8ff3d, 0x3ddcff, 0xfff3b0], background: 0x16091d, passes: ['primitive'], uniforms: {} },
      { id: 'moon-gym', name: 'Moon Gym', description: 'Muted lunar playground colors over a dark mat.', palette: [0xe5e7eb, 0x94a3b8, 0x60a5fa, 0xc084fc, 0xf8fafc], background: 0x050713, passes: ['primitive'], uniforms: {} },
      { id: 'jungle-bounce', name: 'Jungle Bounce', description: 'Leaf greens, mango orange, and tropical flower accents.', palette: [0x14532d, 0x22c55e, 0xa3e635, 0xf97316, 0xec4899], background: 0x061207, passes: ['primitive'], uniforms: {} },
      { id: 'monochrome-pop', name: 'Monochrome Pop', description: 'Graphic black, white, graphite, and one hot red accent.', palette: [0xf8fafc, 0x111827, 0x64748b, 0xd1d5db, 0xef4444], background: 0xf3f0e8, passes: ['primitive'], uniforms: {} },
    ],
  },
  directorEvents: [],
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'advanced-circle-particles',
    portability: 'reusable-core',
    supportedShapes: ['circle'],
    reusableFor: ['falling circle piles', 'dense collision benchmarks', 'force-field interaction demos'],
    caveats: ['Ball Pit intentionally stays circle-only; other collision shapes belong in separate purpose-built demos.'],
  },
  factory: () => new BallPitRawWebGL2Scene(),
  previewFactory: () => new BallPitPreviewScene(),
  tutorialPages,
};
