import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { DomScriptScene } from '@hooksjam/pixi-lab-core';
import { FluidTankDemoAI } from './FluidTankDemoAI.js';
import { FluidTankPreviewScene } from './FluidTankPreviewScene.js';
import { fluidTankStyleManifest } from './FluidTankScene.js';
import { FLUID_TANK_DEFAULTS, FLUID_TANK_SETTINGS_FIELDS } from './fluid-tank.config.js';
import { fluidRuntimeMarkup } from './fluid-runtime-markup.js';
import { fluidRuntimeScript } from './fluid-runtime-script.js';

export const fluidTankDefinition: SimulationDefinition = {
  id: 'fluid-tank',
  kind: 'simulation',
  name: 'Fluid Tank',
  short: 'A bounded GPU fluid tank with high-resolution dye advection and finger swirls.',
  long: 'A WebGL2 half-float stable-fluid simulation based on the standalone fluids prototype, promoted into the engine as a reusable GPU fluid renderer with shared settings, gestures, styles, and demo automation.',
  tags: ['simulation', 'fluid', 'webgl', 'shader', 'ambient'],
  icon: '🌊',
  paletteHint: 'plasma',
  transparentBackground: true,
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
    demo: true,
    settings: true,
  },
  settingsFields: FLUID_TANK_SETTINGS_FIELDS,
  configDefaults: FLUID_TANK_DEFAULTS,
  styleManifest: fluidTankStyleManifest,
  modes: [
    { id: 'stir', label: 'Stir', icon: '~', description: 'Drag to inject velocity along your finger path.' },
    { id: 'settle', label: 'Settle', icon: '○', description: 'Tap to clear fluid velocity while keeping the dye.' },
  ],
  gestureMap: {
    tap: 'create a small swirl or settle the velocity in settle mode',
    drag: 'inject bounded velocity along the pointer path',
    fast_swipe: 'stir the tank with a stronger sweep',
  },
  directorEvents: [
    { id: 'ambient-eddy', label: 'Ambient Eddy', minIntervalMs: 5000, maxIntervalMs: 11000, intensity: 0.35 },
    { id: 'dye-refresh', label: 'Refresh Dye', minIntervalMs: 18000, maxIntervalMs: 32000, intensity: 0.7 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover by reseeding dye or settling velocity when WebGL resources fail or motion collapses.',
    severity: 0,
  },
  defaultSeed: 260527,
  factory: () => new DomScriptScene({ name: 'Fluid Tank', markup: fluidRuntimeMarkup, script: fluidRuntimeScript }),
  previewFactory: () => new FluidTankPreviewScene(),
  demoAiFactory: () => new FluidTankDemoAI(),
  tutorialPages: [
    { icon: '~', title: 'Stir The Tank', body: 'Drag through the canvas to inject velocity along the path, just like the standalone prototype.' },
    { icon: '○', title: 'Settle Mode', body: 'Switch to Settle and tap when you want to calm the fluid without losing the dye.' },
    { icon: '⚙', title: 'Fluid Controls', body: 'Use settings for cell size, finger force, swirl memory, dye persistence, pressure solve, eddy assist, and ambient stirring.' },
  ],
};
