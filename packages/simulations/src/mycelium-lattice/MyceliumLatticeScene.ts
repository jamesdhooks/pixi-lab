import {
  MeshLatticeRenderer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { MYCELIUM_LATTICE_DEFAULTS, MYCELIUM_LATTICE_SETTINGS_FIELDS } from './mycelium-lattice.config.js';
import { MyceliumLatticeModel, type MyceliumLatticeModelOptions } from './MyceliumLatticeModel.js';
import { arcticLichenStyle } from './styles/arctic-lichen.js';
import { earthOvergrowthStyle } from './styles/earth-overgrowth.js';
import { volcanicSporeStyle } from './styles/volcanic-spore.js';

export const myceliumLatticeStyleManifest: SimStyleManifest = {
  defaultStyleId: 'earth-overgrowth',
  capabilities: {
    renderLayers: ['primitive', 'glow', 'debug'],
    passes: ['primitive', 'paletteMap', 'contourBands', 'edgeGlow', 'bloom'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [earthOvergrowthStyle, arcticLichenStyle, volcanicSporeStyle],
};

export class MyceliumLatticeScene extends SimulationScene {
  readonly name: string = 'MyceliumLattice';
  private latticeRenderer: MeshLatticeRenderer | null = null;
  private model: MyceliumLatticeModel | null = null;
  private modelOptions: MyceliumLatticeModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private resetOnHoldArmed = true;

  /** Cached settings values for live-change detection each tick. */
  private lastGrowthProbability = 0;
  private lastBranchChance = 0;
  private lastGenerationHueStep = 0;
  private lastGridColumns = 0;

  constructor(private readonly previewColumns?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.latticeRenderer = new MeshLatticeRenderer(ctx.systems.pixi.app);
    this.latticeRenderer.setQuality(ctx.quality);

    const settings = ctx.systems.settings;
    const columns = this.previewColumns
      ?? ((settings.get('resolution') as number | undefined) ?? (MYCELIUM_LATTICE_DEFAULTS.resolution as number));

    this.modelOptions = this.buildOptions(ctx, columns);
    this.model = new MyceliumLatticeModel(this.modelOptions);
    this.lastGrowthProbability = this.modelOptions.growthProbability;
    this.lastBranchChance      = this.modelOptions.branchChance;
    this.lastGenerationHueStep = this.modelOptions.generationHueStep;
    this.lastGridColumns       = columns;

    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.latticeRenderer?.destroy();
    this.latticeRenderer = null;
    this.model = null;
    this.modelOptions = null;
  }

  override update(dt: number): void {
    if (!this.model || !this.modelOptions) return;

    // Poll every live-editable setting so slider changes take effect immediately.
    const settings = this.ctx_.systems.settings;

    const newGrowthProb = (settings.get('growthProbability') as number | undefined)
      ?? (MYCELIUM_LATTICE_DEFAULTS.growthProbability as number);
    if (newGrowthProb !== this.lastGrowthProbability) {
      this.lastGrowthProbability = newGrowthProb;
      this.model.setGrowthProbability(newGrowthProb);
      this.modelOptions = { ...this.modelOptions, growthProbability: newGrowthProb };
    }

    const newBranch = (settings.get('branchChance') as number | undefined)
      ?? (MYCELIUM_LATTICE_DEFAULTS.branchChance as number);
    if (newBranch !== this.lastBranchChance) {
      this.lastBranchChance = newBranch;
      this.model.setBranchChance(newBranch);
      this.modelOptions = { ...this.modelOptions, branchChance: newBranch };
    }

    const newGenStep = (settings.get('generationHueStep') as number | undefined)
      ?? (MYCELIUM_LATTICE_DEFAULTS.generationHueStep as number);
    if (newGenStep !== this.lastGenerationHueStep) {
      this.lastGenerationHueStep = newGenStep;
      this.model.setGenerationHueStep(newGenStep);
      this.modelOptions = { ...this.modelOptions, generationHueStep: newGenStep };
    }

    // Resolution change requires a full model rebuild.
    const newColumns = this.previewColumns
      ?? ((settings.get('resolution') as number | undefined) ?? (MYCELIUM_LATTICE_DEFAULTS.resolution as number));
    if (newColumns !== this.lastGridColumns) {
      this.lastGridColumns = newColumns;
      this.modelOptions = {
        ...this.modelOptions,
        columns: newColumns,
        rows: Math.max(12, Math.round(newColumns * this.ctx_.height / Math.max(1, this.ctx_.width))),
        growthProbability: newGrowthProb,
        branchChance: newBranch,
        generationHueStep: newGenStep,
        seed: this.modelOptions.seed + 1,
      };
      this.model = new MyceliumLatticeModel(this.modelOptions);
    }

    for (const gesture of this.consumeGestures()) {
      if (gesture.kind === 'hold' && this.resetOnHoldArmed) {
        this.resetOnHoldArmed = false;
        this.reset();
        continue;
      }
      this.model.handleGesture(gesture);
    }
    if (this.input_.snapshot.pointers.size === 0) this.resetOnHoldArmed = true;

    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.latticeRenderer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? earthOvergrowthStyle;
    this.latticeRenderer.clear();
    this.latticeRenderer.renderGrid(this.model.grid, this.ctx_.width, this.ctx_.height, style, { zIndex: 0 });
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.livingCells,
      fieldVariance: stats.tipCount / Math.max(1, stats.livingCells),
    });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = {
      ...this.modelOptions,
      width,
      height,
      rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))),
      seed: this.modelOptions.seed + Math.floor(width + height),
    };
    this.model = new MyceliumLatticeModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new MyceliumLatticeModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.latticeRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      primitive: this.latticeRenderer?.layer,
      glow:      this.latticeRenderer?.layer,
    };
  }

  getStyleManifest(): SimStyleManifest {
    return myceliumLatticeStyleManifest;
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
      this.model = new MyceliumLatticeModel(this.modelOptions);
      return;
    }
    this.reset();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildOptions(ctx: GameContext, columns: number): MyceliumLatticeModelOptions {
    const settings = ctx.systems.settings;
    const rows = Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width)));
    return {
      seed:               ctx.seed,
      width:              ctx.width,
      height:             ctx.height,
      columns,
      rows,
      strainCount:        MYCELIUM_LATTICE_DEFAULTS.strainCount        as number,
      initialSpores:      MYCELIUM_LATTICE_DEFAULTS.initialSpores      as number,
      maxTips:            MYCELIUM_LATTICE_DEFAULTS.maxTips             as number,
      growthProbability: (settings.get('growthProbability') as number | undefined) ?? (MYCELIUM_LATTICE_DEFAULTS.growthProbability as number),
      branchChance:      (settings.get('branchChance')      as number | undefined) ?? (MYCELIUM_LATTICE_DEFAULTS.branchChance      as number),
      generationHueStep: (settings.get('generationHueStep') as number | undefined) ?? (MYCELIUM_LATTICE_DEFAULTS.generationHueStep as number),
      forwardBias:        MYCELIUM_LATTICE_DEFAULTS.forwardBias        as number,
      sideBias:           MYCELIUM_LATTICE_DEFAULTS.sideBias           as number,
    };
  }

  /** Expose settings fields for settings introspection. */
  static readonly settingsFields = MYCELIUM_LATTICE_SETTINGS_FIELDS;
}
