/**
 * components/games/ballpit/ballpit.definition.ts
 *
 * Ball Pit GameDefinition — register this in components/games/registry.ts.
 */
import type { GameDefinition, SimStyleManifest } from '@hooksjam/pixi-lab-core';
import { BallPitScene } from './BallPitScene.js';
import { BallPitAutoScene } from './BallPitPreviewScene.js';
import { BallPitAI } from './BallPitAI.js';
import { BALLPIT_SETTINGS_FIELDS, BALLPIT_DEFAULTS } from './ballpit.config.js';

/** StyleManifest built from the ball pit's built-in palettes so StylePicker can render swatches. */
export const ballPitStyleManifest: SimStyleManifest = {
  defaultStyleId: 'rainbow',
  capabilities: { renderLayers: [], passes: [], qualities: ['basic', 'enhanced'] },
  styles: [
    { id: 'rainbow', name: 'Rainbow', palette: [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xda77ff], background: 0x1a1a2e, passes: [], uniforms: {} },
    { id: 'pastel',  name: 'Pastel',  palette: [0xf8bbd0, 0xe1bee7, 0xbbdefb, 0xb2dfdb, 0xfff9c4, 0xffe0b2], background: 0xfce4ec, passes: [], uniforms: {} },
    { id: 'neon',    name: 'Neon',    palette: [0x00ff88, 0xff0055, 0x00cfff, 0xffee00, 0xff44aa, 0x44ffaa], background: 0x0d0d0d, passes: [], uniforms: {} },
    { id: 'ocean',   name: 'Ocean',   palette: [0x0077b6, 0x00b4d8, 0x90e0ef, 0x48cae4, 0x023e8a, 0x0096c7], background: 0x0a1628, passes: [], uniforms: {} },
    { id: 'candy',   name: 'Candy',   palette: [0xff6fe8, 0xffc3f3, 0xc77dff, 0x7b2fff, 0xff9de2, 0xd0abff], background: 0xff85c8, passes: [], uniforms: {} },
  ],
};

export const tutorialPages = [
  {
    icon: '⬤',
    title: 'Single Mode',
    body: 'Tap to drop one ball. Drag and release to throw it with velocity. Perfect for precision placement.',
  },
  {
    icon: '⬤⬤⬤',
    title: 'Rapid Mode',
    body: 'Press and hold to spray balls continuously — one every 0.1 seconds. Great for filling the pit fast!',
  },
  {
    icon: '✦',
    title: 'Explode Mode',
    body: 'Tap anywhere to trigger a shockwave — a ring of particles blasts outward and sends nearby balls flying.',
  },
  {
    icon: '🏆',
    title: 'Fill the Pit',
    body: 'Every ball adds to your score. Use the sliders at the top to tune ball size, gravity, and bounciness. Hit Reset to drain and start fresh!',
  },
];

export const ballPitDefinition: GameDefinition = {
  id: 'ball-pit',
  kind: 'game',
  name: 'Ball Pit',
  short: 'Spawn bouncy balls!',
  long: 'Tap to drop colourful physics balls. Switch between Single, Rapid and Explode modes. Rack up a high score!',
  tags: ['physics', 'casual', 'endless'],
  icon: '🔴',
  paletteHint: 'rainbow',
  capabilities: {
    score: false,
    aiAutoplay: true,
    screensaver: true,
    tutorial: true,
    demo: true,
    qualityModes: ['basic', 'enhanced'],
    reset: true,
    settings: false,
  },
  modes: [
    { id: 'single',  label: 'Single',  icon: '⬤',     description: 'Tap to drop one ball' },
    { id: 'rapid',   label: 'Rapid',   icon: '⬤⬤⬤',  description: 'Hold to spray continuously' },
    { id: 'explode', label: 'Explode', icon: '✦',     description: 'Tap to fire a shockwave' },
  ],
  settingsFields: BALLPIT_SETTINGS_FIELDS,
  configDefaults: BALLPIT_DEFAULTS,
  styleManifest: ballPitStyleManifest,

  factory: (_ctx) => new BallPitScene(),
  previewFactory: (_ctx) => new BallPitAutoScene('preview'),
  screensaverFactory: (_ctx) => new BallPitAutoScene('screensaver'),

  aiFactory: (_ctx) => new BallPitAI(),
  tutorialPages,
};
