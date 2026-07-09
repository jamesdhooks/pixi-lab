import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { BUILD_MODE_ICON, buildModeDefinition } from '../shared/build-mode.js';
import { RawSplashMpmScene } from './RawSplashMpmScene.js';
import { SplashMpmDemoAI } from './SplashMpmDemoAI.js';
import { SplashMpmPreviewScene } from './SplashMpmPreviewScene.js';
import { SPLASH_MPM_DEFAULTS, SPLASH_MPM_SETTINGS_FIELDS } from './splash-mpm.config.js';

export const splashMpmStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'clear-splash',
  capabilities: { renderLayers: ['particles', 'density'], passes: ['primitive', 'densityMetaball', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'clear-splash', name: 'Clear Splash', palette: [0x03141f, 0x008fd8, 0xcdf7ff, 0xffffff], background: 0x020812, passes: ['densityMetaball'], uniforms: { pointScale: 1 } },
    { id: 'moon-pool', name: 'Moon Pool', palette: [0x07111f, 0x5b7cfa, 0xdbeafe, 0x67e8f9], background: 0x010314, passes: ['densityMetaball', 'bloom'], uniforms: { pointScale: 1.08 } },
    { id: 'green-glass', name: 'Green Glass', palette: [0x03120a, 0x14b86a, 0xd9f99d, 0xf0fdfa], background: 0x020806, passes: ['densityMetaball'], uniforms: { pointScale: 0.94 } },
    { id: 'rose-fountain', name: 'Rose Fountain', palette: [0x18050b, 0xfb7185, 0xffe4e6, 0xffffff], background: 0x080206, passes: ['densityMetaball', 'bloom'], uniforms: { pointScale: 1.04 } },
    { id: 'ink-depth', name: 'Ink Depth', palette: [0xf8fafc, 0x334155, 0xdbeafe, 0x0ea5e9], background: 0xf8fafc, passes: ['densityMetaball'], uniforms: { pointScale: 0.9 } },
    { id: 'storm-surge', name: 'Storm Surge', palette: [0x020617, 0x475569, 0xe2e8f0, 0x38bdf8], background: 0x010309, passes: ['densityMetaball'], uniforms: { pointScale: 1.12 } },
    { id: 'amber-fizz', name: 'Amber Fizz', palette: [0x1c0f05, 0xf59e0b, 0xffedd5, 0xffffff], background: 0x070301, passes: ['densityMetaball', 'bloom'], uniforms: { pointScale: 1.02 } },
    { id: 'violet-current', name: 'Violet Current', palette: [0x130722, 0x8b5cf6, 0xf0abfc, 0xffffff], background: 0x05020c, passes: ['densityMetaball', 'bloom'], uniforms: { pointScale: 1.06 } },
    { id: 'arctic-glow', name: 'Arctic Glow', palette: [0xecfeff, 0x06b6d4, 0xa7f3d0, 0xffffff], background: 0xeefcff, passes: ['densityMetaball'], uniforms: { pointScale: 0.96 } },
    { id: 'toxic-lagoon', name: 'Toxic Lagoon', palette: [0x061307, 0x84cc16, 0x22d3ee, 0xfef08a], background: 0x020702, passes: ['densityMetaball', 'bloom'], uniforms: { pointScale: 1.1 } },
  ],
};

export const splashMpmDefinition: SimulationDefinition = {
  id: 'splash-mpm',
  kind: 'simulation',
  name: 'Splash MPM',
  short: 'Splash, pour, and shape a sheet of water.',
  long: 'Splash, pour, and build surfaces for a sheet of water.',
  tags: ['simulation', 'water', 'particles', 'mpm', 'raw-webgl'],
  attributions: [
    {
      label: 'Splash',
      href: 'https://github.com/matsuoka-601/Splash',
      author: 'matsuoka-601',
      license: 'MIT',
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
  settingsFields: SPLASH_MPM_SETTINGS_FIELDS,
  configDefaults: SPLASH_MPM_DEFAULTS,
  modes: [
    { id: 'splash', label: 'Splash', icon: '~', description: 'Drag to stir the water.' },
    { id: 'pour', label: 'Pour', icon: '+', description: 'Drag to pour more water.' },
    buildModeDefinition(),
  ],
  styleManifest: splashMpmStyleManifest,
  gestureMap: {
    tap: 'start a splash or pour at the pointer',
    drag: 'splash, pour, or draw a build surface',
  },
  directorEvents: [
    { id: 'surface-slap', label: 'Surface Slap', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.5 },
    { id: 'pour-reset', label: 'Pour Reset', minIntervalMs: 18000, maxIntervalMs: 32000, intensity: 0.72 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover by resetting the dam-break seed or applying a broad splash impulse.',
    severity: 0,
  },
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: '2d-pic-flip-particle-water',
    portability: 'reusable-core',
    supportedShapes: ['circle', 'field'],
    reusableFor: ['2D MPM water scenes', 'particle-grid liquid toys', 'screen-space fluid surface renderers'],
    caveats: ['Inspired by matsuoka-601/Splash, https://github.com/matsuoka-601/Splash. Basic renders particles only, enhanced renders the shared compact liquid surface, and ultra enables the foam-density treatment. This is an original 2D raw WebGL2 adaptation of the MLS-MPM and screen-space fluid rendering ideas, not copied WebGPU/WGSL source.'],
  },
  defaultSeed: 6012026,
  factory: () => new RawSplashMpmScene(),
  previewFactory: () => new SplashMpmPreviewScene(),
  demoAiFactory: (ctx) => new SplashMpmDemoAI({ liteMode: ctx.isPreview }),
  tutorialPages: [
    { icon: '+', title: 'Pour', body: 'Use Pour to inject fresh particles while the pointer is held.' },
    { icon: '~', title: 'Splash', body: 'Drag through the water sheet to transfer momentum into the particle-grid solver.' },
    { icon: BUILD_MODE_ICON, title: 'Build', body: 'Use Build to tap in a fixed point or drag out a fixed collision surface.' },
    { icon: '~', title: 'Inspired by / adapted from', body: 'Inspired by Splash by matsuoka-601, then adapted into a Pixi Lab 2D raw WebGL scene with custom controls, palettes, surface rendering, and demo behavior.' },
  ],
};
