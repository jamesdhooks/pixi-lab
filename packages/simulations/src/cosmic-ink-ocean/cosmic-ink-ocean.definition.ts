import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { COSMIC_INK_OCEAN_DEFAULTS, COSMIC_INK_OCEAN_SETTINGS_FIELDS } from './cosmic-ink-ocean.config.js';
import { CosmicInkOceanDemoAI } from './CosmicInkOceanDemoAI.js';
import { CosmicInkOceanPreviewScene } from './CosmicInkOceanPreviewScene.js';
import { CosmicInkOceanScene, cosmicInkOceanStyleManifest } from './CosmicInkOceanScene.js';

export const cosmicInkOceanDefinition: SimulationDefinition = {
  id: 'cosmic-ink-ocean',
  kind: 'simulation',
  name: 'Cosmic Ink Ocean',
  short: 'Ink particles ride a deterministic vector ocean, blooming into galactic dye currents.',
  long: 'A vector-field turbulence showcase where bounded ink particles deposit luminous dye into a scalar ocean. Taps seed vortices, holds reverse the flow, and drags shear cosmic currents while live controls reshape the running field.',
  tags: ['simulation', 'field', 'particles', 'turbulence'],
  icon: '🌌',
  paletteHint: 'cosmic ink',
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
  settingsFields: COSMIC_INK_OCEAN_SETTINGS_FIELDS,
  configDefaults: COSMIC_INK_OCEAN_DEFAULTS,
  styleManifest: cosmicInkOceanStyleManifest,
  gestureMap: {
    tap: 'seed a clockwise ink vortex',
    hold: 'seed a reverse pull vortex',
    drag: 'shear particles into a flowing current',
    fast_swipe: 'cut a bright current through the ocean',
  },
  directorEvents: [
    { id: 'vortex-bloom', label: 'Vortex Bloom', minIntervalMs: 6000, maxIntervalMs: 13000, intensity: 0.46 },
    { id: 'current-shear', label: 'Current Shear', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.4 },
    { id: 'reverse-tide', label: 'Reverse Tide', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.34 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when vector energy, particle motion, or visible ink variance collapses.',
    severity: 0,
  },
  defaultSeed: 260526,
  factory: () => new CosmicInkOceanScene(),
  previewFactory: () => new CosmicInkOceanPreviewScene(),
  demoAiFactory: () => new CosmicInkOceanDemoAI(),
  tutorialPages: [
    { icon: '🌀', title: 'Seed Vortices', body: 'Tap to bloom a vortex or hold to reverse the local flow.' },
    { icon: '🌊', title: 'Shear the Ocean', body: 'Drag through the field to pull ink particles into bright galactic currents.' },
  ],
};
