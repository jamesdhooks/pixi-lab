import { createEngineConfigurations, type SimAIContext, type SimStyleManifest, type SimulationAI, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { GpuMyceliumScene } from './GpuMyceliumScene.js';
import { MYCELIUM_DEFAULTS, MYCELIUM_SETTINGS_FIELDS } from './mycelium.config.js';

export const myceliumStyleManifest: SimStyleManifest = {
  defaultStyleId: 'synaptic-fungus',
  capabilities: { renderLayers: ['field', 'glow'], passes: ['fieldVisualize', 'paletteMap', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'synaptic-fungus', name: 'Synaptic Fungus', description: 'Electric neural mycelium over deep violet substrate.', palette: [0x7c3aed, 0xa78bfa, 0x22d3ee, 0x06b6d4, 0xf0abfc, 0xec4899, 0xffffff, 0xc4b5fd], background: 0x08051a, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'rot-bloom', name: 'Rot Bloom', description: 'Warm compost, amber spores, and green hyphae.', palette: [0x365314, 0x84cc16, 0xd9f99d, 0xfef3c7, 0xf59e0b, 0xb45309, 0x78350f, 0xa3e635], background: 0x100b05, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'arctic-lichen', name: 'Arctic Lichen', description: 'Pale ice threads and cold mineral glow.', palette: [0xe0f2fe, 0x67e8f9, 0x0e7490, 0x93c5fd, 0x1d4ed8, 0xffffff, 0xbae6fd, 0x38bdf8], background: 0x07111d, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'black-paper', name: 'Black Paper', description: 'Inky high-resolution lattice on paper-white substrate.', palette: [0x000000, 0x111111, 0x334155, 0x64748b, 0x1e293b, 0x475569, 0x0f172a, 0x94a3b8], background: 0xf6f1e7, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'coral-mycorrhiza', name: 'Coral Mycorrhiza', description: 'Warm reef oranges, pinks, and mineral teal growth.', palette: [0xff6b6b, 0xfb7185, 0xfda4af, 0xffedd5, 0x2dd4bf, 0x14b8a6, 0xf97316, 0xfacc15], background: 0x12070a, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'toxic-orchid', name: 'Toxic Orchid', description: 'Venom greens split through violet orchid filaments.', palette: [0x4c1d95, 0x7e22ce, 0xc084fc, 0xf0abfc, 0xbef264, 0x84cc16, 0x22c55e, 0xecfccb], background: 0x090617, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'ember-ash', name: 'Ember Ash', description: 'Charcoal substrate with ember red and molten gold veins.', palette: [0x0f0f0f, 0x292524, 0x7f1d1d, 0xdc2626, 0xf97316, 0xfacc15, 0xffedd5, 0x78350f], background: 0x050303, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'deep-sea-bloom', name: 'Deep Sea Bloom', description: 'Bioluminescent cyan, kelp green, and abyssal blues.', palette: [0x020617, 0x0f172a, 0x1e3a8a, 0x2563eb, 0x06b6d4, 0x5eead4, 0x84cc16, 0xd9f99d], background: 0x02040c, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'bone-spore', name: 'Bone Spore', description: 'Dry bone, umber shadows, and ghostly lichen whites.', palette: [0x1c1917, 0x44403c, 0x78716c, 0xd6d3d1, 0xf5f5f4, 0xa8a29e, 0x57534e, 0xfefce8], background: 0x0c0a09, passes: ['fieldVisualize'], uniforms: {} },
    { id: 'infrared-moss', name: 'Infrared Moss', description: 'False-color magenta foliage over electric moss greens.', palette: [0x14532d, 0x22c55e, 0x86efac, 0xf0fdf4, 0xbe185d, 0xec4899, 0xf9a8d4, 0x7f1d1d], background: 0x06100a, passes: ['fieldVisualize'], uniforms: {} },
  ],
};

export const myceliumDefinition: SimulationDefinition = {
  id: 'mycelium',
  kind: 'simulation',
  name: 'Mycelium',
  short: 'Fungal colonies spread through triangular or square lattice structures.',
  long: 'A raw WebGL lattice-growth simulation for mycelial transport. Choose triangle or square topology, pick a rendering style, then paint living cells onto the lattice and watch them propagate.',
  tags: ['simulation', 'growth', 'lattice', 'mycelium'],
  icon: 'MY',
  paletteHint: 'synaptic fungus',
  capabilities: { tutorial: true, interactive: true, ambient: true, gestures: true, reset: true, directorMode: true, stagnationRecovery: true, debugOverlay: true, styleExport: true, proceduralTextures: true, renderTargetPool: true, engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }), demo: true, settings: true },
  settingsFields: MYCELIUM_SETTINGS_FIELDS,
  configDefaults: MYCELIUM_DEFAULTS,
  styleManifest: myceliumStyleManifest,
  modes: [
    { id: 'paint', label: 'Paint', icon: 'BR', description: 'Paint living cells onto the lattice while holding the input.' },
  ],
  gestureMap: { tap: 'paint cells onto the lattice', drag: 'paint cells along the pointer path', hold: 'continue painting at the held point', fast_swipe: 'paint a quick streak of cells' },
  directorEvents: [{ id: 'spore-bloom', label: 'Spore Bloom', minIntervalMs: 6000, maxIntervalMs: 12000, intensity: 0.45 }],
  stagnationPolicy: { stagnant: false, reason: 'Recover when active tips and glow variance collapse.', severity: 0 },
  advancedPhysics: { renderer: 'raw-webgl2', engine: 'gpu-cellular-field', portability: 'reusable-core', supportedShapes: ['field'], reusableFor: ['lattice growth', 'fungal networks', 'cellular automata'], caveats: ['Square and triangle styles use distinct GPU neighbor kernels and surface-area constants.'] },
  defaultSeed: 260618,
  factory: () => new GpuMyceliumScene(),
  previewFactory: () => new GpuMyceliumScene(true),
  demoAiFactory: (ctx) => new MyceliumDemoAI(ctx.isPreview),
  tutorialPages: [
    { icon: 'BR', title: 'Paint Threads', body: 'Paint adds local hyphae and lets active tips branch through the selected lattice style.' },
    { icon: '*', title: 'Switch Structure', body: 'Use Topology to pick triangular or square growth geometry. Style changes only the WebGL rendering treatment.' },
  ],
};

class MyceliumDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextResetIn = 0;

  constructor(private readonly liteMode = false) {}

  onActivate(ctx: SimAIContext): void {
    this.randomizeAndSeed(ctx);
  }

  think(ctx: SimAIContext) {
    this.elapsed += ctx.dt;
    if (this.elapsed >= this.nextResetIn) {
      this.randomizeAndSeed(ctx);
    }
    return [];
  }

  reset(): void {
    this.elapsed = 0;
    this.nextResetIn = 0;
  }

  private randomizeAndSeed(ctx: SimAIContext): void {
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    const visualRoll = Math.random();
    ctx.applySetting('renderStyle', visualRoll < 0.2 ? 'basic' : visualRoll < 0.64 ? 'enhanced' : 'bloom');
    ctx.applySetting('topology', Math.random() < 0.52 ? 'triangle' : 'square');

    const fullResolutionBuckets = [96, 128, 160, 192, 256, 320, 384, 512, 640, 768, 896, 1024, 1280, 1536];
    const previewResolutionBuckets = [48, 64, 80, 96, 112, 128, 160, 192, 224, 256];
    const resolutionBuckets = this.liteMode ? previewResolutionBuckets : fullResolutionBuckets;
    ctx.applyNumericSetting('resolution', resolutionBuckets[Math.floor(Math.random() * resolutionBuckets.length)]);
    ctx.applyNumericSetting('timeScale', this.liteMode ? 0.55 + Math.random() * 0.75 : 0.35 + Math.random() * 1.5);

    const growthMood = Math.random();
    if (growthMood < 0.28) {
      ctx.applyNumericSetting('growthRate', this.liteMode ? 0.45 + Math.random() * 0.65 : 0.35 + Math.random() * 0.85);
      ctx.applyNumericSetting('branchChance', 0.015 + Math.random() * 0.07);
      ctx.applyNumericSetting('growthClumping', 0.78 + Math.random() * 0.22);
      ctx.applyNumericSetting('overwriteChance', Math.random() < 0.86 ? 0 : Math.random() * 0.025);
    } else if (growthMood < 0.62) {
      ctx.applyNumericSetting('growthRate', this.liteMode ? 0.9 + Math.random() * 1.2 : 0.85 + Math.random() * 2.1);
      ctx.applyNumericSetting('branchChance', 0.12 + Math.random() * 0.34);
      ctx.applyNumericSetting('growthClumping', 0.34 + Math.random() * 0.5);
      ctx.applyNumericSetting('overwriteChance', Math.random() < 0.65 ? 0 : 0.015 + Math.random() * 0.09);
    } else {
      ctx.applyNumericSetting('growthRate', this.liteMode ? 1.45 + Math.random() * 1.25 : 1.4 + Math.random() * 3.2);
      ctx.applyNumericSetting('branchChance', 0.32 + Math.random() * 0.58);
      ctx.applyNumericSetting('growthClumping', Math.random());
      ctx.applyNumericSetting('overwriteChance', Math.random() < 0.42 ? 0 : 0.04 + Math.random() * 0.22);
    }

    const colorMood = Math.random();
    ctx.applyNumericSetting('colorMutation', colorMood < 0.35 ? 0.015 + Math.random() * 0.08 : colorMood < 0.72 ? 0.1 + Math.random() * 0.24 : 0.3 + Math.random() * 0.55);
    ctx.applyNumericSetting('colorDriftFrequency', colorMood < 0.35 ? 0.004 + Math.random() * 0.025 : colorMood < 0.72 ? 0.025 + Math.random() * 0.08 : 0.1 + Math.random() * 0.28);
    ctx.applyNumericSetting('branchColorSplit', colorMood < 0.35 ? 0.02 + Math.random() * 0.14 : colorMood < 0.72 ? 0.15 + Math.random() * 0.34 : 0.42 + Math.random() * 0.48);
    ctx.applyNumericSetting('substrateColorBias', Math.random() < 0.45 ? Math.random() * 0.08 : 0.08 + Math.random() * 0.52);
    ctx.applyNumericSetting('fieldSpread', this.liteMode ? 1.2 + Math.random() * 2.4 : 0.6 + Math.random() * 4.7);
    ctx.applyNumericSetting('pruneRate', Math.random() < 0.35 ? 0.02 + Math.random() * 0.12 : 0.12 + Math.random() * 0.9);
    ctx.applyNumericSetting('brushRadius', this.liteMode ? 0.006 + Math.random() * 0.012 : 0.005 + Math.random() * 0.024);
    ctx.applyNumericSetting('demoSeedColonies', this.liteMode ? 2 + Math.floor(Math.random() * 5) : 3 + Math.floor(Math.random() * 12));
    ctx.applyNumericSetting('demoSeedRadius', this.liteMode ? 0.012 + Math.random() * 0.026 : 0.008 + Math.random() * 0.035);
    ctx.resetScene();
    ctx.applyNumericSetting('demoSeedColonies', 0);
    ctx.applyNumericSetting('demoSeedRadius', 0.012);
    this.elapsed = 0;
    this.nextResetIn = this.liteMode ? 8 + Math.random() * 8 : 12 + Math.random() * 18;
  }
}
