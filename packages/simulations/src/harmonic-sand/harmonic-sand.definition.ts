import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { HARMONIC_SAND_DEFAULTS, HARMONIC_SAND_SETTINGS_FIELDS } from './harmonic-sand.config';
import { HarmonicSandPreviewScene } from './HarmonicSandPreviewScene';
import { HarmonicSandScene, harmonicSandStyleManifest } from './HarmonicSandScene';

export const harmonicSandDefinition: SimulationDefinition = {
  id: 'harmonic-sand',
  kind: 'simulation',
  name: 'Harmonic Sand Plate',
  short: 'Particles settle into glowing resonance lines.',
  long: 'A touch-first Chladni-inspired plate where low-resolution wave fields pull sand-like particles into living nodal patterns.',
  tags: ['simulation', 'particles', 'resonance', 'ambient'],
  icon: '✦',
  paletteHint: 'neon',
  capabilities: {
    score: false,
    aiAutoplay: false,
    screensaver: false,
    tutorial: true,
    interactive: true,
    ambient: true,
    gestures: true,
    directorMode: true,
    stagnationRecovery: true,
    debugOverlay: true,
    styleExport: true,
    proceduralTextures: true,
    renderTargetPool: true,
    qualityModes: ['basic', 'enhanced'],
  },
  settingsFields: HARMONIC_SAND_SETTINGS_FIELDS,
  configDefaults: HARMONIC_SAND_DEFAULTS,
  styleManifest: harmonicSandStyleManifest,
  gestureMap: {
    tap: 'create emitter',
    drag: 'move nearest emitter',
    hold: 'amplify frequency',
    fast_swipe: 'wave shock',
    double_tap: 'cycle style',
    pinch: 'compress pattern',
    spread: 'repel pattern',
  },
  directorEvents: [
    { id: 'frequency-sweep', label: 'Frequency Sweep', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.35 },
    { id: 'emitter-drift', label: 'Emitter Drift', minIntervalMs: 5000, maxIntervalMs: 10000, intensity: 0.25 },
    { id: 'resonance-pulse', label: 'Resonance Pulse', minIntervalMs: 9000, maxIntervalMs: 16000, intensity: 0.5 },
    { id: 'harmonic-transition', label: 'Harmonic Transition', minIntervalMs: 14000, maxIntervalMs: 22000, intensity: 0.4 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when field or particle variance remains low for more than 2.5 seconds.',
    severity: 0,
  },
  defaultSeed: 240524,
  factory: () => new HarmonicSandScene(),
  previewFactory: () => new HarmonicSandPreviewScene(),
  tutorialPages: [
    { icon: '•', title: 'Seed Resonance', body: 'Tap the plate to add a harmonic source.' },
    { icon: '↔', title: 'Shape the Field', body: 'Drag to move the nearest emitter through the sand.' },
    { icon: '◇', title: 'Charge the Plate', body: 'Hold to amplify a nearby resonance.' },
  ],
};
