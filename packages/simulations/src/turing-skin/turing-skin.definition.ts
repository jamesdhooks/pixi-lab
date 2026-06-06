import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { TURING_SKIN_DEFAULTS, TURING_SKIN_SETTINGS_FIELDS } from './turing-skin.config.js';
import { TuringSkinDemoAI } from './TuringSkinDemoAI.js';
import { TuringSkinPreviewScene } from './TuringSkinPreviewScene.js';
import { TuringSkinScene, turingSkinStyleManifest } from './TuringSkinScene.js';

export const turingSkinDefinition: SimulationDefinition = {
  id: 'turing-skin',
  kind: 'simulation',
  name: 'Turing Skin',
  short: 'Reaction-diffusion morphogens crawl into living stripes, spots, and reef-like cells.',
  long: 'A deterministic Gray-Scott reaction-diffusion surface rendered through the shared scalar field renderer. Taps seed activator blooms, holds erase pigment, and drags carve morphogen trails while live controls reshape the running chemistry.',
  tags: ['simulation', 'field', 'reaction-diffusion', 'pattern'],
  icon: '🦓',
  paletteHint: 'morphogen skin',
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
  settingsFields: TURING_SKIN_SETTINGS_FIELDS,
  configDefaults: TURING_SKIN_DEFAULTS,
  styleManifest: turingSkinStyleManifest,
  gestureMap: {
    tap: 'seed a morphogen bloom',
    hold: 'erase inhibitor and open a pale scar',
    drag: 'paint a reaction trail across the skin',
    fast_swipe: 'slash a high-energy stripe through the pattern',
  },
  directorEvents: [
    { id: 'spot-bloom', label: 'Spot Bloom', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.42 },
    { id: 'stripe-shear', label: 'Stripe Shear', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.38 },
    { id: 'morphogen-reset', label: 'Morphogen Reset', minIntervalMs: 12000, maxIntervalMs: 22000, intensity: 0.32 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when pigment variance or reaction energy collapses.',
    severity: 0,
  },
  defaultSeed: 260527,
  factory: () => new TuringSkinScene(),
  previewFactory: () => new TuringSkinPreviewScene(),
  demoAiFactory: () => new TuringSkinDemoAI(),
  tutorialPages: [
    { icon: '🧬', title: 'Seed Morphogens', body: 'Tap to bloom pigment or hold to erase a soft scar in the reaction field.' },
    { icon: '🖌️', title: 'Paint Patterns', body: 'Drag or swipe to carve fresh stripes and spots into the living skin.' },
  ],
};
