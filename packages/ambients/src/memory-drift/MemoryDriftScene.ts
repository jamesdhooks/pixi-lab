import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { MEMORY_DRIFT_DEFAULTS } from './memory-drift.config.js';
import { MemoryDriftModel } from './MemoryDriftModel.js';

export const memoryDriftStyles: SimStyle[] = [
  {
    id: 'shoebox-glow',
    name: 'Shoebox Glow',
    description: 'Warm photo motes and soft memory frames for family-dashboard backgrounds.',
    palette: [0xfde68a, 0xf9a8d4, 0xfdba74, 0xfef3c7],
    background: 0x120a14,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.42, warmth: 0.72, grain: 0.28 },
  },
  {
    id: 'moonlit-album',
    name: 'Moonlit Album',
    description: 'Dim blue-violet memories tuned for passive overnight displays.',
    palette: [0x93c5fd, 0xa78bfa, 0x67e8f9, 0xc4b5fd],
    background: 0x030712,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.26, dim: 0.5, saturation: 0.44 },
  },
  {
    id: 'summer-slides',
    name: 'Summer Slides',
    description: 'Brighter nostalgic color drifts for active wall displays and galleries.',
    palette: [0xfca5a5, 0xfef08a, 0x86efac, 0x7dd3fc],
    background: 0x111827,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.5, warmth: 0.58, contrast: 0.5 },
  },
];

export class MemoryDriftScene extends Scene {
  readonly name = 'MemoryDrift';
  private renderer: ParticlePointRenderer | null = null;
  private model: MemoryDriftModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = memoryDriftStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeMemoryBudget = 0;
  private activeMoteBudget = 0;

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
      alpha: this.preview ? 0.6 : 0.82,
      sizeScale: this.quality === 'basic' ? 0.9 : 1.14,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.visibleParticles,
      fieldVariance: stats.paletteEnergy + stats.photoActivity,
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
    this.style = memoryDriftStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedMemories = this.preview ? 14 : Number(settings.get('memoryCount') ?? MEMORY_DRIFT_DEFAULTS.memoryCount);
    const requestedMotes = this.preview ? 28 : Number(settings.get('moteCount') ?? MEMORY_DRIFT_DEFAULTS.moteCount);
    const memoryCount = Number.isFinite(requestedMemories) ? Math.max(8, Math.min(72, Math.floor(requestedMemories))) : MEMORY_DRIFT_DEFAULTS.memoryCount;
    const moteCount = Number.isFinite(requestedMotes) ? Math.max(0, Math.min(220, Math.floor(requestedMotes))) : MEMORY_DRIFT_DEFAULTS.moteCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? MEMORY_DRIFT_DEFAULTS.maxBrightness);
    this.activeMemoryBudget = memoryCount;
    this.activeMoteBudget = moteCount;
    this.model = new MemoryDriftModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      memoryCount,
      moteCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : MEMORY_DRIFT_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedMemories = Number(this.ctx.systems.settings.get('memoryCount') ?? this.activeMemoryBudget);
    const requestedMotes = Number(this.ctx.systems.settings.get('moteCount') ?? this.activeMoteBudget);
    const nextMemories = Number.isFinite(requestedMemories) ? Math.max(8, Math.min(72, Math.floor(requestedMemories))) : this.activeMemoryBudget;
    const nextMotes = Number.isFinite(requestedMotes) ? Math.max(0, Math.min(220, Math.floor(requestedMotes))) : this.activeMoteBudget;
    if (!this.preview && (nextMemories !== this.activeMemoryBudget || nextMotes !== this.activeMoteBudget)) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? MEMORY_DRIFT_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? MEMORY_DRIFT_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? MEMORY_DRIFT_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? MEMORY_DRIFT_DEFAULTS.maxBrightness);
    const warmth = Number(this.ctx.systems.settings.get('paletteWarmth') ?? MEMORY_DRIFT_DEFAULTS.paletteWarmth);
    const speed = Number(this.ctx.systems.settings.get('driftSpeed') ?? MEMORY_DRIFT_DEFAULTS.driftSpeed);
    const nostalgia = Number(this.ctx.systems.settings.get('nostalgia') ?? MEMORY_DRIFT_DEFAULTS.nostalgia);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : MEMORY_DRIFT_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : MEMORY_DRIFT_DEFAULTS.maxBrightness);
    this.model.setPaletteWarmth(Number.isFinite(warmth) ? warmth : MEMORY_DRIFT_DEFAULTS.paletteWarmth);
    this.model.setDriftSpeed(Number.isFinite(speed) ? speed : MEMORY_DRIFT_DEFAULTS.driftSpeed);
    this.model.setNostalgia(Number.isFinite(nostalgia) ? nostalgia : MEMORY_DRIFT_DEFAULTS.nostalgia);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['photos', 'media', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.35, intensity: 0.48, activity: 0.44, nostalgia: 0.58 } }];
    this.model.applyAmbientData(snapshots);
  }
}
