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
import { ANT_SIGNAL_DEFAULTS } from './ant-signal.config.js';
import { AntSignalModel, type AntSignalModelOptions } from './AntSignalModel.js';
import { circuitAntsStyle } from './styles/circuit-ants.js';
import { fungalRoadsStyle } from './styles/fungal-roads.js';
import { neonColonyStyle } from './styles/neon-colony.js';

export const antSignalStyleManifest: SimStyleManifest = {
  defaultStyleId: 'neon-colony',
  capabilities: {
    renderLayers: ['trails', 'field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'trailFeedback', 'bloom', 'edgeGlow', 'contourBands'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [neonColonyStyle, circuitAntsStyle, fungalRoadsStyle],
};

export class AntSignalScene extends SimulationScene {
  readonly name: string = 'AntSignal';
  private layer: SimulationCanvasLayer | null = null;
  private model: AntSignalModel | null = null;
  private modelOptions: AntSignalModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastAntCount = 0;
  private lastFieldColumns = 0;
  private lastFoodCount = 0;
  private lastPheromoneDecay = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('fieldColumns') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.fieldColumns as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      antCount: this.previewBudget ?? ((settings.get('antCount') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.antCount as number)),
      foodCount: (settings.get('foodCount') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.foodCount as number),
      pheromoneDecay: (settings.get('pheromoneDecay') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.pheromoneDecay as number),
    };
    this.model = new AntSignalModel(this.modelOptions);
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
    const style = this.ctx_.systems.styleManager?.getStyle() ?? neonColonyStyle;
    this.layer.clear();
    this.layer.renderField(this.model.foodSignalField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderField(this.model.pheromoneField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.antCount, fieldVariance: stats.trailVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new AntSignalModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new AntSignalModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }


  private applyLiveSettings(): void {
    if (!this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('fieldColumns') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.fieldColumns as number));
    const antCount = this.previewBudget ?? ((settings.get('antCount') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.antCount as number));
    const foodCount = (settings.get('foodCount') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.foodCount as number);
    const pheromoneDecay = (settings.get('pheromoneDecay') as number | undefined) ?? (ANT_SIGNAL_DEFAULTS.pheromoneDecay as number);

    if (
      columns === this.lastFieldColumns &&
      antCount === this.lastAntCount &&
      foodCount === this.lastFoodCount &&
      pheromoneDecay === this.lastPheromoneDecay
    ) {
      return;
    }

    this.modelOptions = {
      ...this.modelOptions,
      columns,
      rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))),
      antCount,
      foodCount,
      pheromoneDecay,
      seed: this.modelOptions.seed + 1,
    };
    this.model = new AntSignalModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastFieldColumns = this.modelOptions.columns;
    this.lastAntCount = this.modelOptions.antCount;
    this.lastFoodCount = this.modelOptions.foodCount;
    this.lastPheromoneDecay = this.modelOptions.pheromoneDecay;
  }

  getRenderLayers(): SimRenderLayers {
    const layers = this.layer?.getRenderLayers() ?? {};
    return { ...layers, trails: layers.field, glow: layers.particles };
  }

  getStyleManifest(): SimStyleManifest {
    return antSignalStyleManifest;
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
      this.model = new AntSignalModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }
}
