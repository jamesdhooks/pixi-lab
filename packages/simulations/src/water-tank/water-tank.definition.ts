import { createEngineConfigurations, type GestureEvent, type SimAIContext, type SimulationAI, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { RawParticleMetaballScene } from '../shared/RawParticleMetaballScene.js';
import { WATER_TANK_DEFAULTS, WATER_TANK_SETTINGS_FIELDS } from './water-tank.config.js';

export const waterTankStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'clear-lagoon',
  capabilities: { renderLayers: ['particles', 'density'], passes: ['primitive', 'densityMetaball'], qualities: ['raw'] },
  styles: [
    { id: 'clear-lagoon', name: 'Clear Lagoon', palette: [0xb8f7ff, 0x4dd8ff, 0x0b4f8a, 0xffffff], background: 0x03141f, passes: ['densityMetaball'], uniforms: {} },
    { id: 'deep-pool', name: 'Deep Pool', palette: [0x7dd3fc, 0x0284c7, 0x082f49, 0xe0f2fe], background: 0x020617, passes: ['densityMetaball'], uniforms: {} },
    { id: 'glacier-milk', name: 'Glacier Milk', palette: [0xf0fdff, 0xa5f3fc, 0x60a5fa, 0xffffff], background: 0x07111f, passes: ['densityMetaball'], uniforms: {} },
    { id: 'toxic-rinse', name: 'Toxic Rinse', palette: [0xecfccb, 0x22c55e, 0x14532d, 0xa7f3d0], background: 0x04120a, passes: ['densityMetaball'], uniforms: {} },
    { id: 'violet-tide', name: 'Violet Tide', palette: [0xe9d5ff, 0xa855f7, 0x312e81, 0x67e8f9], background: 0x08051a, passes: ['densityMetaball'], uniforms: {} },
    { id: 'ink-wash', name: 'Ink Wash', palette: [0xe2e8f0, 0x475569, 0x020617, 0x93c5fd], background: 0xf8fafc, passes: ['densityMetaball'], uniforms: {} },
    { id: 'sunlit-creek', name: 'Sunlit Creek', palette: [0xfef9c3, 0x38bdf8, 0x0f766e, 0xfef3c7], background: 0x08130e, passes: ['densityMetaball'], uniforms: {} },
    { id: 'rose-water', name: 'Rose Water', palette: [0xffe4e6, 0xfb7185, 0x9f1239, 0xf0f9ff], background: 0x14070b, passes: ['densityMetaball'], uniforms: {} },
    { id: 'storm-drain', name: 'Storm Drain', palette: [0xcbd5e1, 0x64748b, 0x111827, 0x38bdf8], background: 0x030712, passes: ['densityMetaball'], uniforms: {} },
    { id: 'biolume-bay', name: 'Biolume Bay', palette: [0xd9f99d, 0x22d3ee, 0x064e3b, 0xf0fdfa], background: 0x02110f, passes: ['densityMetaball'], uniforms: {} },
  ],
};

export const waterTankDefinition: SimulationDefinition = {
  id: 'water-tank',
  kind: 'simulation',
  name: 'Water Tank',
  short: 'Particle water sloshes around buildable obstacles.',
  long: 'A raw WebGL particle water tank inspired by the ball-pit solver, with GPU-rendered particle/metaball water, obstacle building, pouring, interaction, and demo automation.',
  tags: ['simulation', 'water', 'particles', 'raw-webgl'],
  icon: '≈',
  paletteHint: 'cyan',
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
  settingsFields: WATER_TANK_SETTINGS_FIELDS,
  configDefaults: WATER_TANK_DEFAULTS,
  modes: [
    { id: 'pour', label: 'Pour', icon: '+', description: 'Click or drag to pour water particles.' },
    { id: 'build', label: 'Build', icon: '◆', description: 'Click for fixed pegs or drag a straight fixed obstacle line.' },
    { id: 'interact', label: 'Interact', icon: '✋', description: 'Push water with a velocity field.' },
  ],
  styleManifest: waterTankStyleManifest,
  directorEvents: [],
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'particle-water-metaball',
    portability: 'reusable-core',
    supportedShapes: ['circle'],
    reusableFor: ['particle fluid tanks', 'buildable obstacle particle flows', 'water-like metaball rendering'],
    caveats: ['This is a lightweight particle-water model, not a pressure-accurate SPH solver yet.'],
  },
  factory: () => new RawParticleMetaballScene('water-tank'),
  previewFactory: () => new RawParticleMetaballScene('water-tank', true),
  demoAiFactory: (ctx) => new WaterTankDemoAI(ctx.isPreview),
};

class WaterTankDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextShuffleIn = 0;
  private t = 0;

  constructor(private readonly liteMode = false) {}

  onActivate(ctx: SimAIContext): void {
    this.randomize(ctx);
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsed += ctx.dt;
    this.t += ctx.dt;
    if (this.elapsed >= this.nextShuffleIn) this.randomize(ctx);
    const x = ctx.width * (0.5 + Math.sin(this.t * 1.1) * 0.28);
    const y = ctx.height * (0.18 + Math.cos(this.t * 0.8) * 0.08);
    return [{ kind: 'drag', id: -8201, x, y, dx: Math.cos(this.t * 2.4) * 12, dy: 8, timestamp: performance.now() }];
  }

  reset(): void {
    this.elapsed = 0;
    this.nextShuffleIn = 0;
    this.t = 0;
  }

  private randomize(ctx: SimAIContext): void {
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    ctx.applySetting('renderStyle', Math.random() > 0.72 ? 'particles' : Math.random() > 0.38 ? 'glass' : 'surface');
    ctx.applyNumericSetting('maxParticles', this.liteMode ? 900 + Math.floor(Math.random() * 700) : 4200 + Math.floor(Math.random() * 5200));
    ctx.applyNumericSetting('particleRadius', this.liteMode ? 5.2 + Math.random() * 1.6 : 3.6 + Math.random() * 2.8);
    ctx.applyNumericSetting('gravity', 1000 + Math.random() * 850);
    ctx.applyNumericSetting('viscosity', 0.08 + Math.random() * 0.28);
    ctx.applyNumericSetting('pourRate', this.liteMode ? 120 + Math.random() * 240 : 260 + Math.random() * 720);
    ctx.applyNumericSetting('pourRadius', 14 + Math.random() * 28);
    ctx.applyNumericSetting('buildRadius', this.liteMode ? 14 + Math.random() * 10 : 12 + Math.random() * 18);
    ctx.applyNumericSetting('interactionStrength', 12 + Math.random() * 18);
    ctx.applyNumericSetting('metaballBlend', 0.55 + Math.random() * 0.4);
    ctx.resetScene();
    this.elapsed = 0;
    this.nextShuffleIn = this.liteMode ? 8 + Math.random() * 7 : 13 + Math.random() * 13;
  }
}
