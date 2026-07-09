import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { FIREWORKS_DEFAULTS, FIREWORKS_SETTINGS_FIELDS } from './fireworks.config.js';
import { FireworksDemoAI } from './FireworksDemoAI.js';
import { FireworksPreviewScene } from './FireworksPreviewScene.js';
import { RawFireworksScene } from './RawFireworksScene.js';
import { fireworksStyleManifest } from './fireworksStyleManifest.js';

export const fireworksDefinition: SimulationDefinition = {
  id: 'fireworks',
  kind: 'simulation',
  name: 'Fireworks',
  short: 'Launch fireworks that bloom into colorful bursts.',
  long: 'Launch fireworks and build a colorful sky show.',
  tags: ['simulation', 'particles', 'fireworks', 'trails', 'gpu'],
  icon: '✹',
  paletteHint: 'neon',
  capabilities: {
    tutorial: true,
    interactive: true,
    ambient: true,
    gestures: true,
    reset: true,
    directorMode: true,
    stagnationRecovery: true,
    debugOverlay: true,
    styleExport: true,
    proceduralTextures: true,
    renderTargetPool: true,
    engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }),
    demo: true,
    settings: true,
  },
  settingsFields: FIREWORKS_SETTINGS_FIELDS,
  configDefaults: FIREWORKS_DEFAULTS,
  styleManifest: fireworksStyleManifest,
  modes: [
    { id: 'single', label: 'Single', icon: '^', description: 'Tap to launch one firework.' },
    { id: 'stream', label: 'Stream', icon: '*', description: 'Hold or drag to keep launching fireworks.' },
  ],
  gestureMap: {
    tap: 'launch one firework',
    drag: 'launch more fireworks in Stream mode',
  },
  directorEvents: [
    { id: 'gold-willow-finale', label: 'Gold Willow Finale', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.56 },
    { id: 'neon-crackle-run', label: 'Neon Crackle Run', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.62 },
    { id: 'secondary-cascade', label: 'Secondary Cascade', minIntervalMs: 11000, maxIntervalMs: 22000, intensity: 0.7 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover if no shells or trail energy remain during demo mode.',
    severity: 0,
  },
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'custom-raw-model',
    portability: 'demo-adapter',
    supportedShapes: ['circle'],
    reusableFor: ['high-count GPU particle stepping', 'trail feedback compositing', 'event-command particle spawning'],
    caveats: ['Launch shells are CPU-scheduled actors; dense spark motion and rendering stay GPU-resident.'],
  },
  defaultSeed: 940711,
  factory: () => new RawFireworksScene(),
  previewFactory: () => new FireworksPreviewScene(),
  demoAiFactory: (ctx) => new FireworksDemoAI({
    liteMode: ctx.isPreview,
    rawParticleTextureSizeMax: ctx.isPreview ? 256 : 1024,
  }),
  tutorialPages: [
    { icon: '^', title: 'Single Mode', body: 'Single mode treats each press as exactly one targeted shell.' },
    { icon: '*', title: 'Stream Mode', body: 'Stream mode keeps a rolling show alive while drags add extra shells.' },
    { icon: '+', title: 'Secondary Bursts', body: 'Raise Secondary Chance and Depth to get smaller recursive fireworks.' },
    { icon: 'GPU', title: 'Raw WebGL2', body: 'Spark state is stepped in GPU textures and rendered as point sprites with persistent trails.' },
  ],
};
