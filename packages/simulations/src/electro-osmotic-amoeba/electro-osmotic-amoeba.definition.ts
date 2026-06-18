import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ELECTRO_OSMOTIC_AMOEBA_DEFAULTS, ELECTRO_OSMOTIC_AMOEBA_SETTINGS_FIELDS } from './electro-osmotic-amoeba.config.js';
import { ElectroOsmoticAmoebaDemoAI } from './ElectroOsmoticAmoebaDemoAI.js';
import { ElectroOsmoticAmoebaPreviewScene } from './ElectroOsmoticAmoebaPreviewScene.js';
import { ElectroOsmoticAmoebaScene, electroOsmoticAmoebaStyleManifest } from './ElectroOsmoticAmoebaScene.js';

export const electroOsmoticAmoebaDefinition: SimulationDefinition = {
  id: 'electro-osmotic-amoeba',
  kind: 'simulation',
  name: 'Electro-Osmotic Amoeba',
  short: 'Charged membranes pulse and divide as ion pressure pumps luminous amoeba colonies.',
  long: 'A deterministic charged-membrane simulation built on shared density fields: ion particles carry positive/negative charge, voltage gradients pump them across soft cell membranes, and osmotic pressure makes colonies swell, split, and recombine.',
  tags: ['simulation', 'amoeba', 'electric', 'fluid', 'ambient'],
  icon: '⚡',
  paletteHint: 'electric membrane',
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
  settingsFields: ELECTRO_OSMOTIC_AMOEBA_SETTINGS_FIELDS,
  configDefaults: ELECTRO_OSMOTIC_AMOEBA_DEFAULTS,
  styleManifest: electroOsmoticAmoebaStyleManifest,
  gestureMap: {
    tap: 'seed a new charged membrane cell',
    drag: 'pull ions into an electro-osmotic current',
    hold: 'inject a local charge plume',
    fast_swipe: 'split a membrane into opposite-polarity colonies',
  },
  directorEvents: [
    { id: 'voltage-reversal', label: 'Reverse Voltage Gradient', minIntervalMs: 7000, maxIntervalMs: 14000, intensity: 0.55 },
    { id: 'ion-plume', label: 'Inject Ion Plume', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.45 },
    { id: 'membrane-fission', label: 'Membrane Fission', minIntervalMs: 9000, maxIntervalMs: 17000, intensity: 0.58 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when ion flow equalizes or all membranes collapse into one low-voltage colony.',
    severity: 0,
  },
  defaultSeed: 260909,
  factory: () => new ElectroOsmoticAmoebaScene(),
  previewFactory: () => new ElectroOsmoticAmoebaPreviewScene(),
  demoAiFactory: () => new ElectroOsmoticAmoebaDemoAI(),
  tutorialPages: [
    { icon: '⚡', title: 'Pump Ions', body: 'Drag through cells to pull charged particles into visible electro-osmotic currents.' },
    { icon: '◌', title: 'Charge Plumes', body: 'Hold to inject a local voltage plume that polarizes nearby membranes.' },
    { icon: '✂', title: 'Split Membranes', body: 'Fast swipes divide a cell into opposite-polarity colonies.' },
  ],
};
