import { createEngineConfigurations, type SimAIContext, type SimulationAI, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { AdvancedConstraintParticlesRawScene } from '../advanced-physics/AdvancedConstraintParticlesRawScene.js';
import { buildModeDefinition } from '../shared/build-mode.js';
import { CHAIN_RAIN_DEFAULTS, CHAIN_RAIN_SETTINGS_FIELDS } from './chain-rain.config.js';

const chainRainStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'ice-thread',
  capabilities: { renderLayers: ['primitive', 'body'], passes: ['paletteMap', 'primitive', 'body', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'ice-thread', name: 'Ice Thread', description: 'Crisp cyan ropes over a cold night field.', palette: [0x72e8ff, 0xe6fbff, 0x78a8ff, 0xffffff], background: 0x050816, passes: ['paletteMap'], uniforms: {} },
    { id: 'ember-cord', name: 'Ember Cord', description: 'Molten orange chain bodies with hot ivory highlights.', palette: [0xff7a1a, 0xfff0b8, 0xff3b2f, 0xffc857], background: 0x160703, passes: ['paletteMap'], uniforms: {} },
    { id: 'violet-silk', name: 'Violet Silk', description: 'Purple rope strands with electric blue speculars.', palette: [0xb56cff, 0x76e4ff, 0xff6fce, 0xd8c6ff], background: 0x09031a, passes: ['paletteMap'], uniforms: {} },
    { id: 'acid-wire', name: 'Acid Wire', description: 'Toxic lime ropes with pale mint secondary color.', palette: [0xbaff29, 0xd8ffe8, 0x2fffa8, 0xf5ff7a], background: 0x061006, passes: ['paletteMap'], uniforms: {} },
    { id: 'copper-serpent', name: 'Copper Serpent', description: 'Burnished copper snakes with teal oxidation glints.', palette: [0xb45309, 0xf97316, 0xfef3c7, 0x14b8a6], background: 0x120704, passes: ['paletteMap'], uniforms: {} },
    { id: 'moss-rope', name: 'Moss Rope', description: 'Forest greens, fern highlights, and damp bark shadows.', palette: [0x166534, 0x22c55e, 0xbbf7d0, 0x854d0e], background: 0x061008, passes: ['paletteMap'], uniforms: {} },
    { id: 'bubblegum-snake', name: 'Bubblegum Snake', description: 'Playful pink, peach, mint, and sky candy snakes.', palette: [0xfb7185, 0xf9a8d4, 0xfde68a, 0x67e8f9], background: 0x19091a, passes: ['paletteMap'], uniforms: {} },
    { id: 'carbon-fiber', name: 'Carbon Fiber', description: 'Graphite bodies with silver and electric blue seams.', palette: [0x0f172a, 0x64748b, 0xe2e8f0, 0x38bdf8], background: 0x020617, passes: ['paletteMap'], uniforms: {} },
    { id: 'coral-chain', name: 'Coral Chain', description: 'Reef coral snakes with lagoon-blue highlights.', palette: [0xff6b6b, 0xfda4af, 0x2dd4bf, 0xfef3c7], background: 0x10070a, passes: ['paletteMap'], uniforms: {} },
    { id: 'royal-python', name: 'Royal Python', description: 'Deep indigo, gold, and pearl snake bodies.', palette: [0x312e81, 0x6366f1, 0xfacc15, 0xfffbeb], background: 0x070713, passes: ['paletteMap'], uniforms: {} },
  ],
};

export const chainRainDefinition: SimulationDefinition = {
  id: 'chain-rain',
  kind: 'simulation',
  name: 'Snakes',
  short: 'Draw soft snakes and let them pile up.',
  long: 'Draw soft snakes, build obstacles, and drag them around.',
  tags: ['simulation', 'physics', 'constraints', 'raw-webgl'],
  icon: '⌁',
  paletteHint: 'neon',
  capabilities: {
    tutorial: false,
    interactive: true,
    gestures: true,
    reset: true,
    debugOverlay: true,
    engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }),
    demo: true,
    settings: true,
  },
  settingsFields: CHAIN_RAIN_SETTINGS_FIELDS,
  configDefaults: CHAIN_RAIN_DEFAULTS,
  modes: [
    { id: 'draw', label: 'Draw', icon: '〰', description: 'Draw a line to make a snake.' },
    buildModeDefinition('Tap for pegs or drag to make a fixed line.'),
    { id: 'interact', label: 'Interact', icon: '✋', description: 'Drag snakes around.' },
  ],
  styleManifest: chainRainStyleManifest,
  directorEvents: [],
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'advanced-circle-particles',
    portability: 'reusable-core',
    supportedShapes: ['chain', 'circle'],
    reusableFor: ['snake simulations', 'rope simulations', 'distance constraints', 'dense collision plus constraints', 'solver stability benchmarks', 'shared liquid-surface particle rendering'],
    caveats: ['Snakes are particle constraints, not rigid links with angular motors.'],
  },
  factory: () => new AdvancedConstraintParticlesRawScene('chain-rain'),
  previewFactory: () => new AdvancedConstraintParticlesRawScene('chain-rain', true),
  demoAiFactory: (ctx) => new SnakesDemoAI(ctx.isPreview),
};

class SnakesDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextShuffleIn = 0;

  constructor(private readonly liteMode = false) {}

  onActivate(ctx: SimAIContext): void {
    this.randomize(ctx);
  }

  think(ctx: SimAIContext) {
    this.elapsed += ctx.dt;
    if (this.elapsed >= this.nextShuffleIn) this.randomize(ctx);
    return [];
  }

  reset(): void {
    this.elapsed = 0;
    this.nextShuffleIn = 0;
  }

  private randomize(ctx: SimAIContext): void {
    const styleId = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (styleId) ctx.applyStyle(styleId);
    ctx.applySetting('renderStyle', Math.random() < 0.16 ? 'ultra' : Math.random() < 0.72 ? 'enhanced' : 'basic');
    ctx.applyNumericSetting('nodeRadius', this.liteMode ? 3.6 + Math.random() * 2.2 : 3.5 + Math.random() * 5.5);
    ctx.applyNumericSetting('nodeVariance', this.liteMode ? Math.random() * 0.55 : Math.random() * 1.05);
    ctx.applyNumericSetting('nodeVarianceWavelength', this.liteMode ? 10 + Math.floor(Math.random() * 18) : 5 + Math.floor(Math.random() * 34));
    ctx.applyNumericSetting('nodeVarianceRoughness', this.liteMode ? Math.random() * 0.48 : Math.random() * 0.86);
    ctx.applyNumericSetting('chainLength', this.liteMode ? 8 + Math.floor(Math.random() * 20) : 8 + Math.floor(Math.random() * 35));
    ctx.applyNumericSetting('gravity', this.liteMode ? 940 + Math.random() * 440 : 700 + Math.random() * 1500);
    ctx.applyNumericSetting('friction', this.liteMode ? 0.34 + Math.random() * 0.44 : 0.18 + Math.random() * 0.72);
    ctx.applyNumericSetting('solverPasses', this.liteMode ? 2 : 2 + Math.floor(Math.random() * 4));
    ctx.applyNumericSetting('substeps', this.liteMode ? 1 : 1 + Math.floor(Math.random() * 3));
    ctx.applyNumericSetting('constraintPasses', this.liteMode ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 4));
    ctx.applyNumericSetting('constraintStiffness', 0.72 + Math.random() * 0.24);
    ctx.applyNumericSetting('collisionSoftness', 0.58 + Math.random() * 0.62);
    ctx.resetScene();
    this.elapsed = 0;
    this.nextShuffleIn = this.liteMode ? 13 + Math.random() * 8 : 11 + Math.random() * 13;
  }
}
