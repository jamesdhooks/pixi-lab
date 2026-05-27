import type { EffectDefinition } from '@hooksjam/pixi-lab-core';
import { FIREFLIES_DEFAULTS } from './fireflies.config.js';
import { FirefliesScene, firefliesStyleManifest } from './FirefliesScene.js';

export const firefliesDefinition: EffectDefinition = {
  id: 'fireflies',
  kind: 'effect',
  renderModes: ['foregroundOverlay', 'fullscreen', 'previewTile'],
  name: 'Fireflies',
  short: 'A quiet night foreground overlay with deterministic glowing fireflies.',
  long: 'Fireflies is a transparent foreground overlay for passive dashboards and seasonal ambient scenes. It uses deterministic seeded pulses, optional weather/presence/time snapshots, and synthetic fallback data so a calm night meadow remains demoable without live integrations.',
  tags: ['effect', 'overlay', 'night', 'seasonal', 'low-motion'],
  icon: '✨',
  paletteHint: 'quiet-meadow',
  capabilities: {
    reset: true,
    debugOverlay: true,
    styleExport: true,
    lowMotion: true,
    sleepMode: true,
    qualityModes: ['basic', 'enhanced'],
    settings: true,
  },
  configDefaults: { ...FIREFLIES_DEFAULTS },
  styleManifest: firefliesStyleManifest,
  settingsFields: [
    { key: 'fireflyCount', label: 'Firefly Count', description: 'Seeded particle budget for the foreground overlay.', type: 'number', min: 24, max: 900, step: 24, default: FIREFLIES_DEFAULTS.fireflyCount },
    { key: 'intensity', label: 'Intensity', description: 'Global glow and visibility multiplier.', type: 'number', min: 0.08, max: 1, step: 0.04, default: FIREFLIES_DEFAULTS.intensity },
    { key: 'maxBrightness', label: 'Max Brightness', description: 'Caps firefly alpha so foreground UI remains readable.', type: 'number', min: 0.12, max: 0.86, step: 0.04, default: FIREFLIES_DEFAULTS.maxBrightness },
    { key: 'glow', label: 'Glow', description: 'Controls pulse size and glow strength.', type: 'number', min: 0, max: 1, step: 0.04, default: FIREFLIES_DEFAULTS.glow },
    { key: 'drift', label: 'Drift', description: 'Controls firefly wandering speed.', type: 'number', min: 0, max: 1, step: 0.04, default: FIREFLIES_DEFAULTS.drift },
    { key: 'meadow', label: 'Meadow Activity', description: 'Manual habitat/activity signal mixed with presence or synthetic data.', type: 'number', min: 0, max: 1, step: 0.04, default: FIREFLIES_DEFAULTS.meadow },
    { key: 'sleepMode', label: 'Sleep Mode', description: 'Dims and thins fireflies for overnight passive displays.', type: 'boolean', default: FIREFLIES_DEFAULTS.sleepMode },
    { key: 'lowMotion', label: 'Low Motion', description: 'Reduces wandering and visible fireflies while preserving the night meadow read.', type: 'boolean', default: FIREFLIES_DEFAULTS.lowMotion },
  ],
  factory: () => new FirefliesScene(false),
  previewFactory: () => new FirefliesScene(true),
  defaultSeed: 20260704,
  tutorialPages: [
    { icon: '✨', title: 'Quiet night overlay', body: 'Fireflies is designed for transparent foreground use and keeps brightness capped so UI remains readable.' },
    { icon: '🌦️', title: 'Weather optional', body: 'Humidity, daylight, clouds, and presence can shape the glow, while synthetic fallback data keeps the gallery demoable.' },
    { icon: '🌙', title: 'Passive controls', body: 'Firefly budget, intensity, brightness, glow, drift, meadow activity, sleep mode, and low motion all apply while the scene runs.' },
  ],
};
