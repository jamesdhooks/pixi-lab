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
  short: 'Stir colorful dye through a fluid tank.',
  long: 'Stir colorful dye and watch it swirl through the tank.',
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
    { id: 'inject', label: 'Inject', icon: '+', description: 'Tap or drag to add dye.' },
    { id: 'stir', label: 'Stir', icon: '~', description: 'Drag to stir the fluid.' },
  ],
  gestureMap: {
    tap: 'add a small swirl or dye drop',
    drag: 'stir the tank or add dye',
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
