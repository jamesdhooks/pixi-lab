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
import { CRYSTAL_PLASMA_DEFAULTS } from './crystal-plasma.config.js';
import { CrystalPlasmaModel, type CrystalPlasmaModelOptions } from './CrystalPlasmaModel.js';
import { auroraQuartzStyle } from './styles/aurora-quartz.js';
import { iceLightningStyle } from './styles/ice-lightning.js';
import { rubyFaultStyle } from './styles/ruby-fault.js';

export const crystalPlasmaStyleManifest: SimStyleManifest = {
  defaultStyleId: 'ice-lightning',
  capabilities: {
    renderLayers: ['field', 'trails', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [iceLightningStyle, rubyFaultStyle, auroraQuartzStyle],
};

export class CrystalPlasmaScene extends SimulationScene {
  readonly name: string = 'CrystalPlasma';
  private layer: SimulationCanvasLayer | null = null;
  private model: CrystalPlasmaModel | null = null;
  private modelOptions: CrystalPlasmaModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastMaxCrystals = 0;
  private lastFieldColumns = 0;
  private lastStressDecay = 0;
  private lastGrowthBias = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('fieldColumns') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.fieldColumns as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      maxCrystals: this.previewBudget ?? ((settings.get('maxCrystals') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.maxCrystals as number)),
      stressDecay: (settings.get('stressDecay') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.stressDecay as number),
      growthBias: (settings.get('growthBias') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.growthBias as number),
    };
    this.model = new CrystalPlasmaModel(this.modelOptions);
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
    const style = this.ctx_.systems.styleManager?.getStyle() ?? iceLightningStyle;
    this.layer.clear();
    this.layer.renderField(this.model.stressField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderField(this.model.fractureField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.crystalCount, fieldVariance: stats.stressVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new CrystalPlasmaModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new CrystalPlasmaModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }


  private applyLiveSettings(): void {
    if (!this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('fieldColumns') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.fieldColumns as number));
    const maxCrystals = this.previewBudget ?? ((settings.get('maxCrystals') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.maxCrystals as number));
    const stressDecay = (settings.get('stressDecay') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.stressDecay as number);
    const growthBias = (settings.get('growthBias') as number | undefined) ?? (CRYSTAL_PLASMA_DEFAULTS.growthBias as number);

    if (
      columns === this.lastFieldColumns &&
      maxCrystals === this.lastMaxCrystals &&
      stressDecay === this.lastStressDecay &&
      growthBias === this.lastGrowthBias
    ) {
      return;
    }

    this.modelOptions = {
      ...this.modelOptions,
      columns,
      rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))),
      maxCrystals,
      stressDecay,
      growthBias,
      seed: this.modelOptions.seed + 1,
    };
    this.model = new CrystalPlasmaModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastFieldColumns = this.modelOptions.columns;
    this.lastMaxCrystals = this.modelOptions.maxCrystals;
    this.lastStressDecay = this.modelOptions.stressDecay;
    this.lastGrowthBias = this.modelOptions.growthBias ?? (CRYSTAL_PLASMA_DEFAULTS.growthBias as number);
  }

  getRenderLayers(): SimRenderLayers {
    const layers = this.layer?.getRenderLayers() ?? {};
    return { ...layers, trails: layers.field, glow: layers.particles };
  }

  getStyleManifest(): SimStyleManifest {
    return crystalPlasmaStyleManifest;
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
      this.model = new CrystalPlasmaModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }
}
