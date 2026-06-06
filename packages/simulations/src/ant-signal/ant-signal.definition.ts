import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ANT_SIGNAL_DEFAULTS, ANT_SIGNAL_SETTINGS_FIELDS } from './ant-signal.config.js';
import { AntSignalDemoAI } from './AntSignalDemoAI.js';
import { AntSignalPreviewScene } from './AntSignalPreviewScene.js';
import { AntSignalScene, antSignalStyleManifest } from './AntSignalScene.js';

export const antSignalDefinition: SimulationDefinition = {
  id: 'ant-signal',
  kind: 'simulation',
  name: 'Ant Signal Civilization',
  short: 'A living swarm lays neon pheromone roads between nest and food sources.',
  long: 'Deterministic ant agents route between a central nest and food sources, reinforcing bounded pheromone trail fields that bloom into emergent colony highways through the shared simulation renderer.',
  tags: ['simulation', 'swarm', 'trails', 'emergent'],
  icon: '🐜',
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
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
    demo: true,
    settings: true,
  },
  settingsFields: ANT_SIGNAL_SETTINGS_FIELDS,
  configDefaults: ANT_SIGNAL_DEFAULTS,
  styleManifest: antSignalStyleManifest,
  gestureMap: {
    tap: 'drop a food source for the colony',
    drag: 'continuously add food sources',
    fast_swipe: 'clear nearby pheromone trails',
  },
  directorEvents: [
    { id: 'food-bloom', label: 'Food Bloom', minIntervalMs: 5000, maxIntervalMs: 12000, intensity: 0.34 },
    { id: 'trail-pulse', label: 'Pheromone Pulse', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.3 },
    { id: 'route-shift', label: 'Route Shift', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.26 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when food sources disappear or pheromone variation collapses.',
    severity: 0,
  },
  defaultSeed: 683211,
  factory: () => new AntSignalScene(),
  previewFactory: () => new AntSignalPreviewScene(),
  demoAiFactory: () => new AntSignalDemoAI(),
  tutorialPages: [
    { icon: '🍯', title: 'Feed the Colony', body: 'Tap or drag to add food sources for ants to discover.' },
    { icon: '🧹', title: 'Clear Trails', body: 'Fast swipes clear old pheromone paths so the swarm can reroute.' },
  ],
};
