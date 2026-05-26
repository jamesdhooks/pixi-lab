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
import { PLASMA_BRANCH_DEFAULTS } from './plasma-branch.config.js';
import { PlasmaBranchModel, type PlasmaBranchModelOptions } from './PlasmaBranchModel.js';
import { bloodPlasmaStyle } from './styles/blood-plasma.js';
import { lightningGardenStyle } from './styles/lightning-garden.js';
import { neonCircuitStyle } from './styles/neon-circuit.js';

export const plasmaBranchStyleManifest: SimStyleManifest = {
  defaultStyleId: 'lightning-garden',
  capabilities: {
    renderLayers: ['field', 'trails', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [lightningGardenStyle, neonCircuitStyle, bloodPlasmaStyle],
};

export class PlasmaBranchScene extends SimulationScene {
  readonly name: string = 'PlasmaBranch';
  private layer: SimulationCanvasLayer | null = null;
  private model: PlasmaBranchModel | null = null;
  private modelOptions: PlasmaBranchModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastMaxBranches = 0;
  private lastFieldColumns = 0;
  private lastChargeDecay = 0;
  private lastBranchEnergy = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('fieldColumns') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.fieldColumns as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      maxBranches: this.previewBudget ?? ((settings.get('maxBranches') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.maxBranches as number)),
      chargeDecay: (settings.get('chargeDecay') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.chargeDecay as number),
      branchEnergy: (settings.get('branchEnergy') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.branchEnergy as number),
    };
    this.model = new PlasmaBranchModel(this.modelOptions);
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
    const style = this.ctx_.systems.styleManager?.getStyle() ?? lightningGardenStyle;
    this.layer.clear();
    this.layer.renderField(this.model.chargeField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderField(this.model.scarField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.branchCount, fieldVariance: stats.chargeVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new PlasmaBranchModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new PlasmaBranchModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }


  private applyLiveSettings(): void {
    if (!this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('fieldColumns') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.fieldColumns as number));
    const maxBranches = this.previewBudget ?? ((settings.get('maxBranches') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.maxBranches as number));
    const chargeDecay = (settings.get('chargeDecay') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.chargeDecay as number);
    const branchEnergy = (settings.get('branchEnergy') as number | undefined) ?? (PLASMA_BRANCH_DEFAULTS.branchEnergy as number);

    if (
      columns === this.lastFieldColumns &&
      maxBranches === this.lastMaxBranches &&
      chargeDecay === this.lastChargeDecay &&
      branchEnergy === this.lastBranchEnergy
    ) {
      return;
    }

    this.modelOptions = {
      ...this.modelOptions,
      columns,
      rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))),
      maxBranches,
      chargeDecay,
      branchEnergy,
      seed: this.modelOptions.seed + 1,
    };
    this.model = new PlasmaBranchModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastFieldColumns = this.modelOptions.columns;
    this.lastMaxBranches = this.modelOptions.maxBranches;
    this.lastChargeDecay = this.modelOptions.chargeDecay;
    this.lastBranchEnergy = this.modelOptions.branchEnergy ?? (PLASMA_BRANCH_DEFAULTS.branchEnergy as number);
  }

  getRenderLayers(): SimRenderLayers {
    const layers = this.layer?.getRenderLayers() ?? {};
    return { ...layers, trails: layers.field, glow: layers.particles };
  }

  getStyleManifest(): SimStyleManifest {
    return plasmaBranchStyleManifest;
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
      this.model = new PlasmaBranchModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }
}
