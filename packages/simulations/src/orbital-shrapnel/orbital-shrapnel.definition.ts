import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ORBITAL_SHRAPNEL_DEFAULTS, ORBITAL_SHRAPNEL_SETTINGS_FIELDS } from './orbital-shrapnel.config.js';
import { OrbitalShrapnelDemoAI } from './OrbitalShrapnelDemoAI.js';
import { OrbitalShrapnelPreviewScene } from './OrbitalShrapnelPreviewScene.js';
import { OrbitalShrapnelScene, orbitalShrapnelStyleManifest } from './OrbitalShrapnelScene.js';

export const orbitalShrapnelDefinition: SimulationDefinition = {
  id: 'orbital-shrapnel',
  kind: 'simulation',
  name: 'Orbital Shrapnel Field',
  short: 'Triangular debris arcs around a planet, leaving glowing dust trails and shockwave ripples.',
  long: 'A deterministic orbital particle field with central gravity, transient touch-created gravity wells, swipe shockwaves, and a low-resolution trail field rendered through shared simulation layers.',
  tags: ['simulation', 'particles', 'space', 'trails'],
  icon: '🪐',
  paletteHint: 'cosmic',
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
    qualityModes: ['basic', 'enhanced', 'raw'],
    demo: true,
    settings: true,
  },
  settingsFields: ORBITAL_SHRAPNEL_SETTINGS_FIELDS,
  configDefaults: ORBITAL_SHRAPNEL_DEFAULTS,
  styleManifest: orbitalShrapnelStyleManifest,
  gestureMap: {
    tap: 'send a soft shockwave through the ring',
    drag: 'swish nearby debris into new orbital bands',
    hold: 'create a temporary gravity well',
    fast_swipe: 'trigger a stronger debris shockwave',
  },
  directorEvents: [
    { id: 'meteor-shower', label: 'Meteor Shower', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.42 },
    { id: 'gravity-pulse', label: 'Gravity Pulse', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.38 },
    { id: 'dust-shear', label: 'Dust Shear', minIntervalMs: 6000, maxIntervalMs: 14000, intensity: 0.32 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when the ring loses velocity, radial variation, or visible dust trails.',
    severity: 0,
  },
  defaultSeed: 771203,
  factory: () => new OrbitalShrapnelScene(),
  previewFactory: () => new OrbitalShrapnelPreviewScene(),
  demoAiFactory: () => new OrbitalShrapnelDemoAI(),
  tutorialPages: [
    { icon: '🌀', title: 'Swish the Ring', body: 'Drag across the field to bend dust and debris into fresh orbital bands.' },
    { icon: '🌑', title: 'Gravity Wells', body: 'Hold anywhere to pull nearby shards toward a temporary attractor.' },
    { icon: '💥', title: 'Shockwaves', body: 'Fast swipes send a ripple through the debris cloud without increasing particle count.' },
  ],
};
