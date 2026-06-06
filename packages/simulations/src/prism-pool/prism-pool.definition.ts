import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { PRISM_POOL_DEFAULTS, PRISM_POOL_SETTINGS_FIELDS } from './prism-pool.config.js';
import { PrismPoolDemoAI } from './PrismPoolDemoAI.js';
import { PrismPoolPreviewScene } from './PrismPoolPreviewScene.js';
import { PrismPoolScene, prismPoolStyleManifest } from './PrismPoolScene.js';

export const prismPoolDefinition: SimulationDefinition = {
  id: 'prism-pool',
  kind: 'simulation',
  name: 'Prism Pool',
  short: 'Rippling fake-normal water throws spectral caustics across a luminous pool.',
  long: 'A deterministic ripple-height field projects fake normals and caustic energy through shared field renderers. Tap to drop waves, drag to rake refractive bands, hold to pull a trough, and swipe to flash the whole pool into rainbow interference.',
  tags: ['simulation', 'water', 'caustics', 'fake-normals'],
  icon: '💎',
  paletteHint: 'glass caustics',
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
    qualityModes: ['basic', 'enhanced'],
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
    demo: true,
    settings: true,
  },
  settingsFields: PRISM_POOL_SETTINGS_FIELDS,
  configDefaults: PRISM_POOL_DEFAULTS,
  styleManifest: prismPoolStyleManifest,
  gestureMap: {
    tap: 'drop a circular refractive ripple',
    hold: 'pull a cool trough into the pool surface',
    drag: 'rake caustic bands through the water',
    fast_swipe: 'send a high-energy prism wave across the pool',
  },
  directorEvents: [
    { id: 'caustic-bloom', label: 'Caustic Bloom', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.44 },
    { id: 'prism-rake', label: 'Prism Rake', minIntervalMs: 8000, maxIntervalMs: 15000, intensity: 0.5 },
    { id: 'moon-pulse', label: 'Moon Pulse', minIntervalMs: 13000, maxIntervalMs: 23000, intensity: 0.32 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when ripple energy, height variance, or caustic variance collapses.',
    severity: 0,
  },
  defaultSeed: 260529,
  factory: () => new PrismPoolScene(),
  previewFactory: () => new PrismPoolPreviewScene(),
  demoAiFactory: () => new PrismPoolDemoAI(),
  tutorialPages: [
    { icon: '💧', title: 'Drop Waves', body: 'Tap to create glassy rings and hold to pull darker troughs through the water surface.' },
    { icon: '🌈', title: 'Rake the Light', body: 'Drag and swipe to bend caustic bands; demo mode also cycles styles and numeric controls live.' },
  ],
};
