import { createEngineConfigurations, type SimStyleManifest, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { SystemsFieldDemoAI } from '../systems-field/SystemsFieldDemoAI.js';
import { ALIEN_VASCULAR_TREE_DEFAULTS, ALIEN_VASCULAR_TREE_SETTINGS_FIELDS } from './alien-vascular-tree.config.js';
import { GpuVascularTreeScene } from './GpuVascularTreeScene.js';

export const alienVascularTreeStyleManifest: SimStyleManifest = {
  defaultStyleId: 'coral-veins',
  capabilities: { renderLayers: ['field', 'glow'], passes: ['fieldVisualize', 'paletteMap', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'coral-veins', name: 'Coral Veins', description: 'Pink vascular tissue with cyan nutrient pulses.', palette: [0xff5f8f, 0x22d3ee, 0xffcf6e, 0xffffff], background: 0x09040a, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'neon-roots', name: 'Neon Roots', description: 'Electric green roots over blue-black tissue.', palette: [0x84cc16, 0x38bdf8, 0xf0fdf4, 0xb7ff3c], background: 0x020617, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'gold-arbor', name: 'Gold Arbor', description: 'Golden canopy and amber nutrient glow.', palette: [0xfacc15, 0xff7a1a, 0xfffbeb, 0xfef08a], background: 0x120907, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'arterial-red', name: 'Arterial Red', description: 'Deep crimson vessels with oxygen-bright highlights.', palette: [0x7f1d1d, 0xdc2626, 0xffb4a2, 0xfffbeb], background: 0x080202, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'xeno-lymph', name: 'Xeno Lymph', description: 'Acid lymph greens against violet alien tissue.', palette: [0x4c1d95, 0x84cc16, 0xd9f99d, 0xc084fc], background: 0x07040f, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'ice-capillary', name: 'Ice Capillary', description: 'Frozen blue capillaries with white nutrient sparks.', palette: [0x1e3a8a, 0x60a5fa, 0xcffafe, 0xffffff], background: 0x030816, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'fungal-artery', name: 'Fungal Artery', description: 'Ochre, moss, and cream vessels through dark substrate.', palette: [0x713f12, 0xca8a04, 0x84cc16, 0xfef3c7], background: 0x0d0903, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'synthetic-plasma', name: 'Synthetic Plasma', description: 'Laboratory magenta and cyan transport channels.', palette: [0xdb2777, 0x22d3ee, 0xa78bfa, 0xffffff], background: 0x080617, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'blacklight-vines', name: 'Blacklight Vines', description: 'UV purple vessels with hot green nutrient glow.', palette: [0x2e1065, 0x9333ea, 0x22c55e, 0xecfccb], background: 0x05020a, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'bone-marrow', name: 'Bone Marrow', description: 'Warm marrow reds and bone-white transport branches.', palette: [0x991b1b, 0xf97316, 0xf5f5dc, 0x78716c], background: 0x0d0504, passes: ['fieldVisualize'], uniforms: {} },
  ],
};

export const alienVascularTreeDefinition: SimulationDefinition = {
  id: 'alien-vascular-tree',
  kind: 'simulation',
  name: 'Alien Vascular Tree',
  short: 'Adaptive vessels grow toward light while nutrient flow thickens successful branches.',
  long: 'A raw WebGL graph-growth simulation for branching transport networks. Guide the growth light, feed local tissue, and prune weak tips.',
  tags: ['simulation', 'growth', 'branching', 'transport'],
  icon: 'VT',
  paletteHint: 'glowing xeno veins',
  capabilities: { tutorial: true, interactive: true, ambient: true, gestures: true, reset: true, directorMode: true, stagnationRecovery: true, debugOverlay: true, styleExport: true, proceduralTextures: true, renderTargetPool: true, engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }), demo: true, settings: true },
  settingsFields: ALIEN_VASCULAR_TREE_SETTINGS_FIELDS,
  configDefaults: ALIEN_VASCULAR_TREE_DEFAULTS,
  styleManifest: alienVascularTreeStyleManifest,
  modes: [
    { id: 'guide', label: 'Guide', icon: '*', description: 'Move the light source that biases future branching.' },
    { id: 'feed', label: 'Feed', icon: '+', description: 'Reactivate and thicken nearby vessels.' },
    { id: 'prune', label: 'Prune', icon: '-', description: 'Starve nearby branch tips.' },
  ],
  gestureMap: { tap: 'apply the selected vascular tool', drag: 'paint with the selected vascular tool', hold: 'sustain the selected vascular tool', fast_swipe: 'apply a stronger selected vascular tool' },
  directorEvents: [{ id: 'growth-spurt', label: 'Growth Spurt', minIntervalMs: 7000, maxIntervalMs: 14000, intensity: 0.45 }],
  stagnationPolicy: { stagnant: false, reason: 'Recover when active tips, nutrient variance, or growth energy collapse.', severity: 0 },
  advancedPhysics: { renderer: 'raw-webgl2', engine: 'gpu-instanced-vascular-graph', portability: 'reusable-core', supportedShapes: ['instanced-capsule-segments'], reusableFor: ['branching networks', 'vascular growth', 'transport graphs'], caveats: ['Sparse graph topology remains CPU-side by design; dense vessel rendering and glow are GPU-instanced with no per-frame field texture upload.'] },
  defaultSeed: 260617,
  factory: () => new GpuVascularTreeScene(),
  previewFactory: () => new GpuVascularTreeScene(true),
  demoAiFactory: (ctx) => new SystemsFieldDemoAI({ fields: ALIEN_VASCULAR_TREE_SETTINGS_FIELDS, liteMode: ctx.isPreview }),
  tutorialPages: [
    { icon: '*', title: 'Guide Growth', body: 'Move the guide light to bias where new vessels grow.' },
    { icon: '+', title: 'Feed Tissue', body: 'Feed local vessels to reactivate tips and thicken successful branches.' },
  ],
};
