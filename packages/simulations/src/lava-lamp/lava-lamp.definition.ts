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
  short: 'Thermal metaball wax blobs rise, cool, fall, and clump.',
  long: 'A raw WebGL lava-lamp simulation with a source-faithful raymarched wax shader, thermal controls, and shared-scene preview/debug support.',
  tags: ['simulation', 'metaball', 'thermal', 'raw-webgl'],
  attributions: [
    {
      label: 'WebGL Lava Lamp',
      href: 'https://github.com/brybrant/lava-lamp',
      author: 'Matt Bryant',
      license: 'GPL-3.0',
    },
    {
      label: 'Raymarch lava lamp shader',
      href: 'https://www.shadertoy.com/view/fsKXDm',
      author: '@Arrangemonk',
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
    { id: 'heat', label: 'Raise', icon: '▲', description: 'Add or heat nearby wax and lift it upward.' },
    { id: 'cool', label: 'Lower', icon: '▼', description: 'Add or cool nearby wax and pull it downward.' },
  ],
  styleManifest: lavaLampStyleManifest,
  directorEvents: [],
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'raymarched-lava-lamp',
    portability: 'reusable-core',
    supportedShapes: ['circle', 'soft-body'],
    reusableFor: ['raymarched lava lamps', 'smooth-union blob shaders', 'thermal buoyancy toys'],
    caveats: ['The visible lava surface is a fullscreen WebGL2 raymarch adaptation fed by a capped set of smoothed clusters extracted from the live CPU particle/metaball field, so the shader is a render layer rather than the simulation source of truth.'],
  },
  factory: () => new RawParticleMetaballScene('lava-lamp'),
  previewFactory: () => new RawParticleMetaballScene('lava-lamp', true),
  demoAiFactory: (ctx) => new LavaLampDemoAI(ctx.isPreview),
};

const PRIMARY_THERMAL_BRUSH_ID = -8101;
const SECONDARY_THERMAL_BRUSH_ID = -8102;
const PRIMARY_THERMAL_STRENGTH = 1;
const SECONDARY_THERMAL_STRENGTH = 0.45;

class LavaLampDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextShuffleIn = 0;
  private angle = 0;
  private cooling = false;

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
    const primaryY = ctx.height * (this.cooling ? 0.28 + Math.cos(this.angle * 1.1) * 0.1 : 0.72 + Math.cos(this.angle * 1.1) * 0.12);
    const secondaryY = ctx.height * (this.cooling ? 0.74 + Math.sin(this.angle * 0.8) * 0.08 : 0.24 + Math.sin(this.angle * 0.8) * 0.08);
    return [{
      kind: 'drag',
      id: PRIMARY_THERMAL_BRUSH_ID,
      x: primaryX,
      y: primaryY,
      dx: Math.cos(this.angle) * 8,
      dy: this.cooling ? Math.abs(Math.sin(this.angle)) * 8 : -Math.abs(Math.sin(this.angle)) * 8,
      strength: this.cooling ? -PRIMARY_THERMAL_STRENGTH : PRIMARY_THERMAL_STRENGTH,
      timestamp: performance.now(),
    }, {
      kind: 'drag',
      id: SECONDARY_THERMAL_BRUSH_ID,
      x: secondaryX,
      y: secondaryY,
      dx: -Math.cos(this.angle * 0.8) * 5,
      dy: this.cooling ? -Math.abs(Math.sin(this.angle * 0.9)) * 5 : Math.abs(Math.sin(this.angle * 0.9)) * 5,
      strength: this.cooling ? SECONDARY_THERMAL_STRENGTH : -SECONDARY_THERMAL_STRENGTH,
      timestamp: performance.now(),
    }];
  }

  reset(): void {
    this.elapsed = 0;
    this.nextShuffleIn = 0;
    this.angle = 0;
    this.cooling = false;
  }

  private randomize(ctx: SimAIContext): void {
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    this.cooling = Math.random() > 0.68;
    ctx.applySetting('renderStyle', Math.random() > 0.72 ? 'cellular' : Math.random() > 0.42 ? 'glow' : 'smooth');
    ctx.applyNumericSetting('maxParticles', this.liteMode ? 90 + Math.floor(Math.random() * 80) : 180 + Math.floor(Math.random() * 240));
    ctx.applyNumericSetting('initialBlobs', this.liteMode ? 60 + Math.floor(Math.random() * 70) : 120 + Math.floor(Math.random() * 260));
    ctx.applyNumericSetting('blobRadius', this.liteMode ? 15 + Math.random() * 8 : 14 + Math.random() * 26);
    ctx.applyNumericSetting('buoyancy', 380 + Math.random() * 480);
    ctx.applyNumericSetting('clumping', 0.38 + Math.random() * 0.75);
    ctx.applyNumericSetting('surfaceTension', 0.24 + Math.random() * 0.52);
    ctx.applyNumericSetting('thermalContrast', 0.7 + Math.random() * 1.5);
    ctx.applyNumericSetting('waxViscosity', 0.42 + Math.random() * 0.42);
    ctx.applyNumericSetting('heatRate', 0.06 + Math.random() * 0.14);
    ctx.applyNumericSetting('coolRate', 0.035 + Math.random() * 0.11);
    ctx.applyNumericSetting('inputLift', 160 + Math.random() * 360);
    ctx.applyNumericSetting('inputThermalRate', 0.04 + Math.random() * 0.13);
    ctx.resetScene();
    this.elapsed = 0;
    this.nextShuffleIn = this.liteMode ? 9 + Math.random() * 8 : 16 + Math.random() * 16;
  }
}
