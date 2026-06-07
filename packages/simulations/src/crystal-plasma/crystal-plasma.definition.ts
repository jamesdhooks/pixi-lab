import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { CRYSTAL_PLASMA_DEFAULTS, CRYSTAL_PLASMA_SETTINGS_FIELDS } from './crystal-plasma.config.js';
import { CrystalPlasmaDemoAI } from './CrystalPlasmaDemoAI.js';
import { CrystalPlasmaPreviewScene } from './CrystalPlasmaPreviewScene.js';
import { CrystalPlasmaScene, crystalPlasmaStyleManifest } from './CrystalPlasmaScene.js';

export const crystalPlasmaDefinition: SimulationDefinition = {
  id: 'crystal-plasma',
  kind: 'simulation',
  name: 'Crystal Plasma Storm',
  short: 'Electric crystals grow, charge, and fracture across a stressed triangular lattice.',
  long: 'A deterministic crystal lattice storm where taps seed facets, holds charge brittle stress, and swipes carve glowing fault lines through a bounded stress and fracture field rendered by shared simulation layers.',
  tags: ['simulation', 'crystal', 'plasma', 'grid'],
  icon: '💎',
  paletteHint: 'electric',
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
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
    demo: true,
    settings: true,
  },
  settingsFields: CRYSTAL_PLASMA_SETTINGS_FIELDS,
  configDefaults: CRYSTAL_PLASMA_DEFAULTS,
  styleManifest: crystalPlasmaStyleManifest,
  gestureMap: {
    tap: 'seed new crystal facets',
    drag: 'paint charge stress through the lattice',
    hold: 'build an overcharged brittle stress bloom',
    fast_swipe: 'fracture crystal faults and discharge stress',
  },
  directorEvents: [
    { id: 'growth-spurt', label: 'Crystal Growth Spurt', minIntervalMs: 5500, maxIntervalMs: 12500, intensity: 0.34 },
    { id: 'stress-bloom', label: 'Stress Bloom', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.36 },
    { id: 'random-fracture', label: 'Random Fracture', minIntervalMs: 8500, maxIntervalMs: 17000, intensity: 0.3 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when crystal growth drains stress or the lattice becomes too uniform.',
    severity: 0,
  },
  defaultSeed: 893441,
  factory: () => new CrystalPlasmaScene(),
  previewFactory: () => new CrystalPlasmaPreviewScene(),
  demoAiFactory: () => new CrystalPlasmaDemoAI(),
  tutorialPages: [
    { icon: '💎', title: 'Seed Facets', body: 'Tap to grow new charged crystal facets.' },
    { icon: '🌈', title: 'Charge Stress', body: 'Hold or drag to build bright stress in the triangular lattice.' },
    { icon: '⚡', title: 'Fracture Faults', body: 'Fast swipes carve glowing fault lines that fade into the field.' },
  ],
};
