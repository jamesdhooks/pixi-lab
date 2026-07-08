import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ParticleFluidDemoAI } from './ParticleFluidDemoAI.js';
import { ParticleFluidPreviewScene } from './ParticleFluidPreviewScene.js';
import { PARTICLE_FLUID_DEFAULTS, PARTICLE_FLUID_SETTINGS_FIELDS } from './particle-fluid.config.js';
import { RawParticleFluidScene } from './RawParticleFluidScene.js';

export const particleFluidStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'haxiomic-cyan',
  capabilities: { renderLayers: ['particles', 'density'], passes: ['primitive', 'densityMetaball', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'haxiomic-cyan', name: 'Haxiomic Cyan', palette: [0x021326, 0x00e5ff, 0xf8fbff, 0xff4fd8], background: 0x01040c, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 1.24, fieldStrength: 0.92, fieldGain: 1.05, pointScale: 1 } },
    { id: 'magenta-ink', name: 'Magenta Ink', palette: [0x15051b, 0xff2fd6, 0x52f7ff, 0xffffff], background: 0x07020d, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 1.1, fieldStrength: 0.82, fieldGain: 0.95, pointScale: 1.06 } },
    { id: 'phosphor-green', name: 'Phosphor Green', palette: [0x01160a, 0x6dff58, 0xeaff96, 0x1affd5], background: 0x000704, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 0.92, fieldStrength: 0.7, fieldGain: 0.8, pointScale: 0.96 } },
    { id: 'ember-plasma', name: 'Ember Plasma', palette: [0x1c0703, 0xff6b1a, 0xfff0b8, 0xff1f5f], background: 0x080201, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 1.38, fieldStrength: 1.05, fieldGain: 1.18, pointScale: 1.08 } },
    { id: 'ultraviolet', name: 'Ultraviolet', palette: [0x0b0622, 0x7c3cff, 0xf0d7ff, 0x00d4ff], background: 0x03010b, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 1.05, fieldStrength: 0.96, fieldGain: 0.9, pointScale: 0.92 } },
    { id: 'arctic-white', name: 'Arctic White', palette: [0x041621, 0x8de9ff, 0xffffff, 0x7dd3fc], background: 0x00070b, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 0.78, fieldStrength: 0.74, fieldGain: 0.72, pointScale: 0.86 } },
    { id: 'laser-red', name: 'Laser Red', palette: [0x190307, 0xff1248, 0xffe0e8, 0xff9f1c], background: 0x060003, passes: ['densityMetaball', 'bloom'], uniforms: { bloomStrength: 1.2, fieldStrength: 0.78, fieldGain: 0.88, pointScale: 1.02 } },
    { id: 'mono-blueprint', name: 'Mono Blueprint', palette: [0x07111f, 0x4ea1ff, 0xdcecff, 0x193c72], background: 0x020817, passes: ['densityMetaball'], uniforms: { bloomStrength: 0.34, fieldStrength: 0.5, fieldGain: 0.52, pointScale: 0.82 } },
  ],
};

export const particleFluidDefinition: SimulationDefinition = {
  id: 'particle-fluid',
  kind: 'simulation',
  name: 'Particle Fluid',
  short: 'Dense dye particles swirl like a fluid field under your pointer.',
  long: 'A raw WebGL2 particle-fluid scene inspired by Haxiomic GPU Fluid Experiments (https://github.com/haxiomic/GPU-Fluid-Experiments), implemented here as an original Pixi Lab projected flow field with dense additive particles, native palettes, settings, preview, and demo automation.',
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
  modes: [
    { id: 'vortex', label: 'Vortex', icon: '~', description: 'Drag to stir the particle fluid into local eddies.' },
    { id: 'inject', label: 'Inject', icon: '+', description: 'Drag to add fresh dye particles and momentum.' },
    { id: 'repel', label: 'Repel', icon: '*', description: 'Push the particle field away from the pointer.' },
  ],
  styleManifest: particleFluidStyleManifest,
  gestureMap: {
    tap: 'pulse nearby particles',
    drag: 'stir, inject, or repel particles depending on the selected input mode',
    fast_swipe: 'throw a strong streak of dye through the fluid',
  },
  directorEvents: [
    { id: 'eddy-sweep', label: 'Eddy Sweep', minIntervalMs: 8000, maxIntervalMs: 18000, intensity: 0.45 },
    { id: 'dye-bloom', label: 'Dye Bloom', minIntervalMs: 18000, maxIntervalMs: 32000, intensity: 0.72 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover by reseeding the particle field or injecting a dye bloom when motion collapses.',
    severity: 0,
  },
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'custom-raw-model',
    portability: 'reusable-core',
    supportedShapes: ['circle', 'field'],
    reusableFor: ['particle fluid studies', 'dye advection references', 'fluid-like point-density renderers'],
    caveats: ['Inspired by Haxiomic GPU Fluid Experiments; this implementation is original and keeps the source-like velocity, dye, and particle split inside Pixi Lab raw WebGL2, with CPU-side field integration and GPU rendering.'],
  },
  defaultSeed: 260706,
  factory: () => new RawParticleFluidScene(),
  previewFactory: () => new ParticleFluidPreviewScene(),
  demoAiFactory: (ctx) => new ParticleFluidDemoAI({ liteMode: ctx.isPreview }),
  tutorialPages: [
    { icon: '~', title: 'Vortex', body: 'Drag through the scene to bend the particle fluid into local eddies.' },
    { icon: '+', title: 'Inject', body: 'Switch to Inject to add fresh dye particles and momentum under the pointer.' },
    { icon: '*', title: 'Attribution', body: 'Visual reference: Haxiomic GPU Fluid Experiments, https://github.com/haxiomic/GPU-Fluid-Experiments.' },
  ],
};
