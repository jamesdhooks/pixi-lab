import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { OIL_WATER_UNIVERSE_DEFAULTS, OIL_WATER_UNIVERSE_SETTINGS_FIELDS } from './oil-water-universe.config.js';
import { OilWaterUniverseDemoAI } from './OilWaterUniverseDemoAI.js';
import { OilWaterUniversePreviewScene } from './OilWaterUniversePreviewScene.js';
import { OilWaterUniverseScene, oilWaterUniverseStyleManifest } from './OilWaterUniverseScene.js';

export const oilWaterUniverseDefinition: SimulationDefinition = {
  id: 'oil-water-universe',
  kind: 'simulation',
  name: 'Oil-Water Universe',
  short: 'Immiscible fluids split into glowing islands, membranes, and cellular slicks.',
  long: 'A deterministic phase-separation field rendered through shared metaball and palette renderers. Tap to seed droplets, hold to pull water pockets through oil, and drag or swipe to shear emulsions while live controls reshape separation, tension, viscosity, and stirring.',
  tags: ['simulation', 'phase-separation', 'metaballs', 'field'],
  icon: '🫧',
  paletteHint: 'iridescent fluids',
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
  settingsFields: OIL_WATER_UNIVERSE_SETTINGS_FIELDS,
  configDefaults: OIL_WATER_UNIVERSE_DEFAULTS,
  styleManifest: oilWaterUniverseStyleManifest,
  gestureMap: {
    tap: 'seed an oil droplet into the current emulsion',
    hold: 'pull a cool water pocket through the slick',
    drag: 'stir alternating ribbons of oil and water',
    fast_swipe: 'shear the whole phase field into fresh membranes',
  },
  directorEvents: [
    { id: 'emulsion-bloom', label: 'Emulsion Bloom', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.42 },
    { id: 'surface-shear', label: 'Surface Shear', minIntervalMs: 8000, maxIntervalMs: 15000, intensity: 0.48 },
    { id: 'phase-reset', label: 'Phase Reset', minIntervalMs: 14000, maxIntervalMs: 24000, intensity: 0.34 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when phase variance, boundary energy, or mixing energy collapses.',
    severity: 0,
  },
  defaultSeed: 260528,
  factory: () => new OilWaterUniverseScene(),
  previewFactory: () => new OilWaterUniversePreviewScene(),
  demoAiFactory: () => new OilWaterUniverseDemoAI(),
  tutorialPages: [
    { icon: '💧', title: 'Seed Droplets', body: 'Tap to add bright oil islands or hold to carve water pockets through the slick.' },
    { icon: '🌀', title: 'Stir the Emulsion', body: 'Drag and swipe to shear ribbons; the fluids keep separating into glowing cellular domains.' },
  ],
};
