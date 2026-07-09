import { createEngineConfigurations, type GestureEvent, type SimAIContext, type SimulationAI, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { RawParticleMetaballScene } from '../shared/RawParticleMetaballScene.js';
import { LAVA_LAMP_DEFAULTS, LAVA_LAMP_SETTINGS_FIELDS } from './lava-lamp.config.js';

export const lavaLampStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'classic-wax',
  capabilities: { renderLayers: ['particles', 'density'], passes: ['primitive', 'densityMetaball', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'classic-wax', name: 'Classic Wax', palette: [0xfff1a6, 0xff5a1f, 0x481006, 0xffb703], background: 0x120403, passes: ['densityMetaball'], uniforms: {} },
    { id: 'violet-magma', name: 'Violet Magma', palette: [0xff8cff, 0x7c3aed, 0x1e103d, 0xf0abfc], background: 0x090316, passes: ['densityMetaball'], uniforms: {} },
    { id: 'toxic-honey', name: 'Toxic Honey', palette: [0xfaff7a, 0x84cc16, 0x10220a, 0xfffbeb], background: 0x061006, passes: ['densityMetaball'], uniforms: {} },
    { id: 'solar-core', name: 'Solar Core', palette: [0xffffff, 0xffb000, 0x661000, 0xff3d00], background: 0x140300, passes: ['densityMetaball'], uniforms: {} },
    { id: 'blue-paraffin', name: 'Blue Paraffin', palette: [0xdff9ff, 0x38bdf8, 0x0b2a4a, 0x818cf8], background: 0x020817, passes: ['densityMetaball'], uniforms: {} },
    { id: 'rose-quartz', name: 'Rose Quartz', palette: [0xffd1dc, 0xfb7185, 0x4a1020, 0xf9a8d4], background: 0x14060b, passes: ['densityMetaball'], uniforms: {} },
    { id: 'mint-plasma', name: 'Mint Plasma', palette: [0xeafff4, 0x34d399, 0x083c32, 0x5eead4], background: 0x02110e, passes: ['densityMetaball'], uniforms: {} },
    { id: 'ember-smoke', name: 'Ember Smoke', palette: [0xffedd5, 0xea580c, 0x1c1917, 0x78716c], background: 0x080605, passes: ['densityMetaball'], uniforms: {} },
    { id: 'neon-grape', name: 'Neon Grape', palette: [0x22d3ee, 0xd946ef, 0x2e1065, 0xf0f9ff], background: 0x070015, passes: ['densityMetaball'], uniforms: {} },
    { id: 'copper-oil', name: 'Copper Oil', palette: [0xfef3c7, 0xb45309, 0x201008, 0x14b8a6], background: 0x0b0502, passes: ['densityMetaball'], uniforms: {} },
  ],
};

export const lavaLampDefinition: SimulationDefinition = {
  id: 'lava-lamp',
  kind: 'simulation',
  name: 'Lava Lamp',
  short: 'Warm wax blobs rise and drift like a lava lamp.',
  long: 'Add or remove wax blobs and watch them rise, drift, and fall.',
  tags: ['simulation', 'metaball', 'thermal', 'raw-webgl'],
  attributions: [
    {
      label: 'WebGL Lava Lamp',
      href: 'https://github.com/brybrant/lava-lamp',
      author: 'Matt Bryant',
      license: 'GPL-3.0',
    },
  ],
  icon: '◖',
  paletteHint: 'plasma',
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
  settingsFields: LAVA_LAMP_SETTINGS_FIELDS,
  configDefaults: LAVA_LAMP_DEFAULTS,
  modes: [
    { id: 'add', label: 'Add', icon: '+', description: 'Add wax and lift nearby blobs.' },
    { id: 'remove', label: 'Remove', icon: '-', description: 'Remove wax from the brush.' },
  ],
  styleManifest: lavaLampStyleManifest,
  directorEvents: [],
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'shared-liquid-surface-lava',
    portability: 'reusable-core',
    supportedShapes: ['circle', 'soft-body'],
    reusableFor: ['shared liquid-surface lava lamps', 'screen-space metaball liquid renderers', 'thermal buoyancy toys'],
    caveats: ['The visible lava surface is a shared screen-space liquid renderer fed by live CPU particle/metaball state, so the shader is a render layer rather than the simulation source of truth.'],
  },
  factory: () => new RawParticleMetaballScene('lava-lamp'),
  previewFactory: () => new RawParticleMetaballScene('lava-lamp', true),
  demoAiFactory: (ctx) => new LavaLampDemoAI(ctx.isPreview),
};

const PRIMARY_THERMAL_BRUSH_ID = -8101;
const SECONDARY_THERMAL_BRUSH_ID = -8102;
const PRIMARY_THERMAL_STRENGTH = 1;
const SECONDARY_THERMAL_STRENGTH = 0.45;
const LAVA_DEMO_BASELINE = {
  timeScale: 0.75,
  maxParticles: 1024,
  initialBlobs: 128,
  blobRadius: 28,
  gravity: 290,
  buoyancy: 800,
  thermalDrive: 5,
  heatRegion: 0.17,
  coolRegion: 0.25,
  heatRate: 1.01,
  coolRate: 0.28,
  heatTransfer: 0,
  turbulence: 2.18,
  verticalTurbulence: 1.17,
  waxViscosity: 5,
  thermalContrast: 0.35,
  enhancedQuality: 2,
  liquidFieldScale: 1,
  liquidParticleRadius: 2.2,
  liquidExpansion: 2.08,
  liquidSplatDensity: 0.97,
  liquidSurfaceThreshold: 0.26,
  liquidEdgeTightness: 0.15,
  liquidEdgeSoftness: 0.48,
  liquidRefraction: 0.34,
  liquidGloss: 0,
  liquidThermalStrength: 0.69,
  liquidRimLighting: 1.32,
  liquidBloomStrength: 0.34,
  liquidHeatShimmer: 0.63,
  liquidDepthDiffusion: 0.49,
  surfaceTension: 0.71,
  clumping: 1.06,
  inputRadius: 92,
  inputLift: 363.6,
  inputThermalRate: 0.06,
  metaballBlend: 0.55,
  opacity: 1,
  substeps: 3,
} as const;

const LAVA_PREVIEW_BASELINE = {
  ...LAVA_DEMO_BASELINE,
  timeScale: 0.5,
  maxParticles: 384,
  initialBlobs: 112,
  blobRadius: 16,
  enhancedQuality: 1.15,
  liquidFieldScale: 0.72,
  liquidParticleRadius: 1.72,
  liquidExpansion: 1.7,
  inputRadius: 62,
} as const;

class LavaLampDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextShuffleIn = 0;
  private angle = 0;
  private removing = false;

  constructor(private readonly liteMode = false) {}

  onActivate(ctx: SimAIContext): void {
    this.randomize(ctx);
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsed += ctx.dt;
    this.angle += ctx.dt * 0.9;
    if (this.elapsed >= this.nextShuffleIn) this.randomize(ctx);
    const primaryX = ctx.width * (0.5 + Math.sin(this.angle * 0.7) * 0.26);
    const secondaryX = ctx.width * (0.5 - Math.sin(this.angle * 0.53) * 0.22);
    const primaryY = ctx.height * (this.removing ? 0.28 + Math.cos(this.angle * 1.1) * 0.1 : 0.72 + Math.cos(this.angle * 1.1) * 0.12);
    const secondaryY = ctx.height * (this.removing ? 0.74 + Math.sin(this.angle * 0.8) * 0.08 : 0.24 + Math.sin(this.angle * 0.8) * 0.08);
    const gestures: GestureEvent[] = [{
      kind: 'drag',
      id: PRIMARY_THERMAL_BRUSH_ID,
      x: primaryX,
      y: primaryY,
      dx: Math.cos(this.angle) * 8,
      dy: this.removing ? Math.abs(Math.sin(this.angle)) * 8 : -Math.abs(Math.sin(this.angle)) * 8,
      strength: this.removing ? -PRIMARY_THERMAL_STRENGTH : PRIMARY_THERMAL_STRENGTH,
      timestamp: performance.now(),
    }, {
      kind: 'drag',
      id: SECONDARY_THERMAL_BRUSH_ID,
      x: secondaryX,
      y: secondaryY,
      dx: -Math.cos(this.angle * 0.8) * 5,
      dy: this.removing ? -Math.abs(Math.sin(this.angle * 0.9)) * 5 : Math.abs(Math.sin(this.angle * 0.9)) * 5,
      strength: this.removing ? SECONDARY_THERMAL_STRENGTH : -SECONDARY_THERMAL_STRENGTH,
      timestamp: performance.now(),
    }];
    return gestures;
  }

  reset(): void {
    this.elapsed = 0;
    this.nextShuffleIn = 0;
    this.angle = 0;
    this.removing = false;
  }

  private randomize(ctx: SimAIContext): void {
    const style = this.pickStyle(ctx);
    if (style) ctx.applyStyle(style);
    this.removing = this.liteMode ? false : Math.random() > 0.82;
    ctx.applySetting('renderStyle', 'ultra');
    const base = this.liteMode ? LAVA_PREVIEW_BASELINE : LAVA_DEMO_BASELINE;
    const spread = this.liteMode ? 0.08 : 0.18;
    if (this.liteMode) ctx.applyNumericSetting('timeScale', 0.5);
    else this.applyNear(ctx, 'timeScale', base.timeScale, 0.08, 0.35, 1.25);
    this.applyNear(ctx, 'maxParticles', base.maxParticles, 0.08, 96, 1400, true);
    this.applyNear(ctx, 'initialBlobs', base.initialBlobs, this.liteMode ? 0.14 : 0.22, 24, 220, true);
    this.applyNear(ctx, 'blobRadius', base.blobRadius, this.liteMode ? 0.16 : 0.24, 10, 42);
    this.applyNear(ctx, 'gravity', base.gravity, spread, 140, 520);
    this.applyNear(ctx, 'buoyancy', base.buoyancy, spread, 480, 1100);
    this.applyNear(ctx, 'thermalDrive', base.thermalDrive, 0.12, 2.8, 5);
    this.applyNear(ctx, 'heatRegion', base.heatRegion, 0.18, 0.08, 0.32);
    this.applyNear(ctx, 'coolRegion', base.coolRegion, 0.18, 0.12, 0.42);
    this.applyNear(ctx, 'heatRate', base.heatRate, 0.22, 0.35, 1.55);
    this.applyNear(ctx, 'coolRate', base.coolRate, 0.28, 0, 0.55);
    this.applyNear(ctx, 'heatTransfer', base.heatTransfer, 0, 0, 0.02);
    this.applyNear(ctx, 'turbulence', base.turbulence, 0.22, 0.9, 3.5);
    this.applyNear(ctx, 'verticalTurbulence', base.verticalTurbulence, 0.22, 0.45, 2.1);
    this.applyNear(ctx, 'waxViscosity', base.waxViscosity, 0.08, 3.8, 5);
    this.applyNear(ctx, 'thermalContrast', base.thermalContrast, 0.28, 0.08, 0.7);
    this.applyNear(ctx, 'enhancedQuality', base.enhancedQuality, this.liteMode ? 0.06 : 0.12, 0.8, 2);
    this.applyNear(ctx, 'liquidFieldScale', base.liquidFieldScale, this.liteMode ? 0.04 : 0.08, 0.58, 1);
    this.applyNear(ctx, 'liquidParticleRadius', base.liquidParticleRadius, 0.14, 1.1, 2.2);
    this.applyNear(ctx, 'liquidExpansion', base.liquidExpansion, 0.14, 1.25, 2.35);
    this.applyNear(ctx, 'liquidSplatDensity', base.liquidSplatDensity, 0.14, 0.65, 1.45);
    this.applyNear(ctx, 'liquidSurfaceThreshold', base.liquidSurfaceThreshold, 0.16, 0.14, 0.34);
    this.applyNear(ctx, 'liquidEdgeTightness', base.liquidEdgeTightness, 0.18, 0.15, 0.34);
    this.applyNear(ctx, 'liquidEdgeSoftness', base.liquidEdgeSoftness, 0.22, 0.18, 1.15);
    this.applyNear(ctx, 'liquidRefraction', base.liquidRefraction, 0.22, 0.12, 0.62);
    this.applyNear(ctx, 'liquidGloss', base.liquidGloss, 0, 0, 0.08);
    this.applyNear(ctx, 'liquidThermalStrength', base.liquidThermalStrength, 0.18, 0.35, 0.95);
    this.applyNear(ctx, 'liquidRimLighting', base.liquidRimLighting, 0.22, 0.55, 2.1);
    this.applyNear(ctx, 'liquidBloomStrength', base.liquidBloomStrength, 0.28, 0.05, 0.8);
    this.applyNear(ctx, 'liquidHeatShimmer', base.liquidHeatShimmer, 0.25, 0.18, 1.15);
    this.applyNear(ctx, 'liquidDepthDiffusion', base.liquidDepthDiffusion, 0.28, 0.14, 0.86);
    this.applyNear(ctx, 'surfaceTension', base.surfaceTension, 0.2, 0.34, 1.1);
    this.applyNear(ctx, 'clumping', base.clumping, 0.22, 0.48, 1.55);
    this.applyNear(ctx, 'inputRadius', base.inputRadius, 0.12, 42, 112);
    this.applyNear(ctx, 'inputLift', base.inputLift, 0.2, 160, 640);
    this.applyNear(ctx, 'inputThermalRate', base.inputThermalRate, 0.22, 0.02, 0.12);
    this.applyNear(ctx, 'metaballBlend', base.metaballBlend, 0.16, 0.34, 0.78);
    this.applyNear(ctx, 'opacity', base.opacity, 0, 0.82, 1);
    this.applyNear(ctx, 'substeps', base.substeps, 0.16, 2, 4, true);
    ctx.resetScene();
    this.elapsed = 0;
    this.nextShuffleIn = this.liteMode ? 10 + Math.random() * 10 : 18 + Math.random() * 18;
  }

  private pickStyle(ctx: SimAIContext): string | undefined {
    if (ctx.styleIds.includes('violet-magma') && (this.liteMode || Math.random() > 0.34)) return 'violet-magma';
    if (ctx.styleIds.includes('neon-grape') && Math.random() > 0.65) return 'neon-grape';
    return ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
  }

  private applyNear(
    ctx: SimAIContext,
    key: string,
    baseline: number,
    ratio: number,
    min: number,
    max: number,
    integer = false,
  ): void {
    const span = Math.abs(baseline) * ratio;
    const raw = ratio === 0 ? baseline : baseline + (Math.random() * 2 - 1) * span;
    const clamped = Math.max(min, Math.min(max, raw));
    ctx.applyNumericSetting(key, integer ? Math.round(clamped) : Math.round(clamped * 100) / 100);
  }
}
