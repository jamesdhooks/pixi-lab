import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { AMOEBA_LAMP_DEFAULTS, AMOEBA_LAMP_SETTINGS_FIELDS } from './amoeba-lamp.config.js';
import { AmoebaLampDemoAI } from './AmoebaLampDemoAI.js';
import { AmoebaLampPreviewScene } from './AmoebaLampPreviewScene.js';
import { AmoebaLampScene, amoebaLampStyleManifest } from './AmoebaLampScene.js';

export const amoebaLampDefinition: SimulationDefinition = {
  id: 'amoeba-lamp',
  kind: 'simulation',
  name: 'Amoeba Lamp',
  short: 'Glowing lava-lamp organisms merge and drift through metaball soup.',
  long: 'A deterministic density-field biosoup made from blob particles with surface tension and buoyancy, with simple add and swish interaction modes rendered through the shared field layer.',
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
  modes: [
    { id: 'add', label: 'Add', icon: '+', description: 'Tap or drag empty space to add amoebas' },
    { id: 'swish', label: 'Swish', icon: '〰', description: 'Tap or drag to pull and swish particles' },
  ],
  gestureMap: {
    tap: 'use the selected mode at the pointer',
    drag: 'repeat the selected mode continuously',
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
    { icon: '+', title: 'Add Mode', body: 'Tap or drag empty space to add new amoebas.' },
    { icon: '〰', title: 'Swish Mode', body: 'Tap or drag to pull and swish existing particles.' },
  ],
};
