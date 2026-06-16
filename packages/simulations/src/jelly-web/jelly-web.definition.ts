import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { JELLY_WEB_DEFAULTS, JELLY_WEB_SETTINGS_FIELDS } from './jelly-web.config.js';
import { JellyWebDemoAI } from './JellyWebDemoAI.js';
import { JellyWebPreviewScene } from './JellyWebPreviewScene.js';
import { JellyWebScene, jellyWebStyleManifest } from './JellyWebScene.js';

export const jellyWebDefinition: SimulationDefinition = {
  id: 'jelly-web',
  kind: 'simulation',
  name: 'Jelly Web Resonator',
  short: 'A luminous spring web ripples like gelatin when touched, plucked, and overdriven.',
  long: 'A deterministic soft-body spring lattice built on the shared SpringSystem. Web nodes pulse through a low-resolution resonance field, with gestures plucking waves across elastic rings and demo mode cycling tension, damping, resonance, and web density live.',
  tags: ['simulation', 'spring', 'soft-body', 'web', 'ambient'],
  icon: '🪼',
  paletteHint: 'bioluminescent spring web',
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
  settingsFields: JELLY_WEB_SETTINGS_FIELDS,
  configDefaults: JELLY_WEB_DEFAULTS,
  styleManifest: jellyWebStyleManifest,
  gestureMap: {
    tap: 'pluck a circular resonance pulse through the web',
    drag: 'pull nearby jelly nodes into an elastic shear wave',
    hold: 'invert the pulse and draw membrane strands inward',
    fast_swipe: 'overdrive the lattice with a high-energy shockwave',
  },
  directorEvents: [
    { id: 'web-pluck', label: 'Pluck Web', minIntervalMs: 5000, maxIntervalMs: 10000, intensity: 0.42 },
    { id: 'resonance-swell', label: 'Resonance Swell', minIntervalMs: 9000, maxIntervalMs: 16000, intensity: 0.58 },
    { id: 'gelatin-shock', label: 'Gelatin Shockwave', minIntervalMs: 11000, maxIntervalMs: 19000, intensity: 0.7 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when the spring web loses visible displacement and settles into a static resting lattice.',
    severity: 0,
  },
  defaultSeed: 261010,
  factory: () => new JellyWebScene(),
  previewFactory: () => new JellyWebPreviewScene(),
  demoAiFactory: () => new JellyWebDemoAI(),
  tutorialPages: [
    { icon: '◎', title: 'Pluck the Web', body: 'Tap to send circular waves through the elastic rings.' },
    { icon: '〰', title: 'Shear the Gel', body: 'Drag across strands to pull the membrane into a soft-body wave.' },
    { icon: '⚡', title: 'Overdrive Resonance', body: 'Fast swipes inject shockwaves that light up the whole lattice.' },
  ],
};
