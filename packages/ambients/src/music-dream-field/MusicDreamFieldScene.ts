import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { MUSIC_DREAM_FIELD_DEFAULTS } from './music-dream-field.config.js';
import { MusicDreamFieldModel } from './MusicDreamFieldModel.js';

export const musicDreamFieldStyles: SimStyle[] = [
  {
    id: 'violet-dreamwave',
    name: 'Violet Dreamwave',
    description: 'Soft violet and cyan pulses for synthetic beat-reactive background use.',
    palette: [0xa78bfa, 0x22d3ee, 0xf0abfc, 0x111827],
    background: 0x050816,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.24, haze: 0.42, saturation: 0.72 },
  },
  {
    id: 'lofi-aurora',
    name: 'Lo-fi Aurora',
    description: 'Dim teal and amber ribbons tuned for dashboards and low-motion ambience.',
    palette: [0x2dd4bf, 0xfde68a, 0x60a5fa, 0x0f172a],
    background: 0x020617,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.14, grain: 0.18, calm: 0.62 },
  },
  {
    id: 'sleeping-synth',
    name: 'Sleeping Synth',
    description: 'Muted indigo pulses with reduced contrast for night listening and sleep mode.',
    palette: [0x818cf8, 0xc4b5fd, 0x64748b, 0x1e1b4b],
    background: 0x030712,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.1, dim: 0.78, pulse: 0.24 },
  },
];

export class MusicDreamFieldScene extends Scene {
  readonly name = 'MusicDreamField';
  private renderer: ParticlePointRenderer | null = null;
  private model: MusicDreamFieldModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = musicDreamFieldStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeOrbBudget = 0;
  private activeRibbonBudget = 0;

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
    if (this.elapsedSinceDataPoll >= 0.5 || this.elapsedSinceDataPoll === dt) {
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
      alpha: this.preview ? 0.56 : 0.82,
      sizeScale: this.quality === 'basic' ? 0.82 : 1.08,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.visibleParticles,
      fieldVariance: stats.beatEnergy,
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
    this.style = musicDreamFieldStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedOrbs = this.preview ? 44 : Number(settings.get('orbCount') ?? MUSIC_DREAM_FIELD_DEFAULTS.orbCount);
    const requestedRibbons = this.preview ? 14 : Number(settings.get('ribbonCount') ?? MUSIC_DREAM_FIELD_DEFAULTS.ribbonCount);
    const orbCount = Number.isFinite(requestedOrbs) ? Math.max(24, Math.min(360, Math.floor(requestedOrbs))) : MUSIC_DREAM_FIELD_DEFAULTS.orbCount;
    const ribbonCount = Number.isFinite(requestedRibbons) ? Math.max(6, Math.min(120, Math.floor(requestedRibbons))) : MUSIC_DREAM_FIELD_DEFAULTS.ribbonCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? MUSIC_DREAM_FIELD_DEFAULTS.maxBrightness);
    this.activeOrbBudget = orbCount;
    this.activeRibbonBudget = ribbonCount;
    this.model = new MusicDreamFieldModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      orbCount,
      ribbonCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : MUSIC_DREAM_FIELD_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedOrbs = Number(this.ctx.systems.settings.get('orbCount') ?? this.activeOrbBudget);
    const requestedRibbons = Number(this.ctx.systems.settings.get('ribbonCount') ?? this.activeRibbonBudget);
    const nextOrbs = Number.isFinite(requestedOrbs) ? Math.max(24, Math.min(360, Math.floor(requestedOrbs))) : this.activeOrbBudget;
    const nextRibbons = Number.isFinite(requestedRibbons) ? Math.max(6, Math.min(120, Math.floor(requestedRibbons))) : this.activeRibbonBudget;
    if (!this.preview && (nextOrbs !== this.activeOrbBudget || nextRibbons !== this.activeRibbonBudget)) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? MUSIC_DREAM_FIELD_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? MUSIC_DREAM_FIELD_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? MUSIC_DREAM_FIELD_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? MUSIC_DREAM_FIELD_DEFAULTS.maxBrightness);
    const beatSensitivity = Number(this.ctx.systems.settings.get('beatSensitivity') ?? MUSIC_DREAM_FIELD_DEFAULTS.beatSensitivity);
    const drift = Number(this.ctx.systems.settings.get('driftStrength') ?? MUSIC_DREAM_FIELD_DEFAULTS.driftStrength);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : MUSIC_DREAM_FIELD_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : MUSIC_DREAM_FIELD_DEFAULTS.maxBrightness);
    this.model.setBeatSensitivity(Number.isFinite(beatSensitivity) ? beatSensitivity : MUSIC_DREAM_FIELD_DEFAULTS.beatSensitivity);
    this.model.setDriftStrength(Number.isFinite(drift) ? drift : MUSIC_DREAM_FIELD_DEFAULTS.driftStrength);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['media', 'synthetic', 'time'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.42, beat: 0.56, flux: 0.48, bpm: 96 } }];
    this.model.applyAmbientData(snapshots);
  }
}
