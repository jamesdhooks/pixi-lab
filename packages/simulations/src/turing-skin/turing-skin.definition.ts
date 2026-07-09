import { createEngineConfigurations, type SimStyleManifest, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { SystemsFieldDemoAI } from '../systems-field/SystemsFieldDemoAI.js';
import { GpuTuringSkinScene } from './GpuTuringSkinScene.js';
import { TURING_SKIN_DEFAULTS, TURING_SKIN_SETTINGS_FIELDS } from './turing-skin.config.js';

export const turingSkinStyleManifest: SimStyleManifest = {
  defaultStyleId: 'leopard-gold',
  capabilities: { renderLayers: ['field', 'glow'], passes: ['fieldVisualize', 'paletteMap', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'leopard-gold', name: 'Leopard Gold', description: 'Warm activator spots over ink-dark chemistry.', palette: [0xffc857, 0x1f1300, 0xff7a1a, 0xfff2c2], background: 0x080603, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'zebra-ghost', name: 'Zebra Ghost', description: 'Cold monochrome bands with spectral edges.', palette: [0xf8fbff, 0x2d3748, 0x8fd3ff, 0xffffff], background: 0x05070b, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'coral-morph', name: 'Coral Morph', description: 'Reef-pink morphogens blooming through teal inhibitor.', palette: [0xff5f8f, 0x35e6d2, 0xffcf6e, 0xffffff], background: 0x071414, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'ink-paper', name: 'Ink Paper', description: 'Black morphogen skin on a light laboratory plate.', palette: [0x111111, 0x6b7280, 0x000000, 0x475569], background: 0xf4efe2, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'poison-dart', name: 'Poison Dart', description: 'Blue, gold, and black amphibian warning colors.', palette: [0x0f172a, 0x0ea5e9, 0xfacc15, 0xf8fafc], background: 0x020617, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'manta-rose', name: 'Manta Rose', description: 'Soft rose morphogens over deep sea violet.', palette: [0x4c1d95, 0xfb7185, 0xfbcfe8, 0x38bdf8], background: 0x070419, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'lichen-map', name: 'Lichen Map', description: 'Olive, chartreuse, and bone tones for organic maps.', palette: [0x365314, 0x84cc16, 0xecfccb, 0xa8a29e], background: 0x070b04, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'thermal-hide', name: 'Thermal Hide', description: 'False-color heat skin with red-yellow boundaries.', palette: [0x1e1b4b, 0x7e22ce, 0xef4444, 0xfef08a], background: 0x040312, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'snow-leopard', name: 'Snow Leopard', description: 'Pale fur fields with smoky charcoal pigment.', palette: [0xf8fafc, 0xcbd5e1, 0x334155, 0x0f172a], background: 0x0b1020, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'reef-tiger', name: 'Reef Tiger', description: 'Aquatic tiger stripes in teal, orange, and pearl.', palette: [0x0f766e, 0x2dd4bf, 0xf97316, 0xfffbeb], background: 0x03110f, passes: ['fieldVisualize'], uniforms: {} },
  ],
};

export const turingSkinDefinition: SimulationDefinition = {
  id: 'turing-skin',
  kind: 'simulation',
  name: 'Turing Skin',
  short: 'Paint pigment that grows into spots and stripes.',
  long: 'Paint and erase pigment to grow spots, stripes, and scars.',
  tags: ['simulation', 'reaction-diffusion', 'chemistry', 'field'],
  icon: '◩',
  paletteHint: 'morphogen skin',
  capabilities: { tutorial: true, interactive: true, ambient: true, gestures: true, reset: true, directorMode: true, stagnationRecovery: true, debugOverlay: true, styleExport: true, proceduralTextures: true, renderTargetPool: true, engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }), demo: true, settings: true },
  settingsFields: TURING_SKIN_SETTINGS_FIELDS,
  configDefaults: TURING_SKIN_DEFAULTS,
  styleManifest: turingSkinStyleManifest,
  modes: [
    { id: 'paint', label: 'Paint', icon: '+', description: 'Add pigment to the surface.' },
    { id: 'erase', label: 'Erase', icon: '-', description: 'Cut holes in the pattern.' },
  ],
  gestureMap: { tap: 'apply Paint or Erase at the pointer', drag: 'paint or erase along your path', fast_swipe: 'make a larger quick stroke' },
  directorEvents: [{ id: 'spot-bloom', label: 'Spot Bloom', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.42 }],
  stagnationPolicy: { stagnant: false, reason: 'Recover when pigment variance or reaction energy collapses.', severity: 0 },
  advancedPhysics: { renderer: 'raw-webgl2', engine: 'gpu-ping-pong-field', portability: 'reusable-core', supportedShapes: ['field'], reusableFor: ['reaction diffusion', 'scalar fields', 'chemical pattern formation'], caveats: ['Simulation state lives in GPU framebuffer textures; WebGL2 float render-target support is required for the high-resolution path.'] },
  defaultSeed: 260527,
  factory: () => new GpuTuringSkinScene(),
  previewFactory: () => new GpuTuringSkinScene(true),
  demoAiFactory: (ctx) => new SystemsFieldDemoAI({ fields: TURING_SKIN_SETTINGS_FIELDS, liteMode: ctx.isPreview }),
  tutorialPages: [
    { icon: '+', title: 'Paint Pigment', body: 'Tap or drag in Paint mode to seed pigment. The reaction spreads it into spots or bands over time.' },
    { icon: '-', title: 'Carve Holes', body: 'Switch to Erase to cut holes, scars, and negative space into the pattern.' },
  ],
};
