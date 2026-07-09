import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ORBITAL_SHRAPNEL_DEFAULTS, ORBITAL_SHRAPNEL_SETTINGS_FIELDS } from './orbital-shrapnel.config.js';
import { OrbitalShrapnelDemoAI } from './OrbitalShrapnelDemoAI.js';
import { OrbitalShrapnelPreviewScene } from './OrbitalShrapnelPreviewScene.js';
import { orbitalShrapnelStyleManifest } from './orbitalShrapnelStyleManifest.js';
import { RawOrbitalShrapnelReferenceScene } from './RawOrbitalShrapnelReferenceScene.js';

export const orbitalShrapnelDefinition: SimulationDefinition = {
  id: 'orbital-shrapnel',
  kind: 'simulation',
  name: 'Space Debris',
  short: 'Add debris and bend it around a planet.',
  long: 'Add debris, pull it with gravity, and launch asteroids around a planet.',
  tags: ['simulation', 'particles', 'space', 'trails'],
  icon: '🪐',
  paletteHint: 'cosmic',
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
  settingsFields: ORBITAL_SHRAPNEL_SETTINGS_FIELDS,
  configDefaults: ORBITAL_SHRAPNEL_DEFAULTS,
  styleManifest: orbitalShrapnelStyleManifest,
  modes: [
    { id: 'add', label: 'Add', icon: '+', description: 'Tap or drag to add debris.' },
    { id: 'interact', label: 'Interact', icon: '✋', description: 'Drag debris around.' },
    { id: 'well', label: 'Well', icon: '◎', description: 'Hold to pull debris toward a gravity well.' },
    { id: 'asteroid', label: 'Asteroid', icon: '↗', description: 'Drag and release to launch an asteroid.' },
  ],
  gestureMap: {
    tap: 'start the active space tool',
    drag: 'move Add, Interact, or Asteroid tools',
    hold: 'keep Add or Well active',
  },
  directorEvents: [
    { id: 'meteor-shower', label: 'Meteor Shower', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.42 },
    { id: 'gravity-pulse', label: 'Gravity Pulse', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.38 },
    { id: 'dust-shear', label: 'Dust Shear', minIntervalMs: 6000, maxIntervalMs: 14000, intensity: 0.32 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when the ring loses velocity, radial variation, or visible dust trails.',
    severity: 0,
  },
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'custom-raw-model',
    portability: 'demo-adapter',
    supportedShapes: ['circle'],
    reusableFor: ['high-count GPU particle rendering', 'trail-field compositing', 'raw fidelity controls'],
    caveats: ['Space Debris keeps its custom orbital model and GPU trail renderer rather than using the constraint pile solver.'],
  },
  defaultSeed: 771203,
  factory: () => new RawOrbitalShrapnelReferenceScene(),
  previewFactory: () => new OrbitalShrapnelPreviewScene(),
  demoAiFactory: (ctx) => new OrbitalShrapnelDemoAI({
    liteMode: ctx.isPreview,
    rawParticleTextureSizeMax: ctx.isPreview ? 256 : undefined,
  }),
  tutorialPages: [
    { icon: '+', title: 'Add Debris', body: 'Tap or drag to add shards that inherit your pointer motion.' },
    { icon: '✋', title: 'Interact', body: 'Drag through the ring with the shared faded interaction radius.' },
    { icon: '◎', title: 'Gravity Well', body: 'Hold to attract nearby debris into a tunable well.' },
    { icon: '↗', title: 'Asteroid Slingshot', body: 'Drag to aim, then release to launch a larger asteroid with local orbital velocity plus drag-distance boost.' },
    { icon: '◎', title: 'Mode Controls', body: 'Add emits while held, Interact drags an influence field, Well pulls while held, and Asteroid launches on release.' },
  ],
};
