import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { SLEEP_AQUARIUM_DEFAULTS } from './sleep-aquarium.config.js';
import { SleepAquariumModel } from './SleepAquariumModel.js';

export const sleepAquariumStyles: SimStyle[] = [
  {
    id: 'moonlit-reef',
    name: 'Moonlit Reef',
    description: 'Dim cyan fish, soft bubbles, and a midnight reef palette for passive sleep displays.',
    palette: [0x67e8f9, 0x93c5fd, 0xc4b5fd, 0x0f172a],
    background: 0x020617,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.2, dim: 0.68, caustics: 0.22 },
  },
  {
    id: 'deep-lullaby',
    name: 'Deep Lullaby',
    description: 'Lower contrast violet-blue currents for night dashboards and low-motion mode.',
    palette: [0x1d4ed8, 0x7c3aed, 0x64748b, 0xbfdbfe],
    background: 0x030712,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.1, dim: 0.82, drift: 0.18 },
  },
  {
    id: 'quiet-kelp',
    name: 'Quiet Kelp',
    description: 'Muted teal and sea-glass colors for calm daytime background use.',
    palette: [0x99f6e4, 0x2dd4bf, 0xa7f3d0, 0x134e4a],
    background: 0x042f2e,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.18, kelp: 0.34, softness: 0.46 },
  },
];

export class SleepAquariumScene extends Scene {
  readonly name = 'SleepAquarium';
  private renderer: ParticlePointRenderer | null = null;
  private model: SleepAquariumModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = sleepAquariumStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeFishBudget = 0;
  private activeBubbleBudget = 0;

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
      alpha: this.preview ? 0.58 : 0.78,
      sizeScale: this.quality === 'basic' ? 0.78 : 1.04,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.visibleParticles,
      fieldVariance: stats.dreamIntensity,
    });
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
    this.style = sleepAquariumStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedFish = this.preview ? 36 : Number(settings.get('fishCount') ?? SLEEP_AQUARIUM_DEFAULTS.fishCount);
    const requestedBubbles = this.preview ? 24 : Number(settings.get('bubbleCount') ?? SLEEP_AQUARIUM_DEFAULTS.bubbleCount);
    const fishCount = Number.isFinite(requestedFish) ? Math.max(16, Math.min(360, Math.floor(requestedFish))) : SLEEP_AQUARIUM_DEFAULTS.fishCount;
    const bubbleCount = Number.isFinite(requestedBubbles) ? Math.max(8, Math.min(300, Math.floor(requestedBubbles))) : SLEEP_AQUARIUM_DEFAULTS.bubbleCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? SLEEP_AQUARIUM_DEFAULTS.maxBrightness);
    this.activeFishBudget = fishCount;
    this.activeBubbleBudget = bubbleCount;
    this.model = new SleepAquariumModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      fishCount,
      bubbleCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : SLEEP_AQUARIUM_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedFish = Number(this.ctx.systems.settings.get('fishCount') ?? this.activeFishBudget);
    const requestedBubbles = Number(this.ctx.systems.settings.get('bubbleCount') ?? this.activeBubbleBudget);
    const nextFish = Number.isFinite(requestedFish) ? Math.max(16, Math.min(360, Math.floor(requestedFish))) : this.activeFishBudget;
    const nextBubbles = Number.isFinite(requestedBubbles) ? Math.max(8, Math.min(300, Math.floor(requestedBubbles))) : this.activeBubbleBudget;
    if (!this.preview && (nextFish !== this.activeFishBudget || nextBubbles !== this.activeBubbleBudget)) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? SLEEP_AQUARIUM_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? SLEEP_AQUARIUM_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? SLEEP_AQUARIUM_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? SLEEP_AQUARIUM_DEFAULTS.maxBrightness);
    const current = Number(this.ctx.systems.settings.get('currentStrength') ?? SLEEP_AQUARIUM_DEFAULTS.currentStrength);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : SLEEP_AQUARIUM_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : SLEEP_AQUARIUM_DEFAULTS.maxBrightness);
    this.model.setCurrentStrength(Number.isFinite(current) ? current : SLEEP_AQUARIUM_DEFAULTS.currentStrength);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.86, intensity: 0.42, sleepMode: true } }];
    this.model.applyAmbientData(snapshots);
  }
}
