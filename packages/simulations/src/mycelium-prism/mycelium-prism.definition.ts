import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { MYCELIUM_PRISM_DEFAULTS, MYCELIUM_PRISM_SETTINGS_FIELDS } from './mycelium-prism.config.js';
import { MyceliumPrismDemoAI } from './MyceliumPrismDemoAI.js';
import { MyceliumPrismPreviewScene } from './MyceliumPrismPreviewScene.js';
import { MyceliumPrismScene, myceliumPrismStyleManifest } from './MyceliumPrismScene.js';

export const myceliumPrismDefinition: SimulationDefinition = {
  id: 'mycelium-prism',
  kind: 'simulation',
  name: 'Mycelium Prism',
  short: 'Triangular fungal colonies spread through glowing nutrient veins.',
  long: 'A triangular-grid fungal growth simulation where competing strains crawl through nutrients, pulse active veins, and recover from exhausted frontiers.',
  tags: ['simulation', 'grid', 'growth', 'ambient'],
  icon: '△',
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
    qualityModes: ['basic', 'enhanced'],
    demo: true,
    settings: true,
  },
  settingsFields: MYCELIUM_PRISM_SETTINGS_FIELDS,
  configDefaults: MYCELIUM_PRISM_DEFAULTS,
  styleManifest: myceliumPrismStyleManifest,
  gestureMap: {
    tap: 'add a new spore colony',
    drag: 'continuously add spore colonies',
    hold: 'reset the colony bed',
  },
  directorEvents: [
    { id: 'spore-rain', label: 'Spore Rain', minIntervalMs: 7000, maxIntervalMs: 14000, intensity: 0.35 },
    { id: 'vein-pulse', label: 'Vein Pulse', minIntervalMs: 5000, maxIntervalMs: 11000, intensity: 0.45 },
    { id: 'nutrient-bloom', label: 'Nutrient Bloom', minIntervalMs: 10000, maxIntervalMs: 18000, intensity: 0.5 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when growth fronts are exhausted or colony energy remains low.',
    severity: 0,
  },
  defaultSeed: 260525,
  factory: () => new MyceliumPrismScene(),
  previewFactory: () => new MyceliumPrismPreviewScene(),
  demoAiFactory: () => new MyceliumPrismDemoAI(),
  tutorialPages: [
    { icon: '✦', title: 'Add Spores', body: 'Tap or drag to plant new glowing fungal colonies.' },
    { icon: '↺', title: 'Reset Growth', body: 'Hold to restart the colony bed.' },
  ],
};
