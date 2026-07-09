import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { RawSparksScene } from './RawSparksScene.js';
import { SparksDemoAI } from './SparksDemoAI.js';
import { SparksPreviewScene } from './SparksPreviewScene.js';
import { SPARKS_DEFAULTS, SPARKS_SETTINGS_FIELDS } from './sparks.config.js';
import { sparksStyleManifest } from './sparksStyleManifest.js';
import { BUILD_MODE_ICON, buildModeDefinition } from '../shared/build-mode.js';

export const sparksDefinition: SimulationDefinition = {
  id: 'sparks',
  kind: 'simulation',
  name: 'Sparks',
  short: 'Create bright sparks that bounce off rails.',
  long: 'Create bright sparks with welding, pinwheel, or downward shower emitters, then build rails for them to bounce from.',
  tags: ['simulation', 'particles', 'sparks', 'welding', 'gpu'],
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
  settingsFields: SPARKS_SETTINGS_FIELDS,
  configDefaults: SPARKS_DEFAULTS,
  styleManifest: sparksStyleManifest,
  modes: [
    { id: 'welding', label: 'Welding', icon: '+', description: 'Press or drag to make sparks.' },
    { id: 'pinwheel', label: 'Pinwheel', icon: '@', description: 'Emit sparks in a rotating tangential pattern.' },
    { id: 'shower', label: 'Shower', icon: '|', description: 'Emit downward-only sparks without inherited input velocity.' },
    buildModeDefinition('Tap for a short rail or drag to draw a rail.'),
  ],
  gestureMap: {
    tap: 'make a spark burst',
    drag: 'emit continuously or draw a rail in Build mode',
  },
  directorEvents: [
    { id: 'white-hot-pass', label: 'White Hot Pass', minIntervalMs: 7000, maxIntervalMs: 14000, intensity: 0.62 },
    { id: 'split-shard-rain', label: 'Split Shard Rain', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.7 },
    { id: 'magnesium-flare', label: 'Magnesium Flare', minIntervalMs: 12000, maxIntervalMs: 24000, intensity: 0.78 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover if no welding contact, queued sparks, or trail energy remain during demo mode.',
    severity: 0,
  },
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'custom-raw-model',
    portability: 'demo-adapter',
    supportedShapes: ['circle', 'box'],
    reusableFor: ['high-count spark effects', 'lifespan-bounded GPU particle motion', 'bouncing contact fragments', 'welding and grinding effects'],
    caveats: ['Contact emission is CPU-scheduled; spark motion, lifespan, bounce response, shard mutation, secondary bounce bursts, trails, and rendering are GPU-resident.'],
  },
  defaultSeed: 760431,
  factory: () => new RawSparksScene(),
  previewFactory: () => new SparksPreviewScene(),
  demoAiFactory: (ctx) => new SparksDemoAI({
    liteMode: ctx.isPreview,
    rawParticleTextureSizeMax: ctx.isPreview ? 256 : 768,
  }),
  tutorialPages: [
    { icon: '+', title: 'Welding Mode', body: 'Press for one burst or drag over the bench to keep the contact point active.' },
    { icon: '@', title: 'Pinwheel Mode', body: 'Switch to Pinwheel for rotating tangential spark sprays from the contact point.' },
    { icon: '|', title: 'Shower Mode', body: 'Switch to Shower for downward-only sparks that ignore pointer velocity.' },
    { icon: BUILD_MODE_ICON, title: 'Build Rails', body: 'Switch to Build and draw simple rails for sparks to ricochet from.' },
    { icon: 'GPU', title: 'Raw Spark Engine', body: 'Spark state lives in GPU textures and renders through Basic, Enhanced, and Ultra pipelines.' },
  ],
};
