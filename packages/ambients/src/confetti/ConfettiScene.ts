import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
  type SimStyleManifest,
} from '@hooksjam/pixi-lab-core';
import { CONFETTI_DEFAULTS } from './confetti.config.js';
import { ConfettiModel } from './ConfettiModel.js';

export const confettiStyles: SimStyle[] = [
  {
    id: 'party-pop',
    name: 'Party Pop',
    description: 'Bright primary confetti for UI celebration overlays.',
    palette: [0xf43f5e, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6],
    background: 0x000000,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.22, transparency: 0.76, saturation: 0.4 },
  },
  {
    id: 'pastel-shower',
    name: 'Pastel Shower',
    description: 'Softer celebration colors for dashboards and family displays.',
    palette: [0xfbcfe8, 0xfde68a, 0xbbf7d0, 0xbae6fd, 0xddd6fe],
    background: 0x000000,
    passes: ['primitive', 'colorGrade'],
    uniforms: { softness: 0.42, transparency: 0.82, saturation: 0.18 },
  },
  {
    id: 'night-parade',
    name: 'Night Parade',
    description: 'Dimmer jewel tones for passive evening overlays.',
    palette: [0xfb7185, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa],
    background: 0x000000,
    passes: ['primitive'],
    uniforms: { dim: 0.42, transparency: 0.88 },
  },
];

export const confettiStyleManifest: SimStyleManifest = {
  defaultStyleId: 'party-pop',
  capabilities: {
    renderLayers: ['particles', 'glow', 'debug'],
    passes: ['primitive', 'bloom', 'colorGrade'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [
    ...confettiStyles,
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random confetti style each time.',
      palette: [0xf43f5e, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6],
      background: 0x000000,
      passes: [],
      uniforms: {},
      uniformSchema: [],
    },
  ],
};

export class ConfettiScene extends Scene {
  readonly name = 'Confetti';
  private renderer: ParticlePointRenderer | null = null;
  private model: ConfettiModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = confettiStyles[0];
  private elapsedSinceDataPoll = 0;
  private activePieceBudget = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override shouldRender() { return true; }

  override onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    this.renderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.renderer.setQuality(ctx.quality);
    this.createModel(ctx.seed);
    const style = ctx.systems.settings.get('style');
    if (typeof style === 'string') this.setStyle(style);
    this.pollAmbientData();
    this.syncSettings();
  }

  override onExit(): void {
    this.renderer?.destroy();
    this.renderer = null;
    this.model = null;
  }

  override update(dt: number): void {
    if (!this.model) return;
    this.elapsedSinceDataPoll += dt;
    if (this.elapsedSinceDataPoll >= 1 || this.elapsedSinceDataPoll === dt) {
      this.elapsedSinceDataPoll = 0;
      this.pollAmbientData();
      this.syncSettings();
    }
    this.model.update(dt);
  }

  override render(): void {
    if (!this.renderer || !this.model) return;
    const style = this.ctx.systems.styleManager?.getStyle() ?? this.style;
    this.renderer.renderParticles(this.model.renderParticles(), style, {
      alpha: this.preview ? 0.48 : 0.78,
      sizeScale: this.quality === 'basic' ? 0.9 : 1.16,
      zIndex: 24,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.pieceCount, fieldVariance: stats.celebration });
  }

  override resize(width: number, height: number): void {
    this.model?.resize(width, height);
  }

  override reset(): void {
    if (!this.ctx) return;
    this.createModel(this.ctx.seed + 1);
    this.pollAmbientData();
    this.syncSettings();
  }

  override setStyle(id: string): void {
    this.style = confettiStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview ? 72 : Number(settings.get('pieceCount') ?? CONFETTI_DEFAULTS.pieceCount);
    const pieceCount = Number.isFinite(requestedBudget) ? Math.max(24, Math.min(1000, Math.floor(requestedBudget))) : CONFETTI_DEFAULTS.pieceCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? CONFETTI_DEFAULTS.maxBrightness);
    this.activePieceBudget = pieceCount;
    this.model = new ConfettiModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      pieceCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : CONFETTI_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('pieceCount') ?? this.activePieceBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(24, Math.min(1000, Math.floor(requestedBudget))) : this.activePieceBudget;
    if (!this.preview && nextBudget !== this.activePieceBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? CONFETTI_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? CONFETTI_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? CONFETTI_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? CONFETTI_DEFAULTS.maxBrightness);
    const burst = Number(this.ctx.systems.settings.get('burst') ?? CONFETTI_DEFAULTS.burst);
    const gravity = Number(this.ctx.systems.settings.get('gravity') ?? CONFETTI_DEFAULTS.gravity);
    const spread = Number(this.ctx.systems.settings.get('spread') ?? CONFETTI_DEFAULTS.spread);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : CONFETTI_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : CONFETTI_DEFAULTS.maxBrightness);
    this.model.setBurst(Number.isFinite(burst) ? burst : CONFETTI_DEFAULTS.burst);
    this.model.setGravity(Number.isFinite(gravity) ? gravity : CONFETTI_DEFAULTS.gravity);
    this.model.setSpread(Number.isFinite(spread) ? spread : CONFETTI_DEFAULTS.spread);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['tasks', 'calendar', 'presence', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.31, intensity: 0.48 } }];
    this.model.applyAmbientData(snapshots);
  }
}
