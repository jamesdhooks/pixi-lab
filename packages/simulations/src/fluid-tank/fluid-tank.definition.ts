import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { FluidTankDemoAI } from './FluidTankDemoAI.js';
import { FluidTankPreviewScene } from './FluidTankPreviewScene.js';
import { FLUID_TANK_DEFAULTS, FLUID_TANK_SETTINGS_FIELDS } from './fluid-tank.config.js';
import { fluidTankStyleManifest } from './fluidTankStyleManifest.js';
import { RawFluidTankScene } from './RawFluidTankScene.js';

export const fluidTankDefinition: SimulationDefinition = {
  id: 'fluid-tank',
  kind: 'simulation',
  name: 'Fluid Tank',
  short: 'A bounded raw WebGL fluid tank with dye advection and finger-driven swirls.',
  long: 'A WebGL2 stable-fluid simulation with velocity, pressure, curl, dye advection, palette remapping, contextual input tools, and demo automation adapted into the rebuilt raw simulation framework.',
  tags: ['simulation', 'fluid', 'webgl', 'shader', 'ambient'],
  attributions: [
    {
      label: 'WebGL Fluid Simulation',
      href: 'https://github.com/PavelDoGreat/WebGL-Fluid-Simulation',
      author: 'Pavel Dobryakov',
      license: 'MIT',
    },
  ],
  icon: '~',
  paletteHint: 'plasma',
  transparentBackground: false,
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
    engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }),
    demo: true,
    settings: true,
  },
  settingsFields: FLUID_TANK_SETTINGS_FIELDS,
  configDefaults: FLUID_TANK_DEFAULTS,
  styleManifest: fluidTankStyleManifest,
  modes: [
    { id: 'inject', label: 'Inject', icon: '+', description: 'Tap or drag to drip dye and push a spreading force into the fluid.' },
    { id: 'stir', label: 'Stir', icon: '~', description: 'Drag to stir velocity along the pointer path without adding dye.' },
  ],
  gestureMap: {
    tap: 'create a small velocity swirl, or inject a concentrated dye drip in inject mode',
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
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'gpu-stable-fluid',
    portability: 'reusable-core',
    supportedShapes: ['field'],
    reusableFor: ['fluid tanks', 'dye advection toys', 'smoke-like feedback fields', 'pointer-driven velocity fields'],
    caveats: ['This is a field solver, not a rigid-body collision engine; it should share settings/demo/style contracts, not particle collision code.'],
  },
  defaultSeed: 260527,
  factory: () => new RawFluidTankScene(),
  previewFactory: () => new FluidTankPreviewScene(),
  demoAiFactory: (ctx) => new FluidTankDemoAI({ liteMode: ctx.isPreview }),
  tutorialPages: [
    { icon: '~', title: 'Stir The Tank', body: 'Drag through the canvas to inject velocity along the path.' },
    { icon: '+', title: 'Inject Mode', body: 'Switch to Inject to drip dye while pushing a soft spreading force under your pointer.' },
    { icon: '*', title: 'Fluid Controls', body: 'Tune cell size, pressure solve, curl, viscosity, dye persistence, and input force from settings. Use the Style toggle for Cloud, Voronoi, Random, or Image initialization.' },
  ],
};
