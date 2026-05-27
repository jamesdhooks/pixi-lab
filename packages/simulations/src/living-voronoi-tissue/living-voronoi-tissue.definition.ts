import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { LIVING_VORONOI_TISSUE_DEFAULTS, LIVING_VORONOI_TISSUE_SETTINGS_FIELDS } from './living-voronoi-tissue.config.js';
import { LivingVoronoiTissueDemoAI } from './LivingVoronoiTissueDemoAI.js';
import { LivingVoronoiTissuePreviewScene } from './LivingVoronoiTissuePreviewScene.js';
import { LivingVoronoiTissueScene, livingVoronoiTissueStyleManifest } from './LivingVoronoiTissueScene.js';

export const livingVoronoiTissueDefinition: SimulationDefinition = {
  id: 'living-voronoi-tissue',
  kind: 'simulation',
  name: 'Living Voronoi Tissue',
  short: 'Living territories divide, migrate, and pulse through glowing Voronoi membranes.',
  long: 'A deterministic tissue colony projects moving cells into weighted Voronoi territory fields. Competing membranes glow where territories meet, cells divide under energy pressure, and gestures can pulse, compress, or shear the tissue like a living microscope slide.',
  tags: ['simulation', 'voronoi', 'tissue', 'territory'],
  icon: '🧫',
  paletteHint: 'bioluminescent Voronoi membranes',
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
  settingsFields: LIVING_VORONOI_TISSUE_SETTINGS_FIELDS,
  configDefaults: LIVING_VORONOI_TISSUE_DEFAULTS,
  styleManifest: livingVoronoiTissueStyleManifest,
  gestureMap: {
    tap: 'seed a local mitosis pulse that energizes nearby cells',
    hold: 'compress a territory pocket and push cells away from pressure',
    drag: 'shear membranes into flowing tissue folds',
    fast_swipe: 'throw a strong shear wave through multiple territories',
  },
  directorEvents: [
    { id: 'mitosis-wave', label: 'Mitosis Wave', minIntervalMs: 8000, maxIntervalMs: 15000, intensity: 0.45 },
    { id: 'membrane-spasm', label: 'Membrane Spasm', minIntervalMs: 10000, maxIntervalMs: 18000, intensity: 0.5 },
    { id: 'nutrient-signal', label: 'Nutrient Signal', minIntervalMs: 13000, maxIntervalMs: 24000, intensity: 0.36 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when membrane motion, boundary variance, or signal contrast collapses.',
    severity: 0,
  },
  defaultSeed: 270518,
  factory: () => new LivingVoronoiTissueScene(),
  previewFactory: () => new LivingVoronoiTissuePreviewScene(),
  demoAiFactory: () => new LivingVoronoiTissueDemoAI(),
  tutorialPages: [
    { icon: '🫧', title: 'Pulse the Colony', body: 'Tap or hold to inject pressure and energy. Nearby territories swell, contract, and repaint their membrane borders.' },
    { icon: '〰️', title: 'Shear the Tissue', body: 'Drag or swipe to pull cells through the colony. The weighted Voronoi field reassigns territory as cells migrate.' },
  ],
};
