import {
  ArcLineRenderer,
  FieldPaletteRenderer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { ALIEN_VASCULAR_TREE_DEFAULTS } from './alien-vascular-tree.config.js';
import { AlienVascularTreeModel, type AlienVascularTreeModelOptions } from './AlienVascularTreeModel.js';
import { coralVeinsStyle } from './styles/coral-veins.js';
import { goldArborStyle } from './styles/gold-arbor.js';
import { neonRootsStyle } from './styles/neon-roots.js';

export const alienVascularTreeStyleManifest: SimStyleManifest = {
  defaultStyleId: 'neon-roots',
  capabilities: {
    renderLayers: ['field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [neonRootsStyle, coralVeinsStyle, goldArborStyle],
};

export class AlienVascularTreeScene extends SimulationScene {
  readonly name: string = 'AlienVascularTree';
  private nutrientRenderer: FieldPaletteRenderer | null = null;
  private pulseRenderer: FieldPaletteRenderer | null = null;
  private arcRenderer: ArcLineRenderer | null = null;
  private model: AlienVascularTreeModel | null = null;
  private modelOptions: AlienVascularTreeModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastBranchBudget = 0;
  private lastGrowthRate = 0;
  private lastNutrientFlow = 0;
  private lastPruneRate = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBranchBudget?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.nutrientRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.pulseRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.arcRenderer = new ArcLineRenderer(ctx.systems.pixi.app);
    this.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.resolution as number));
    const branchBudget = this.previewBranchBudget ?? ((settings.get('branchBudget') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.branchBudget as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      branchBudget,
      growthRate: (settings.get('growthRate') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.growthRate as number),
      nutrientFlow: (settings.get('nutrientFlow') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.nutrientFlow as number),
      pruneRate: (settings.get('pruneRate') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.pruneRate as number),
    };
    this.model = new AlienVascularTreeModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.nutrientRenderer?.destroy();
    this.pulseRenderer?.destroy();
    this.arcRenderer?.destroy();
    this.nutrientRenderer = null;
    this.pulseRenderer = null;
    this.arcRenderer = null;
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
    if (!this.model || !this.nutrientRenderer || !this.pulseRenderer || !this.arcRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? neonRootsStyle;
    this.nutrientRenderer.clear();
    this.pulseRenderer.clear();
    this.arcRenderer.clear();
    this.nutrientRenderer.renderField('alien-vascular-nutrient', this.model.nutrientField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.42, gamma: 0.74, zIndex: 0 });
    this.arcRenderer.renderParticleArcs(this.model.particles, style, { alpha: this.quality === 'enhanced' ? 0.92 : 0.74, velocityScale: 1, zIndex: 1 });
    if (this.quality === 'enhanced') this.pulseRenderer.renderField('alien-vascular-pulse', this.model.pulseField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.46, gamma: 0.48, zIndex: 2 });
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.branchCount, fieldVariance: stats.nutrientVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new AlienVascularTreeModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new AlienVascularTreeModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.nutrientRenderer?.setQuality(quality);
    this.pulseRenderer?.setQuality(quality);
    this.arcRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      field: this.nutrientRenderer?.getLayer('alien-vascular-nutrient'),
      particles: this.arcRenderer?.layer,
      glow: this.pulseRenderer?.getLayer('alien-vascular-pulse'),
    };
  }

  getStyleManifest(): SimStyleManifest { return alienVascularTreeStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new AlienVascularTreeModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.resolution as number));
    const branchBudget = this.previewBranchBudget ?? ((settings.get('branchBudget') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.branchBudget as number));
    const growthRate = (settings.get('growthRate') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.growthRate as number);
    const nutrientFlow = (settings.get('nutrientFlow') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.nutrientFlow as number);
    const pruneRate = (settings.get('pruneRate') as number | undefined) ?? (ALIEN_VASCULAR_TREE_DEFAULTS.pruneRate as number);
    if (columns !== this.lastColumns || branchBudget !== this.lastBranchBudget) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), branchBudget, growthRate, nutrientFlow, pruneRate, seed: this.modelOptions.seed + 1 };
      this.model = new AlienVascularTreeModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (growthRate !== this.lastGrowthRate) { this.lastGrowthRate = growthRate; this.model.setGrowthRate(growthRate); this.modelOptions = { ...this.modelOptions, growthRate }; }
    if (nutrientFlow !== this.lastNutrientFlow) { this.lastNutrientFlow = nutrientFlow; this.model.setNutrientFlow(nutrientFlow); this.modelOptions = { ...this.modelOptions, nutrientFlow }; }
    if (pruneRate !== this.lastPruneRate) { this.lastPruneRate = pruneRate; this.model.setPruneRate(pruneRate); this.modelOptions = { ...this.modelOptions, pruneRate }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastBranchBudget = this.modelOptions.branchBudget;
    this.lastGrowthRate = this.modelOptions.growthRate;
    this.lastNutrientFlow = this.modelOptions.nutrientFlow;
    this.lastPruneRate = this.modelOptions.pruneRate;
  }
}
