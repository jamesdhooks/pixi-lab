import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { FluidTankDemoAI } from './FluidTankDemoAI.js';
import { FluidTankPreviewScene } from './FluidTankPreviewScene.js';
import { FluidTankScene, fluidTankStyleManifest } from './FluidTankScene.js';
import { RawFluidTankScene } from './RawFluidTankScene.js';
import { FLUID_TANK_DEFAULTS, FLUID_TANK_SETTINGS_FIELDS } from './fluid-tank.config.js';

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
    qualityModes: ['basic', 'enhanced', 'raw'],
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced', 'raw']),
    demo: true,
    settings: true,
  },
  settingsFields: FLUID_TANK_SETTINGS_FIELDS,
  configDefaults: FLUID_TANK_DEFAULTS,
  styleManifest: fluidTankStyleManifest,
  modes: [
    { id: 'stir', label: 'Stir', icon: '~', description: 'Drag to inject velocity along your finger path.' },
    {
      id: 'inject',
      label: 'Inject',
      icon: '●',
      description: 'Tap or drag to drip extra dye and push a spreading force into the fluid.',
    },
  ],
  gestureMap: {
    tap: 'create a small swirl, or inject a concentrated dye drip in inject mode',
    drag: 'stir velocity in stir mode, or drip dye with spreading force in inject mode',
    fast_swipe: 'stir the tank with a stronger sweep or inject a stronger dye stream in inject mode',
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
  factory: (ctx) => (ctx.quality === 'raw' ? new RawFluidTankScene() : new FluidTankScene()),
  previewFactory: () => new FluidTankPreviewScene(),
  demoAiFactory: () => new FluidTankDemoAI(),
  tutorialPages: [
    { icon: '~', title: 'Stir The Tank', body: 'Drag through the canvas to inject velocity along the path, just like the standalone prototype.' },
    { icon: '●', title: 'Inject Mode', body: 'Switch to Inject to drip extra dye and push a soft spreading force under your pointer.' },
    { icon: '⚙', title: 'Fluid Controls', body: 'Use settings for cell size, finger force, swirl memory, dye persistence, pressure solve, eddy assist, and ambient stirring.' },
  ],
};
