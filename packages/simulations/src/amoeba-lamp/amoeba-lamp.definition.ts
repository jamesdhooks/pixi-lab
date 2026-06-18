import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { AMOEBA_LAMP_DEFAULTS, AMOEBA_LAMP_SETTINGS_FIELDS } from './amoeba-lamp.config.js';
import { AmoebaLampDemoAI } from './AmoebaLampDemoAI.js';
import { AmoebaLampPreviewScene } from './AmoebaLampPreviewScene.js';
import { AmoebaLampScene, amoebaLampStyleManifest } from './AmoebaLampScene.js';

export const amoebaLampDefinition: SimulationDefinition = {
  id: 'amoeba-lamp',
  kind: 'simulation',
  name: 'Amoeba Lamp',
  short: 'Glowing lava-lamp organisms merge, split, and rise through heated metaball soup.',
  long: 'A deterministic density-field biosoup made from blob particles with surface tension, buoyancy, heat plumes, and swipe-driven splitting rendered through the shared field layer.',
  tags: ['simulation', 'metaballs', 'fluid', 'ambient'],
  icon: '🫧',
  paletteHint: 'plasma',
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
    qualityModes: ['basic', 'enhanced', 'raw'],
    demo: true,
    settings: true,
  },
  settingsFields: AMOEBA_LAMP_SETTINGS_FIELDS,
  configDefaults: AMOEBA_LAMP_DEFAULTS,
  styleManifest: amoebaLampStyleManifest,
  gestureMap: {
    tap: 'spawn a small amoeba blob',
    drag: 'stir nearby blob particles and membranes',
    hold: 'inject a buoyant heat plume',
    fast_swipe: 'split the nearest oversized blob',
  },
  directorEvents: [
    { id: 'heat-plume', label: 'Inject Heat Plume', minIntervalMs: 6000, maxIntervalMs: 13000, intensity: 0.45 },
    { id: 'split-giant', label: 'Split Oversized Blob', minIntervalMs: 9000, maxIntervalMs: 16000, intensity: 0.5 },
    { id: 'micro-bubbles', label: 'Spawn Micro Bubbles', minIntervalMs: 8000, maxIntervalMs: 15000, intensity: 0.3 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when blob motion collapses or all membranes merge into one organism.',
    severity: 0,
  },
  defaultSeed: 260608,
  factory: () => new AmoebaLampScene(),
  previewFactory: () => new AmoebaLampPreviewScene(),
  demoAiFactory: () => new AmoebaLampDemoAI(),
  tutorialPages: [
    { icon: '〰', title: 'Stir the Soup', body: 'Drag through the lamp to shear and pull glowing blob membranes.' },
    { icon: '♨', title: 'Heat Plumes', body: 'Hold to inject heat so organisms rise and stretch.' },
    { icon: '✂', title: 'Split Blobs', body: 'Fast swipes divide oversized blobs into new drifting colonies.' },
  ],
};
