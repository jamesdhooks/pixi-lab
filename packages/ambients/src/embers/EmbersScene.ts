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
import { EMBERS_DEFAULTS } from './embers.config.js';
import { EmbersModel } from './EmbersModel.js';

export const embersStyles: SimStyle[] = [
  {
    id: 'hearth-glow',
    name: 'Hearth Glow',
    description: 'Warm orange embers for cozy foreground overlays.',
    palette: [0xfef3c7, 0xfb923c, 0xef4444, 0x1f0f08],
    background: 0x120805,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.24, warmth: 0.78, transparency: 0.74 },
  },
  {
    id: 'campfire-sparks',
    name: 'Campfire Sparks',
    description: 'Brighter gold and crimson sparks with a lively updraft.',
    palette: [0xfffbeb, 0xfbbf24, 0xf97316, 0x7f1d1d],
    background: 0x1c0a04,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.34, contrast: 0.28, transparency: 0.68 },
  },
  {
    id: 'sleeping-coals',
    name: 'Sleeping Coals',
    description: 'Sparse, dim, low-motion red embers for passive night displays.',
    palette: [0xfca5a5, 0xef4444, 0x7f1d1d, 0x0f0504],
    background: 0x090302,
    passes: ['primitive'],
    uniforms: { glow: 0.08, dim: 0.82, transparency: 0.88 },
  },
];

export const embersStyleManifest: SimStyleManifest = {
  defaultStyleId: 'hearth-glow',
  capabilities: {
    renderLayers: ['particles', 'glow', 'debug'],
    passes: ['primitive', 'bloom', 'colorGrade'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [
    ...embersStyles,
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random ember style each time.',
      palette: [0xfef3c7, 0xfb923c, 0xef4444, 0x090302],
      background: 0x000000,
      passes: [],
      uniforms: {},
      uniformSchema: [],
    },
  ],
};

export class EmbersScene extends Scene {
  readonly name = 'Embers';
  private renderer: ParticlePointRenderer | null = null;
  private model: EmbersModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = embersStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeEmberBudget = 0;

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
      alpha: this.preview ? 0.54 : 0.76,
      sizeScale: this.quality === 'basic' ? 0.86 : 1.16,
      zIndex: 22,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.emberCount,
      fieldVariance: stats.heat,
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
    this.style = embersStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview
      ? 64
      : Number(settings.get('emberCount') ?? EMBERS_DEFAULTS.emberCount);
    const emberCount = Number.isFinite(requestedBudget)
      ? Math.max(24, Math.min(1000, Math.floor(requestedBudget)))
      : EMBERS_DEFAULTS.emberCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? EMBERS_DEFAULTS.maxBrightness);
    this.activeEmberBudget = emberCount;
    this.model = new EmbersModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      emberCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : EMBERS_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('emberCount') ?? this.activeEmberBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(24, Math.min(1000, Math.floor(requestedBudget))) : this.activeEmberBudget;
    if (!this.preview && nextBudget !== this.activeEmberBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? EMBERS_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? EMBERS_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? EMBERS_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? EMBERS_DEFAULTS.maxBrightness);
    const heat = Number(this.ctx.systems.settings.get('heat') ?? EMBERS_DEFAULTS.heat);
    const updraft = Number(this.ctx.systems.settings.get('updraft') ?? EMBERS_DEFAULTS.updraft);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : EMBERS_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : EMBERS_DEFAULTS.maxBrightness);
    this.model.setHeat(Number.isFinite(heat) ? heat : EMBERS_DEFAULTS.heat);
    this.model.setUpdraft(Number.isFinite(updraft) ? updraft : EMBERS_DEFAULTS.updraft);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['homeAssistant', 'weather', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.64, intensity: 0.38 } }];
    this.model.applyAmbientData(snapshots);
  }
}
