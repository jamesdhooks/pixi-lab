import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ParticleFluidDemoAI } from './ParticleFluidDemoAI.js';
import { ParticleFluidPreviewScene } from './ParticleFluidPreviewScene.js';
import { PARTICLE_FLUID_DEFAULTS, PARTICLE_FLUID_SETTINGS_FIELDS } from './particle-fluid.config.js';
import { RawParticleFluidScene } from './RawParticleFluidScene.js';

export const particleFluidStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'haxiomic-cyan',
  capabilities: { renderLayers: ['particles', 'glow'], passes: ['primitive', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'haxiomic-cyan', name: 'Haxiomic Cyan', palette: [0x22001e, 0x017aff, 0xa1ecff, 0xffffff], background: 0x000000, passes: ['primitive'], uniforms: {} },
    { id: 'magenta-current', name: 'Magenta Current', palette: [0x230019, 0xff2fd6, 0x7df9ff, 0xffffff], background: 0x050007, passes: ['primitive'], uniforms: {} },
    { id: 'phosphor-stream', name: 'Phosphor Stream', palette: [0x021307, 0x6dff58, 0xecff9a, 0xffffff], background: 0x000704, passes: ['primitive'], uniforms: {} },
    { id: 'ember-wake', name: 'Ember Wake', palette: [0x1f0602, 0xff6b1a, 0xfff0b8, 0xffffff], background: 0x070201, passes: ['primitive'], uniforms: {} },
    { id: 'ultraviolet-rift', name: 'Ultraviolet Rift', palette: [0x100329, 0x8b5cf6, 0xf0abfc, 0xffffff], background: 0x03000a, passes: ['primitive'], uniforms: {} },
    { id: 'arctic-spark', name: 'Arctic Spark', palette: [0x041621, 0x8de9ff, 0xffffff, 0x7dd3fc], background: 0x00070b, passes: ['primitive'], uniforms: {} },
    { id: 'laser-red', name: 'Laser Red', palette: [0x210006, 0xff1248, 0xffd6df, 0xffffff], background: 0x060003, passes: ['primitive'], uniforms: {} },
    { id: 'blueprint-ink', name: 'Blueprint Ink', palette: [0x07111f, 0x4ea1ff, 0xdcecff, 0xffffff], background: 0x020817, passes: ['primitive'], uniforms: {} },
    { id: 'solar-flare', name: 'Solar Flare', palette: [0x1c0800, 0xfacc15, 0xfffbeb, 0xff6b1a], background: 0x050200, passes: ['primitive'], uniforms: {} },
    { id: 'deep-sea-ion', name: 'Deep Sea Ion', palette: [0x001316, 0x14f1d9, 0xd9fff8, 0x67e8f9], background: 0x00080b, passes: ['primitive'], uniforms: {} },
  ],
};

export const particleFluidDefinition: SimulationDefinition = {
  id: 'particle-fluid',
  kind: 'simulation',
  name: 'Particle Fluid',
  short: 'Stir a glowing cloud of fluid-like particles.',
  long: 'Stir a glowing cloud of particles and watch the current flow.',
  tags: ['simulation', 'fluid', 'particles', 'raw-webgl'],
  attributions: [
    {
      label: 'GPU Fluid Experiments',
      href: 'https://github.com/haxiomic/GPU-Fluid-Experiments',
      author: 'Haxiomic',
      license: 'GPL-3.0',
    },
  ],
  icon: '~',
  paletteHint: 'cyan',
  capabilities: {
    tutorial: true,
    interactive: true,
    ambient: true,
    gestures: true,
    reset: true,
    debugOverlay: true,
    styleExport: true,
    engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }),
    demo: true,
    settings: true,
  },
  settingsFields: PARTICLE_FLUID_SETTINGS_FIELDS,
  configDefaults: PARTICLE_FLUID_DEFAULTS,
  styleManifest: particleFluidStyleManifest,
  gestureMap: {
    drag: 'stir the particle velocity field',
  },
  directorEvents: [
    { id: 'eddy-sweep', label: 'Eddy Sweep', minIntervalMs: 8000, maxIntervalMs: 18000, intensity: 0.45 },
    { id: 'particle-sweep', label: 'Particle Sweep', minIntervalMs: 18000, maxIntervalMs: 32000, intensity: 0.72 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover by reseeding the particle field when motion collapses.',
    severity: 0,
  },
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'custom-raw-model',
    portability: 'reusable-core',
    supportedShapes: ['circle', 'field'],
    reusableFor: ['particle fluid studies', 'velocity advection references', 'fluid-like point renderers'],
    caveats: ['Adapts Haxiomic GPU Fluid Experiments into Pixi Lab raw WebGL2 with the source-like GPU velocity and particle split, plus a CPU compatibility fallback when float render targets are unavailable.'],
  },
  defaultSeed: 260706,
  factory: () => new RawParticleFluidScene(),
  previewFactory: () => new ParticleFluidPreviewScene(),
  demoAiFactory: (ctx) => new ParticleFluidDemoAI({ liteMode: ctx.isPreview }),
  tutorialPages: [
    { icon: '~', title: 'Drag The Current', body: 'Press and drag through the scene to disturb the velocity field.' },
    { icon: '*', title: 'Inspired by / adapted from', body: 'Inspired by Haxiomic GPU Fluid Experiments, then adapted with Pixi Lab-specific raw WebGL particles, palettes, settings, previews, and demo automation.' },
  ],
};
