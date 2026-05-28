import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { MYCELIUM_LATTICE_DEFAULTS, MYCELIUM_LATTICE_SETTINGS_FIELDS } from './mycelium-lattice.config.js';
import { MyceliumLatticeDemoAI } from './MyceliumLatticeDemoAI.js';
import { MyceliumLatticePreviewScene } from './MyceliumLatticePreviewScene.js';
import { MyceliumLatticeScene, myceliumLatticeStyleManifest } from './MyceliumLatticeScene.js';

export const myceliumLatticeDefinition: SimulationDefinition = {
  id: 'mycelium-lattice',
  kind: 'simulation',
  name: 'Mycelium Lattice',
  short: 'Probability-driven triangular fungal growth through an earth-toned lattice.',
  long:
    'Watch fungal tips spread through a triangular mesh grid, guided by growth probability and branch chance. '
    + 'Tap or drag to seed new colonies. The generation hue step makes older growth slowly shift colour.',
  tags: ['simulation', 'grid', 'growth', 'ambient'],
  icon: '⬡',
  paletteHint: 'earth',
  gestureMap: {
    tap:  'seed a new spore cluster',
    drag: 'continuously scatter spores',
  },
  tutorialPages: [
    { icon: '✦', title: 'Add Spores', body: 'Tap anywhere to seed a new spore cluster. Drag to scatter spores continuously.' },
  ],
  settingsFields: MYCELIUM_LATTICE_SETTINGS_FIELDS,
  configDefaults: MYCELIUM_LATTICE_DEFAULTS,
  styleManifest: myceliumLatticeStyleManifest,
  defaultSeed: 260527,
  directorEvents: [
    { id: 'spore-scatter', label: 'Spore Scatter', minIntervalMs: 8000,  maxIntervalMs: 16000, intensity: 0.30 },
    { id: 'tip-surge',     label: 'Tip Surge',     minIntervalMs: 6000,  maxIntervalMs: 12000, intensity: 0.50 },
    { id: 'hue-drift',     label: 'Hue Drift',     minIntervalMs: 12000, maxIntervalMs: 22000, intensity: 0.40 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when fungal active tips, occupancy variance, or growth energy collapse.',
    severity: 0,
  },
  capabilities: {
    demo: true,
    settings: true,
    gestures: true,
    tutorial: true,
    interactive: true,
    ambient: true,
    reset: true,
    directorMode: true,
    stagnationRecovery: true,
    debugOverlay: true,
    styleExport: true,
    proceduralTextures: true,
    renderTargetPool: true,
    qualityModes: ['basic', 'enhanced'],
  },
  factory:        () => new MyceliumLatticeScene(),
  previewFactory: () => new MyceliumLatticePreviewScene(),
  demoAiFactory:  () => new MyceliumLatticeDemoAI(),
};
