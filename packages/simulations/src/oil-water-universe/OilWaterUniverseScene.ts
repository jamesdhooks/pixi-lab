import {
  DensityMetaballRenderer,
  FieldPaletteRenderer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { OIL_WATER_UNIVERSE_DEFAULTS } from './oil-water-universe.config.js';
import { OilWaterUniverseModel, type OilWaterUniverseModelOptions } from './OilWaterUniverseModel.js';
import { bioFoamStyle } from './styles/bio-foam.js';
import { cosmicCellsStyle } from './styles/cosmic-cells.js';
import { oilSlickStyle } from './styles/oil-slick.js';

export const oilWaterUniverseStyleManifest: SimStyleManifest = {
  defaultStyleId: 'oil-slick',
  capabilities: {
    renderLayers: ['density', 'field', 'glow', 'debug'],
    passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [oilSlickStyle, bioFoamStyle, cosmicCellsStyle],
};

export class OilWaterUniverseScene extends SimulationScene {
  readonly name: string = 'OilWaterUniverse';
  private densityRenderer: DensityMetaballRenderer | null = null;
  private edgeRenderer: FieldPaletteRenderer | null = null;
  private model: OilWaterUniverseModel | null = null;
  private modelOptions: OilWaterUniverseModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastSeparationRate = 0;
  private lastBoundaryTension = 0;
  private lastViscosity = 0;
  private lastStirStrength = 0;

  constructor(private readonly previewColumns?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.densityRenderer = new DensityMetaballRenderer(ctx.systems.pixi.app);
    this.edgeRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.densityRenderer.setQuality(ctx.quality);
    this.edgeRenderer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      separationRate: (settings.get('separationRate') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.separationRate as number),
      boundaryTension: (settings.get('boundaryTension') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.boundaryTension as number),
      viscosity: (settings.get('viscosity') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.viscosity as number),
      stirStrength: (settings.get('stirStrength') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.stirStrength as number),
    };
    this.model = new OilWaterUniverseModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.densityRenderer?.destroy();
    this.edgeRenderer?.destroy();
    this.densityRenderer = null;
    this.edgeRenderer = null;
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
    if (!this.model || !this.densityRenderer || !this.edgeRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? oilSlickStyle;
    this.densityRenderer.clear();
    this.edgeRenderer.clear();
    this.densityRenderer.renderDensity(this.model.densityField, this.ctx_.width, this.ctx_.height, style, {
      alpha: this.quality === 'enhanced' ? 0.98 : 0.92,
      threshold: typeof style.uniforms.threshold === 'number' ? style.uniforms.threshold : 0.46,
      softness: this.quality === 'enhanced' ? 0.24 : 0.17,
      zIndex: 0,
    });
    if (this.quality === 'enhanced') {
      this.edgeRenderer.renderField('oil-water-edges', this.model.edgeField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.42, gamma: 0.5, zIndex: 1 });
    }
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.columns * stats.rows, fieldVariance: stats.fieldVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new OilWaterUniverseModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new OilWaterUniverseModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.densityRenderer?.setQuality(quality);
    this.edgeRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return { density: this.densityRenderer?.layer, field: this.edgeRenderer?.getLayer('oil-water-edges'), glow: this.densityRenderer?.layer };
  }

  getStyleManifest(): SimStyleManifest { return oilWaterUniverseStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new OilWaterUniverseModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.resolution as number));
    const separationRate = (settings.get('separationRate') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.separationRate as number);
    const boundaryTension = (settings.get('boundaryTension') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.boundaryTension as number);
    const viscosity = (settings.get('viscosity') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.viscosity as number);
    const stirStrength = (settings.get('stirStrength') as number | undefined) ?? (OIL_WATER_UNIVERSE_DEFAULTS.stirStrength as number);
    if (columns !== this.lastColumns) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), separationRate, boundaryTension, viscosity, stirStrength, seed: this.modelOptions.seed + 1 };
      this.model = new OilWaterUniverseModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (separationRate !== this.lastSeparationRate) { this.lastSeparationRate = separationRate; this.model.setSeparationRate(separationRate); this.modelOptions = { ...this.modelOptions, separationRate }; }
    if (boundaryTension !== this.lastBoundaryTension) { this.lastBoundaryTension = boundaryTension; this.model.setBoundaryTension(boundaryTension); this.modelOptions = { ...this.modelOptions, boundaryTension }; }
    if (viscosity !== this.lastViscosity) { this.lastViscosity = viscosity; this.model.setViscosity(viscosity); this.modelOptions = { ...this.modelOptions, viscosity }; }
    if (stirStrength !== this.lastStirStrength) { this.lastStirStrength = stirStrength; this.model.setStirStrength(stirStrength); this.modelOptions = { ...this.modelOptions, stirStrength }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastSeparationRate = this.modelOptions.separationRate;
    this.lastBoundaryTension = this.modelOptions.boundaryTension;
    this.lastViscosity = this.modelOptions.viscosity;
    this.lastStirStrength = this.modelOptions.stirStrength;
  }
}
