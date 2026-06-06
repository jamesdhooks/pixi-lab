import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { CHROMATIC_AVALANCHE_BOWL_DEFAULTS, CHROMATIC_AVALANCHE_BOWL_SETTINGS_FIELDS } from './chromatic-avalanche-bowl.config.js';
import { ChromaticAvalancheBowlDemoAI } from './ChromaticAvalancheBowlDemoAI.js';
import { ChromaticAvalancheBowlPreviewScene } from './ChromaticAvalancheBowlPreviewScene.js';
import { ChromaticAvalancheBowlScene, chromaticAvalancheBowlStyleManifest } from './ChromaticAvalancheBowlScene.js';

export const chromaticAvalancheBowlDefinition: SimulationDefinition = {
  id: 'chromatic-avalanche-bowl',
  kind: 'simulation',
  name: 'Chromatic Avalanche Bowl',
  short: 'Granular color pours tumble into a glowing sand-bowl avalanche.',
  long: 'A deterministic fake granular physics model where chromatic powder grains pour, slide, and stratify inside an elliptical bowl. Tap to pour fresh pigment, hold to mound powder, and drag or swipe to shear sediment bands while live settings alter slope, friction, chroma mixing, pour rate, resolution, and grain budget.',
  tags: ['simulation', 'granular', 'metaballs', 'particles'],
  icon: '🌈',
  paletteHint: 'chromatic powder',
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
  settingsFields: CHROMATIC_AVALANCHE_BOWL_SETTINGS_FIELDS,
  configDefaults: CHROMATIC_AVALANCHE_BOWL_DEFAULTS,
  styleManifest: chromaticAvalancheBowlStyleManifest,
  gestureMap: {
    tap: 'pour a burst of fresh pigment grains into the bowl',
    hold: 'build a colored mound and nudge nearby grains outward',
    drag: 'rake colored sediment into flowing avalanche bands',
    fast_swipe: 'launch a high-energy chromatic slide across the bowl',
  },
  directorEvents: [
    { id: 'pigment-pour', label: 'Pigment Pour', minIntervalMs: 5000, maxIntervalMs: 11000, intensity: 0.46 },
    { id: 'bowl-tilt', label: 'Bowl Tilt', minIntervalMs: 8000, maxIntervalMs: 15000, intensity: 0.42 },
    { id: 'avalanche-rake', label: 'Avalanche Rake', minIntervalMs: 9000, maxIntervalMs: 17000, intensity: 0.5 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when grains settle into a flat, low-motion, low-chroma pile.',
    severity: 0,
  },
  defaultSeed: 260529,
  factory: () => new ChromaticAvalancheBowlScene(),
  previewFactory: () => new ChromaticAvalancheBowlPreviewScene(),
  demoAiFactory: () => new ChromaticAvalancheBowlDemoAI(),
  tutorialPages: [
    { icon: '🌈', title: 'Pour Pigment', body: 'Tap or hold to add colored powder. The bowl catches it and turns the grains into dense glowing sediment.' },
    { icon: '〽️', title: 'Start Avalanches', body: 'Drag or fast-swipe to rake the pile. Slope and friction controls change how quickly color bands slide.' },
  ],
};
