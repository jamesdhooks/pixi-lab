import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ORBITAL_SHRAPNEL_DEFAULTS, ORBITAL_SHRAPNEL_SETTINGS_FIELDS } from './orbital-shrapnel.config.js';
import { OrbitalShrapnelDemoAI } from './OrbitalShrapnelDemoAI.js';
import { OrbitalShrapnelPreviewScene } from './OrbitalShrapnelPreviewScene.js';
import { OrbitalShrapnelScene, orbitalShrapnelStyleManifest } from './OrbitalShrapnelScene.js';
import { RawOrbitalShrapnelReferenceScene } from './RawOrbitalShrapnelReferenceScene.js';

export const orbitalShrapnelDefinition: SimulationDefinition = {
  id: 'orbital-shrapnel',
  kind: 'simulation',
  name: 'Orbital Shrapnel Field',
  short: 'Triangular debris starts in stable orbit, then bends around touch-driven bodies.',
  long: 'A deterministic orbital particle field with central gravity, orbit-matched shrapnel insertion, moving-body influence, and a low-resolution trail field rendered through shared simulation layers.',
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
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced', 'raw']),
    demo: true,
    settings: true,
  },
  settingsFields: ORBITAL_SHRAPNEL_SETTINGS_FIELDS,
  configDefaults: ORBITAL_SHRAPNEL_DEFAULTS,
  styleManifest: orbitalShrapnelStyleManifest,
  modes: [
    { id: 'add', label: 'Add', icon: '+', description: 'Tap or drag to add shrapnel with pointer velocity' },
    { id: 'influence', label: 'Influence', icon: '●', description: 'Drag like a moving body through the field' },
  ],
  gestureMap: {
    tap: 'use the selected orbital tool at the pointer',
    drag: 'repeat the selected orbital tool continuously',
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
  factory: (ctx) => (ctx.quality === 'raw' ? new RawOrbitalShrapnelReferenceScene() : new OrbitalShrapnelScene()),
  previewFactory: () => new OrbitalShrapnelPreviewScene(),
  demoAiFactory: () => new OrbitalShrapnelDemoAI(),
  tutorialPages: [
    { icon: '+', title: 'Add Shrapnel', body: 'Tap or drag to add shards that inherit your pointer motion.' },
    { icon: '●', title: 'Influence Field', body: 'Drag through the ring as a moving body that pushes particles aside.' },
  ],
};
