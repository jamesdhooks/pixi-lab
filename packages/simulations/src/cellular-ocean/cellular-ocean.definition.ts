import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { CELLULAR_OCEAN_DEFAULTS, CELLULAR_OCEAN_SETTINGS_FIELDS } from './cellular-ocean.config.js';
import { CellularOceanDemoAI } from './CellularOceanDemoAI.js';
import { CellularOceanPreviewScene } from './CellularOceanPreviewScene.js';
import { CellularOceanScene, cellularOceanStyleManifest } from './CellularOceanScene.js';

export const cellularOceanDefinition: SimulationDefinition = {
  id: 'cellular-ocean',
  kind: 'simulation',
  name: 'Cellular Ocean',
  short: 'Soft membrane cells drift, collide, and pulse through a glowing microscopic sea.',
  long: 'A deterministic spring-membrane simulation where bounded soft cells float through an ocean density field. Gestures pluck, shear, and shock the membranes while demo mode cycles cell budgets, membrane points, tension, viscosity, drift, resolution, and styles live.',
  tags: ['simulation', 'soft-body', 'cells', 'spring', 'ambient'],
  icon: '🦠',
  paletteHint: 'bioluminescent cellular tide',
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
  settingsFields: CELLULAR_OCEAN_SETTINGS_FIELDS,
  configDefaults: CELLULAR_OCEAN_DEFAULTS,
  styleManifest: cellularOceanStyleManifest,
  gestureMap: {
    tap: 'send an osmotic pulse through nearby cell membranes',
    drag: 'shear cells into a flowing membrane current',
    hold: 'invert pressure and pull membranes inward',
    fast_swipe: 'shock the ocean and scatter cells into a new pattern',
  },
  directorEvents: [
    { id: 'cell-bloom', label: 'Cell Bloom', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.45 },
    { id: 'tide-shear', label: 'Tide Shear', minIntervalMs: 9000, maxIntervalMs: 15000, intensity: 0.55 },
    { id: 'osmotic-shock', label: 'Osmotic Shock', minIntervalMs: 12000, maxIntervalMs: 21000, intensity: 0.72 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when membranes settle and the cellular density field becomes too uniform.',
    severity: 0,
  },
  defaultSeed: 271111,
  factory: () => new CellularOceanScene(),
  previewFactory: () => new CellularOceanPreviewScene(),
  demoAiFactory: () => new CellularOceanDemoAI(),
  tutorialPages: [
    { icon: '◌', title: 'Pulse Cells', body: 'Tap to send an osmotic pressure wave through nearby membranes.' },
    { icon: '〰', title: 'Shear the Tide', body: 'Drag to pull cells into a soft ocean current.' },
    { icon: '✦', title: 'Shock the Ocean', body: 'Fast swipes scatter cells and light up membrane edges.' },
  ],
};
