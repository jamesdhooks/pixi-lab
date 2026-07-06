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
  short: 'GPU-simulated shells bloom into layered, crackling fireworks with probabilistic secondary bursts.',
  long: 'A raw WebGL2 fireworks simulation with CPU-scheduled launch actors, GPU ping-pong spark state, trail feedback, color transitions, 32 explosion templates, and recursive secondary shells.',
  tags: ['simulation', 'particles', 'fireworks', 'trails', 'gpu'],
  icon: '*',
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
    { id: 'single', label: 'Single', icon: '^', description: 'Each press launches exactly one targeted shell.' },
    { id: 'stream', label: 'Stream', icon: '*', description: 'Press, drag, or let autofire keep launching shells.' },
  ],
  gestureMap: {
    tap: 'launch one targeted shell',
    double_tap: 'launch one targeted shell without adding a duplicate tap',
    drag: 'stream extra shells only while in Stream mode',
    fast_swipe: 'launch one high-energy shell',
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
