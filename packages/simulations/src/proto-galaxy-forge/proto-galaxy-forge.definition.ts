import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { PROTO_GALAXY_FORGE_DEFAULTS, PROTO_GALAXY_FORGE_SETTINGS_FIELDS } from './proto-galaxy-forge.config.js';
import { ProtoGalaxyForgeDemoAI } from './ProtoGalaxyForgeDemoAI.js';
import { ProtoGalaxyForgePreviewScene } from './ProtoGalaxyForgePreviewScene.js';
import { ProtoGalaxyForgeScene, protoGalaxyForgeStyleManifest } from './ProtoGalaxyForgeScene.js';

export const protoGalaxyForgeDefinition: SimulationDefinition = {
  id: 'proto-galaxy-forge',
  kind: 'simulation',
  name: 'Proto-Galaxy Forge',
  short: 'Gravity wells spin star dust into glowing proto-galactic filaments.',
  long: 'A deterministic orbital dust model forms bright stellar nurseries around wandering gravity wells. Gesture novas, shears, and well seeds reshape the field while shared scalar and particle renderers reveal density, heat, and gravitational lensing layers.',
  tags: ['simulation', 'galaxy', 'gravity', 'particles'],
  icon: '🌌',
  paletteHint: 'nebula dust, protostar heat, and dark matter filaments',
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
  settingsFields: PROTO_GALAXY_FORGE_SETTINGS_FIELDS,
  configDefaults: PROTO_GALAXY_FORGE_DEFAULTS,
  styleManifest: protoGalaxyForgeStyleManifest,
  gestureMap: {
    tap: 'trigger a small nova that heats and scatters nearby star dust',
    hold: 'move and strengthen the nearest gravity well',
    drag: 'shear dust lanes into spiral filaments',
    fast_swipe: 'launch a stronger galactic shear wave',
  },
  directorEvents: [
    { id: 'protostar-burst', label: 'Protostar Burst', minIntervalMs: 8000, maxIntervalMs: 15000, intensity: 0.46 },
    { id: 'well-migration', label: 'Gravity Well Migration', minIntervalMs: 11000, maxIntervalMs: 19000, intensity: 0.42 },
    { id: 'filament-shear', label: 'Filament Shear', minIntervalMs: 13000, maxIntervalMs: 24000, intensity: 0.5 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when orbital motion, density variance, or heat contrast collapses.',
    severity: 0,
  },
  defaultSeed: 270519,
  factory: () => new ProtoGalaxyForgeScene(),
  previewFactory: () => new ProtoGalaxyForgePreviewScene(),
  demoAiFactory: () => new ProtoGalaxyForgeDemoAI(),
  tutorialPages: [
    { icon: '💥', title: 'Ignite Protostars', body: 'Tap to burst dust outward and add heat. Dense regions glow as fusion pressure builds.' },
    { icon: '🌀', title: 'Bend Gravity', body: 'Hold to move a gravity well, or drag to shear dust lanes into spiral arms and filaments.' },
  ],
};
