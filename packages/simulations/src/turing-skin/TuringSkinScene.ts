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
import { TURING_SKIN_DEFAULTS } from './turing-skin.config.js';
import { TuringSkinModel, type TuringSkinModelOptions } from './TuringSkinModel.js';
import { coralMorphStyle } from './styles/coral-morph.js';
import { leopardGoldStyle } from './styles/leopard-gold.js';
import { zebraGhostStyle } from './styles/zebra-ghost.js';

export const turingSkinStyleManifest: SimStyleManifest = {
  defaultStyleId: 'leopard-gold',
  capabilities: {
    renderLayers: ['field', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [leopardGoldStyle, zebraGhostStyle, coralMorphStyle],
};

export class TuringSkinScene extends SimulationScene {
  readonly name: string = 'TuringSkin';
  private fieldRenderer: FieldPaletteRenderer | null = null;
  private model: TuringSkinModel | null = null;
  private modelOptions: TuringSkinModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastFeedRate = 0;
  private lastKillRate = 0;
  private lastDiffusionA = 0;
  private lastDiffusionB = 0;
  private lastBrushStrength = 0;

  constructor(private readonly previewColumns?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.fieldRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.fieldRenderer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (TURING_SKIN_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      feedRate: (settings.get('feedRate') as number | undefined) ?? (TURING_SKIN_DEFAULTS.feedRate as number),
      killRate: (settings.get('killRate') as number | undefined) ?? (TURING_SKIN_DEFAULTS.killRate as number),
      diffusionA: (settings.get('diffusionA') as number | undefined) ?? (TURING_SKIN_DEFAULTS.diffusionA as number),
      diffusionB: (settings.get('diffusionB') as number | undefined) ?? (TURING_SKIN_DEFAULTS.diffusionB as number),
      brushStrength: (settings.get('brushStrength') as number | undefined) ?? (TURING_SKIN_DEFAULTS.brushStrength as number),
    };
    this.model = new TuringSkinModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.fieldRenderer?.destroy();
    this.fieldRenderer = null;
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
    if (!this.model || !this.fieldRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? leopardGoldStyle;
    this.fieldRenderer.clear();
    this.fieldRenderer.renderField('pigment', this.model.pigmentField, this.ctx_.width, this.ctx_.height, style, {
      alpha: 0.96,
      gamma: this.quality === 'enhanced' ? 0.58 : 0.72,
      zIndex: 0,
      upscaleMode: 'nearest',
    });
    const debug = this.ctx_.systems.debug;
    if (debug?.isEnabled()) {
      const stats = this.model.stats();
      debug.update({ fps: 0, quality: this.quality, particleCount: stats.columns * stats.rows, fieldVariance: stats.fieldVariance });
    }
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new TuringSkinModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new TuringSkinModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.fieldRenderer?.setQuality(quality);
  }

  override getCanvasImageRendering(): 'auto' | 'pixelated' {
    return 'pixelated';
  }

  getRenderLayers(): SimRenderLayers { return { field: this.fieldRenderer?.getLayer('pigment'), glow: this.fieldRenderer?.getLayer('pigment') }; }
  getStyleManifest(): SimStyleManifest { return turingSkinStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }
  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new TuringSkinModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (TURING_SKIN_DEFAULTS.resolution as number));
    const feedRate = (settings.get('feedRate') as number | undefined) ?? (TURING_SKIN_DEFAULTS.feedRate as number);
    const killRate = (settings.get('killRate') as number | undefined) ?? (TURING_SKIN_DEFAULTS.killRate as number);
    const diffusionA = (settings.get('diffusionA') as number | undefined) ?? (TURING_SKIN_DEFAULTS.diffusionA as number);
    const diffusionB = (settings.get('diffusionB') as number | undefined) ?? (TURING_SKIN_DEFAULTS.diffusionB as number);
    const brushStrength = (settings.get('brushStrength') as number | undefined) ?? (TURING_SKIN_DEFAULTS.brushStrength as number);
    if (columns !== this.lastColumns) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), feedRate, killRate, diffusionA, diffusionB, brushStrength, seed: this.modelOptions.seed + 1 };
      this.model = new TuringSkinModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (feedRate !== this.lastFeedRate) { this.lastFeedRate = feedRate; this.model.setFeedRate(feedRate); this.modelOptions = { ...this.modelOptions, feedRate }; }
    if (killRate !== this.lastKillRate) { this.lastKillRate = killRate; this.model.setKillRate(killRate); this.modelOptions = { ...this.modelOptions, killRate }; }
    if (diffusionA !== this.lastDiffusionA) { this.lastDiffusionA = diffusionA; this.model.setDiffusionA(diffusionA); this.modelOptions = { ...this.modelOptions, diffusionA }; }
    if (diffusionB !== this.lastDiffusionB) { this.lastDiffusionB = diffusionB; this.model.setDiffusionB(diffusionB); this.modelOptions = { ...this.modelOptions, diffusionB }; }
    if (brushStrength !== this.lastBrushStrength) { this.lastBrushStrength = brushStrength; this.model.setBrushStrength(brushStrength); this.modelOptions = { ...this.modelOptions, brushStrength }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastFeedRate = this.modelOptions.feedRate;
    this.lastKillRate = this.modelOptions.killRate;
    this.lastDiffusionA = this.modelOptions.diffusionA;
    this.lastDiffusionB = this.modelOptions.diffusionB;
    this.lastBrushStrength = this.modelOptions.brushStrength;
  }
}
