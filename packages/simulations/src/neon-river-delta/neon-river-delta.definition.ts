import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { NEON_RIVER_DELTA_DEFAULTS, NEON_RIVER_DELTA_SETTINGS_FIELDS } from './neon-river-delta.config.js';
import { NeonRiverDeltaDemoAI } from './NeonRiverDeltaDemoAI.js';
import { NeonRiverDeltaPreviewScene } from './NeonRiverDeltaPreviewScene.js';
import { NeonRiverDeltaScene, neonRiverDeltaStyleManifest } from './NeonRiverDeltaScene.js';

export const neonRiverDeltaDefinition: SimulationDefinition = {
  id: 'neon-river-delta',
  kind: 'simulation',
  name: 'Neon River Delta',
  short: 'Braided neon channels erode luminous sediment into a living delta fan.',
  long: 'A deterministic height-field erosion model routes rainfall through branching channels, carries glowing sediment, and rebuilds itself when flow stagnates. Tap to seed rain pools, drag to carve distributaries, hold to raise a levee, and swipe to cut a high-energy flood path.',
  tags: ['simulation', 'erosion', 'height-field', 'water'],
  icon: '🟦',
  paletteHint: 'neon sediment',
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
    demo: true,
    settings: true,
  },
  settingsFields: NEON_RIVER_DELTA_SETTINGS_FIELDS,
  configDefaults: NEON_RIVER_DELTA_DEFAULTS,
  styleManifest: neonRiverDeltaStyleManifest,
  gestureMap: {
    tap: 'add a local rain pool that seeks a downhill channel',
    hold: 'raise a temporary levee that splits the flow',
    drag: 'carve a glowing distributary across the terrain',
    fast_swipe: 'cut a flood channel through the delta fan',
  },
  directorEvents: [
    { id: 'monsoon-pulse', label: 'Monsoon Pulse', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.46 },
    { id: 'sediment-bloom', label: 'Sediment Bloom', minIntervalMs: 9000, maxIntervalMs: 16000, intensity: 0.42 },
    { id: 'delta-avulsion', label: 'Delta Avulsion', minIntervalMs: 14000, maxIntervalMs: 24000, intensity: 0.52 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when water variance, sediment variance, or downhill flow energy collapses.',
    severity: 0,
  },
  defaultSeed: 260531,
  factory: () => new NeonRiverDeltaScene(),
  previewFactory: () => new NeonRiverDeltaPreviewScene(),
  demoAiFactory: () => new NeonRiverDeltaDemoAI(),
  tutorialPages: [
    { icon: '🌧️', title: 'Feed the Delta', body: 'Tap to add rain pools and watch the height field find braided downhill channels.' },
    { icon: '⚡', title: 'Carve and Split', body: 'Drag or swipe to cut distributaries; hold to raise levees that force avulsions and new glowing sediment paths.' },
  ],
};
