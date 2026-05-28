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
import { FIREFLIES_DEFAULTS } from './fireflies.config.js';
import { FirefliesModel } from './FirefliesModel.js';

export const firefliesStyles: SimStyle[] = [
  {
    id: 'quiet-meadow',
    name: 'Quiet Meadow',
    description: 'Soft yellow-green fireflies for calm night overlays.',
    palette: [0xfef08a, 0xd9f99d, 0xa3e635, 0x052e16],
    background: 0x020617,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.34, transparency: 0.78, softness: 0.48 },
  },
  {
    id: 'summer-yard',
    name: 'Summer Yard',
    description: 'Livelier humid-night glows for seasonal foreground ambience.',
    palette: [0xfffbeb, 0xfef08a, 0x86efac, 0x064e3b],
    background: 0x03140c,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.48, contrast: 0.22, transparency: 0.72 },
  },
  {
    id: 'sleepy-lanterns',
    name: 'Sleepy Lanterns',
    description: 'Sparse dim pulses for overnight passive displays.',
    palette: [0xfef9c3, 0xbef264, 0x365314, 0x020617],
    background: 0x010409,
    passes: ['primitive'],
    uniforms: { glow: 0.14, dim: 0.8, transparency: 0.9 },
  },
];

export const firefliesStyleManifest: SimStyleManifest = {
  defaultStyleId: 'quiet-meadow',
  capabilities: {
    renderLayers: ['particles', 'glow', 'debug'],
    passes: ['primitive', 'bloom', 'colorGrade'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [
    ...firefliesStyles,
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random firefly style each time.',
      palette: [0xfef08a, 0xd9f99d, 0xa3e635, 0x020617],
      background: 0x000000,
      passes: [],
      uniforms: {},
      uniformSchema: [],
    },
  ],
};

export class FirefliesScene extends Scene {
  readonly name = 'Fireflies';
  private renderer: ParticlePointRenderer | null = null;
  private model: FirefliesModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = firefliesStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeFireflyBudget = 0;

  constructor(private readonly preview = false) {
    super();
  }

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
      alpha: this.preview ? 0.5 : 0.72,
      sizeScale: this.quality === 'basic' ? 0.88 : 1.18,
      zIndex: 22,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.fireflyCount, fieldVariance: stats.night + stats.humidity });
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
    this.style = firefliesStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview ? 56 : Number(settings.get('fireflyCount') ?? FIREFLIES_DEFAULTS.fireflyCount);
    const fireflyCount = Number.isFinite(requestedBudget) ? Math.max(24, Math.min(900, Math.floor(requestedBudget))) : FIREFLIES_DEFAULTS.fireflyCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? FIREFLIES_DEFAULTS.maxBrightness);
    this.activeFireflyBudget = fireflyCount;
    this.model = new FirefliesModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      fireflyCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : FIREFLIES_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('fireflyCount') ?? this.activeFireflyBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(24, Math.min(900, Math.floor(requestedBudget))) : this.activeFireflyBudget;
    if (!this.preview && nextBudget !== this.activeFireflyBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? FIREFLIES_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? FIREFLIES_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? FIREFLIES_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? FIREFLIES_DEFAULTS.maxBrightness);
    const glow = Number(this.ctx.systems.settings.get('glow') ?? FIREFLIES_DEFAULTS.glow);
    const drift = Number(this.ctx.systems.settings.get('drift') ?? FIREFLIES_DEFAULTS.drift);
    const meadow = Number(this.ctx.systems.settings.get('meadow') ?? FIREFLIES_DEFAULTS.meadow);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : FIREFLIES_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : FIREFLIES_DEFAULTS.maxBrightness);
    this.model.setGlow(Number.isFinite(glow) ? glow : FIREFLIES_DEFAULTS.glow);
    this.model.setDrift(Number.isFinite(drift) ? drift : FIREFLIES_DEFAULTS.drift);
    this.model.setMeadow(Number.isFinite(meadow) ? meadow : FIREFLIES_DEFAULTS.meadow);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['weather', 'presence', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.74, intensity: 0.42, daylight: 0.12 } }];
    this.model.applyAmbientData(snapshots);
  }
}
