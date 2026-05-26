import {
  FieldPaletteRenderer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { NEON_RIVER_DELTA_DEFAULTS } from './neon-river-delta.config.js';
import { NeonRiverDeltaModel, type NeonRiverDeltaModelOptions } from './NeonRiverDeltaModel.js';
import { acidDawnStyle } from './styles/acid-dawn.js';
import { blacklightAlluviumStyle } from './styles/blacklight-alluvium.js';
import { electricEstuaryStyle } from './styles/electric-estuary.js';

export const neonRiverDeltaStyleManifest: SimStyleManifest = {
  defaultStyleId: 'electric-estuary',
  capabilities: {
    renderLayers: ['field', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [electricEstuaryStyle, acidDawnStyle, blacklightAlluviumStyle],
};

export class NeonRiverDeltaScene extends SimulationScene {
  readonly name: string = 'NeonRiverDelta';
  private terrainRenderer: FieldPaletteRenderer | null = null;
  private waterRenderer: FieldPaletteRenderer | null = null;
  private sedimentRenderer: FieldPaletteRenderer | null = null;
  private flowRenderer: FieldPaletteRenderer | null = null;
  private model: NeonRiverDeltaModel | null = null;
  private modelOptions: NeonRiverDeltaModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastRainfall = 0;
  private lastErosionRate = 0;
  private lastSedimentGlow = 0;
  private lastFlowSpeed = 0;

  constructor(private readonly previewColumns?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.terrainRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.waterRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.sedimentRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.flowRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      rainfall: (settings.get('rainfall') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.rainfall as number),
      erosionRate: (settings.get('erosionRate') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.erosionRate as number),
      sedimentGlow: (settings.get('sedimentGlow') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.sedimentGlow as number),
      flowSpeed: (settings.get('flowSpeed') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.flowSpeed as number),
    };
    this.model = new NeonRiverDeltaModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.terrainRenderer?.destroy();
    this.waterRenderer?.destroy();
    this.sedimentRenderer?.destroy();
    this.flowRenderer?.destroy();
    this.terrainRenderer = null;
    this.waterRenderer = null;
    this.sedimentRenderer = null;
    this.flowRenderer = null;
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
    if (!this.model || !this.terrainRenderer || !this.waterRenderer || !this.sedimentRenderer || !this.flowRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? electricEstuaryStyle;
    this.terrainRenderer.clear();
    this.waterRenderer.clear();
    this.sedimentRenderer.clear();
    this.flowRenderer.clear();
    this.terrainRenderer.renderField('neon-river-terrain', this.model.terrainField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.86, gamma: 1.18, zIndex: 0 });
    this.waterRenderer.renderField('neon-river-water', this.model.waterField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.66, gamma: 0.58, zIndex: 1 });
    this.sedimentRenderer.renderField('neon-river-sediment', this.model.sedimentField, this.ctx_.width, this.ctx_.height, style, { alpha: this.quality === 'enhanced' ? 0.72 : 0.48, gamma: 0.5, zIndex: 2 });
    if (this.quality === 'enhanced') this.flowRenderer.renderField('neon-river-flow', this.model.flowField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.28, gamma: 0.42, zIndex: 3 });
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.columns * stats.rows, fieldVariance: stats.waterVariance + stats.sedimentVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new NeonRiverDeltaModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new NeonRiverDeltaModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.terrainRenderer?.setQuality(quality);
    this.waterRenderer?.setQuality(quality);
    this.sedimentRenderer?.setQuality(quality);
    this.flowRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      field: this.terrainRenderer?.getLayer('neon-river-terrain'),
      glow: this.sedimentRenderer?.getLayer('neon-river-sediment'),
      debug: this.flowRenderer?.getLayer('neon-river-flow'),
    };
  }

  getStyleManifest(): SimStyleManifest { return neonRiverDeltaStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new NeonRiverDeltaModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.resolution as number));
    const rainfall = (settings.get('rainfall') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.rainfall as number);
    const erosionRate = (settings.get('erosionRate') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.erosionRate as number);
    const sedimentGlow = (settings.get('sedimentGlow') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.sedimentGlow as number);
    const flowSpeed = (settings.get('flowSpeed') as number | undefined) ?? (NEON_RIVER_DELTA_DEFAULTS.flowSpeed as number);
    if (columns !== this.lastColumns) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), rainfall, erosionRate, sedimentGlow, flowSpeed, seed: this.modelOptions.seed + 1 };
      this.model = new NeonRiverDeltaModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (rainfall !== this.lastRainfall) { this.lastRainfall = rainfall; this.model.setRainfall(rainfall); this.modelOptions = { ...this.modelOptions, rainfall }; }
    if (erosionRate !== this.lastErosionRate) { this.lastErosionRate = erosionRate; this.model.setErosionRate(erosionRate); this.modelOptions = { ...this.modelOptions, erosionRate }; }
    if (sedimentGlow !== this.lastSedimentGlow) { this.lastSedimentGlow = sedimentGlow; this.model.setSedimentGlow(sedimentGlow); this.modelOptions = { ...this.modelOptions, sedimentGlow }; }
    if (flowSpeed !== this.lastFlowSpeed) { this.lastFlowSpeed = flowSpeed; this.model.setFlowSpeed(flowSpeed); this.modelOptions = { ...this.modelOptions, flowSpeed }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastRainfall = this.modelOptions.rainfall;
    this.lastErosionRate = this.modelOptions.erosionRate;
    this.lastSedimentGlow = this.modelOptions.sedimentGlow;
    this.lastFlowSpeed = this.modelOptions.flowSpeed;
  }
}
