import {
  SimulationCanvasLayer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { ORBITAL_SHRAPNEL_DEFAULTS } from './orbital-shrapnel.config.js';
import { OrbitalShrapnelModel, type OrbitalShrapnelModelOptions } from './OrbitalShrapnelModel.js';
import { blackHoleLensStyle } from './styles/black-hole-lens.js';
import { iceRingStyle } from './styles/ice-ring.js';
import { solarDebrisStyle } from './styles/solar-debris.js';

export const orbitalShrapnelStyleManifest: SimStyleManifest = {
  defaultStyleId: 'ice-ring',
  capabilities: {
    renderLayers: ['particles', 'trails', 'glow', 'debug'],
    passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom', 'shockwave', 'chromaticAberration', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [iceRingStyle, solarDebrisStyle, blackHoleLensStyle],
};

export class OrbitalShrapnelScene extends SimulationScene {
  readonly name: string = 'OrbitalShrapnel';
  private layer: SimulationCanvasLayer | null = null;
  private model: OrbitalShrapnelModel | null = null;
  private modelOptions: OrbitalShrapnelModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastParticleCount = 0;
  private lastTrailColumns = 0;
  private lastPlanetRadius = 0;
  private lastGravity = 0;
  private lastTrailFade = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const trailColumns = this.previewColumns ?? ((settings.get('trailColumns') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailColumns as number));
    const particleCount = this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.particleCount as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      particleCount,
      trailColumns,
      trailRows: Math.max(12, Math.round(trailColumns * ctx.height / Math.max(1, ctx.width))),
      planetRadius: (settings.get('planetRadius') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.planetRadius as number),
      gravity: (settings.get('gravity') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.gravity as number),
      drag: ORBITAL_SHRAPNEL_DEFAULTS.drag as number,
      trailFade: (settings.get('trailFade') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailFade as number),
    };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.layer?.destroy();
    this.layer = null;
    this.model = null;
    this.modelOptions = null;
  }

  override update(dt: number): void {
    if (!this.model || !this.modelOptions) return;
    this.applyLiveSettings();
    for (const gesture of this.consumeGestures()) this.model.handleGesture(gesture);
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.layer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? iceRingStyle;
    this.layer.clear();
    this.layer.renderField(this.model.trailField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.trailVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, trailRows: Math.max(12, Math.round(this.modelOptions.trailColumns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }


  private applyLiveSettings(): void {
    if (!this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const particleCount = this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.particleCount as number));
    const trailColumns = this.previewColumns ?? ((settings.get('trailColumns') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailColumns as number));
    const planetRadius = (settings.get('planetRadius') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.planetRadius as number);
    const gravity = (settings.get('gravity') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.gravity as number);
    const trailFade = (settings.get('trailFade') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailFade as number);

    if (
      particleCount === this.lastParticleCount &&
      trailColumns === this.lastTrailColumns &&
      planetRadius === this.lastPlanetRadius &&
      gravity === this.lastGravity &&
      trailFade === this.lastTrailFade
    ) {
      return;
    }

    this.modelOptions = {
      ...this.modelOptions,
      particleCount,
      trailColumns,
      trailRows: Math.max(12, Math.round(trailColumns * this.ctx_.height / Math.max(1, this.ctx_.width))),
      planetRadius,
      gravity,
      trailFade,
      seed: this.modelOptions.seed + 1,
    };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastParticleCount = this.modelOptions.particleCount;
    this.lastTrailColumns = this.modelOptions.trailColumns;
    this.lastPlanetRadius = this.modelOptions.planetRadius;
    this.lastGravity = this.modelOptions.gravity;
    this.lastTrailFade = this.modelOptions.trailFade ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailFade as number);
  }

  getRenderLayers(): SimRenderLayers {
    const layers = this.layer?.getRenderLayers() ?? {};
    return { ...layers, trails: layers.field };
  }

  getStyleManifest(): SimStyleManifest {
    return orbitalShrapnelStyleManifest;
  }

  detectStagnation(): StagnationReport {
    return this.stagnationReport;
  }

  stabilize(): void {
    this.model?.stabilize();
    this.stagnationReport = { stagnant: false, severity: 0 };
  }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new OrbitalShrapnelModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }
}
