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
import { MYCELIUM_PRISM_DEFAULTS } from './mycelium-prism.config.js';
import { MyceliumPrismModel, type MyceliumPrismModelOptions } from './MyceliumPrismModel.js';
import { neonMoldStyle } from './styles/neon-mold.js';
import { rotBloomStyle } from './styles/rot-bloom.js';
import { synapticFungusStyle } from './styles/synaptic-fungus.js';

export const myceliumPrismStyleManifest: SimStyleManifest = {
  defaultStyleId: 'neon-mold',
  capabilities: {
    renderLayers: ['primitive', 'field', 'glow', 'debug'],
    passes: ['primitive', 'paletteMap', 'contourBands', 'edgeGlow', 'trailFeedback', 'bloom'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [neonMoldStyle, rotBloomStyle, synapticFungusStyle],
};

export class MyceliumPrismScene extends SimulationScene {
  readonly name: string = 'MyceliumPrism';
  private fieldRenderer: FieldPaletteRenderer | null = null;
  private model: MyceliumPrismModel | null = null;
  private modelOptions: MyceliumPrismModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private resetOnHoldArmed = true;
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastGrowthRate = 0;
  private lastNutrientDiffusion = 0;
  private lastGridColumns = 0;

  constructor(private readonly previewColumns?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.fieldRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.fieldRenderer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      strainCount: MYCELIUM_PRISM_DEFAULTS.strainCount as number,
      initialColonies: MYCELIUM_PRISM_DEFAULTS.initialColonies as number,
      growthRate: (settings.get('growthRate') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.growthRate as number),
      nutrientDiffusion: (settings.get('nutrientDiffusion') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.nutrientDiffusion as number),
    };
    this.model = new MyceliumPrismModel(this.modelOptions);
    this.lastGrowthRate = this.modelOptions.growthRate;
    this.lastNutrientDiffusion = this.modelOptions.nutrientDiffusion;
    this.lastGridColumns = this.modelOptions.columns;
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

    // Poll every live-editable setting so slider changes take effect immediately
    // without restarting the simulation (mirrors HarmonicSandScene pattern).
    const settings = this.ctx_.systems.settings;

    const newGrowthRate = (settings.get('growthRate') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.growthRate as number);
    if (newGrowthRate !== this.lastGrowthRate) {
      this.lastGrowthRate = newGrowthRate;
      this.model.setGrowthRate(newGrowthRate);
      this.modelOptions = { ...this.modelOptions, growthRate: newGrowthRate };
    }

    const newNutrientDiffusion = (settings.get('nutrientDiffusion') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.nutrientDiffusion as number);
    if (newNutrientDiffusion !== this.lastNutrientDiffusion) {
      this.lastNutrientDiffusion = newNutrientDiffusion;
      this.model.setNutrientDiffusion(newNutrientDiffusion);
      this.modelOptions = { ...this.modelOptions, nutrientDiffusion: newNutrientDiffusion };
    }

    // Grid dimensions require a full model rebuild.
    const newGridColumns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.resolution as number));
    if (newGridColumns !== this.lastGridColumns) {
      this.lastGridColumns = newGridColumns;
      this.modelOptions = {
        ...this.modelOptions,
        columns: newGridColumns,
        rows: Math.max(12, Math.round(newGridColumns * this.ctx_.height / Math.max(1, this.ctx_.width))),
        growthRate: newGrowthRate,
        nutrientDiffusion: newNutrientDiffusion,
        seed: this.modelOptions.seed + 1,
      };
      this.model = new MyceliumPrismModel(this.modelOptions);
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
    if (!this.fieldRenderer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? neonMoldStyle;
    this.fieldRenderer.clear();
    // Primary pass — square-grid cells coloured by strain band.
    this.fieldRenderer.renderField('cells', this.model.field, this.ctx_.width, this.ctx_.height, style, { alpha: 1.0, gamma: 0.48, maxAlpha: 230, zIndex: 0 });
    if (this.quality === 'enhanced') {
      // Soft glow pass: wider blend, lower alpha, slightly different gamma.
      this.fieldRenderer.renderField('glow', this.model.field, this.ctx_.width, this.ctx_.height, style, { alpha: 0.22, gamma: 0.32, maxAlpha: 90, zIndex: 1 });
    }
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.activeCells,
      fieldVariance: stats.meanEnergy,
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
    this.model = new MyceliumPrismModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + Math.round(this.model?.stats().veinPulse ?? 0) + 1 };
    this.model = new MyceliumPrismModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.fieldRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      primitive: this.fieldRenderer?.getLayer('cells'),
      field: this.fieldRenderer?.getLayer('cells'),
      glow: this.fieldRenderer?.getLayer('glow'),
    };
  }

  getStyleManifest(): SimStyleManifest {
    return myceliumPrismStyleManifest;
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
      this.model = new MyceliumPrismModel(this.modelOptions);
      return;
    }
    this.reset();
  }
}
