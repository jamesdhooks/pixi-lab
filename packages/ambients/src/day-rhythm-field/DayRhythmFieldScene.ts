import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { DAY_RHYTHM_FIELD_DEFAULTS } from './day-rhythm-field.config.js';
import { DayRhythmFieldModel } from './DayRhythmFieldModel.js';

export const dayRhythmFieldStyles: SimStyle[] = [
  {
    id: 'soft-daylight',
    name: 'Soft Daylight',
    description: 'Warm dawns, clear daylight, violet dusk, and quiet blue nights.',
    palette: [0x7dd3fc, 0xfef3c7, 0xfb7185, 0x1e3a8a],
    background: 0x07111f,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.38, grain: 0.08 },
  },
  {
    id: 'dashboard-glass',
    name: 'Dashboard Glass',
    description: 'Lower contrast particles designed for readable UI backgrounds.',
    palette: [0x67e8f9, 0xa7f3d0, 0xc4b5fd, 0xf0abfc],
    background: 0x050816,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.22, dim: 0.55 },
  },
  {
    id: 'sleep-horizon',
    name: 'Sleep Horizon',
    description: 'Cool dim gradients for night mode and low-motion dashboards.',
    palette: [0x1d4ed8, 0x7c3aed, 0x0f766e, 0x93c5fd],
    background: 0x020617,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.12, dim: 0.72 },
  },
];

export class DayRhythmFieldScene extends Scene {
  readonly name = 'DayRhythmField';
  private renderer: ParticlePointRenderer | null = null;
  private model: DayRhythmFieldModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = dayRhythmFieldStyles[0];
  private elapsedSinceDataPoll = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    this.renderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.renderer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const particleCount = this.preview
      ? 48
      : ((settings.get('particleCount') as number | undefined) ?? (DAY_RHYTHM_FIELD_DEFAULTS.particleCount as number));
    const maxBrightness = (settings.get('maxBrightness') as number | undefined) ?? (DAY_RHYTHM_FIELD_DEFAULTS.maxBrightness as number);
    this.model = new DayRhythmFieldModel({
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      particleCount,
      maxBrightness,
    });
    this.pollAmbientData();
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
      alpha: this.preview ? 0.72 : 0.9,
      sizeScale: this.quality === 'basic' ? 0.72 : 0.95,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.particleCount,
      fieldVariance: stats.brightness,
    });
  }

  override resize(width: number, height: number): void {
    this.model?.resize(width, height);
  }

  override reset(): void {
    if (!this.ctx) return;
    const currentStats = this.model?.stats();
    this.model = new DayRhythmFieldModel({
      seed: this.ctx.seed + 1,
      width: this.ctx.width,
      height: this.ctx.height,
      particleCount: currentStats?.particleCount ?? (DAY_RHYTHM_FIELD_DEFAULTS.particleCount as number),
      maxBrightness: (DAY_RHYTHM_FIELD_DEFAULTS.maxBrightness as number),
    });
    this.pollAmbientData();
  }

  override setStyle(id: string): void {
    this.style = dayRhythmFieldStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private syncSettings(): void {
    if (!this.model) return;
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? false);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? false);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? DAY_RHYTHM_FIELD_DEFAULTS.intensity);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : 1);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.5, intensity: 0.5 } }];
    this.model.applyAmbientData(snapshots);
  }
}
