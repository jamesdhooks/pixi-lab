import {
  FieldPaletteRenderer,
  ParticlePointRenderer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { LIVING_VORONOI_TISSUE_DEFAULTS } from './living-voronoi-tissue.config.js';
import { LivingVoronoiTissueModel, type LivingVoronoiTissueModelOptions } from './LivingVoronoiTissueModel.js';
import { biolumeTissueStyle } from './styles/biolume-tissue.js';
import { coralColonyStyle } from './styles/coral-colony.js';
import { microscopeBloomStyle } from './styles/microscope-bloom.js';

export const livingVoronoiTissueStyleManifest: SimStyleManifest = {
  defaultStyleId: 'biolume-tissue',
  capabilities: {
    renderLayers: ['field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [biolumeTissueStyle, coralColonyStyle, microscopeBloomStyle],
};

export class LivingVoronoiTissueScene extends SimulationScene {
  readonly name: string = 'LivingVoronoiTissue';
  private territoryRenderer: FieldPaletteRenderer | null = null;
  private membraneRenderer: FieldPaletteRenderer | null = null;
  private signalRenderer: FieldPaletteRenderer | null = null;
  private particleRenderer: ParticlePointRenderer | null = null;
  private model: LivingVoronoiTissueModel | null = null;
  private modelOptions: LivingVoronoiTissueModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastCellCount = 0;
  private lastMigrationRate = 0;
  private lastMembraneTension = 0;
  private lastSignalStrength = 0;
  private lastDivisionRate = 0;

  constructor(private readonly previewColumns?: number, private readonly previewCellCount?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.territoryRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.membraneRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.signalRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.particleRenderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.resolution as number));
    const cellCount = this.previewCellCount ?? ((settings.get('cellCount') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.cellCount as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      cellCount,
      migrationRate: (settings.get('migrationRate') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.migrationRate as number),
      membraneTension: (settings.get('membraneTension') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.membraneTension as number),
      signalStrength: (settings.get('signalStrength') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.signalStrength as number),
      divisionRate: (settings.get('divisionRate') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.divisionRate as number),
    };
    this.model = new LivingVoronoiTissueModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(Boolean(settings.get('debug')));
  }

  override onExit(): void {
    this.territoryRenderer?.destroy();
    this.membraneRenderer?.destroy();
    this.signalRenderer?.destroy();
    this.particleRenderer?.destroy();
    this.territoryRenderer = null;
    this.membraneRenderer = null;
    this.signalRenderer = null;
    this.particleRenderer = null;
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
    if (!this.model || !this.territoryRenderer || !this.membraneRenderer || !this.signalRenderer || !this.particleRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? biolumeTissueStyle;
    this.territoryRenderer.clear();
    this.membraneRenderer.clear();
    this.signalRenderer.clear();
    this.particleRenderer.clear();
    this.territoryRenderer.renderField('living-voronoi-territory', this.model.territoryField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.72, gamma: 0.78, zIndex: 0 });
    this.membraneRenderer.renderField('living-voronoi-membranes', this.model.boundaryField, this.ctx_.width, this.ctx_.height, style, { alpha: this.quality === 'enhanced' ? 0.84 : 0.62, gamma: 0.36, zIndex: 1 });
    if (this.quality === 'enhanced') {
      this.signalRenderer.renderField('living-voronoi-signals', this.model.signalField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.48, gamma: 0.54, zIndex: 2 });
    }
    this.particleRenderer.renderParticles(this.model.particles, style, { alpha: 0.88, sizeScale: this.quality === 'enhanced' ? 0.95 : 0.72, zIndex: 3 });
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.cellCount, fieldVariance: stats.boundaryVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new LivingVoronoiTissueModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new LivingVoronoiTissueModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.territoryRenderer?.setQuality(quality);
    this.membraneRenderer?.setQuality(quality);
    this.signalRenderer?.setQuality(quality);
    this.particleRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      field: this.territoryRenderer?.getLayer('living-voronoi-territory'),
      particles: this.particleRenderer?.container,
      glow: this.signalRenderer?.getLayer('living-voronoi-signals'),
      debug: this.membraneRenderer?.getLayer('living-voronoi-membranes'),
    };
  }

  getStyleManifest(): SimStyleManifest { return livingVoronoiTissueStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new LivingVoronoiTissueModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.resolution as number));
    const cellCount = this.previewCellCount ?? ((settings.get('cellCount') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.cellCount as number));
    const migrationRate = (settings.get('migrationRate') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.migrationRate as number);
    const membraneTension = (settings.get('membraneTension') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.membraneTension as number);
    const signalStrength = (settings.get('signalStrength') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.signalStrength as number);
    const divisionRate = (settings.get('divisionRate') as number | undefined) ?? (LIVING_VORONOI_TISSUE_DEFAULTS.divisionRate as number);
    this.ctx_.systems.debug?.setEnabled(Boolean(settings.get('debug')));
    if (columns !== this.lastColumns || cellCount !== this.lastCellCount) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), cellCount, migrationRate, membraneTension, signalStrength, divisionRate, seed: this.modelOptions.seed + 1 };
      this.model = new LivingVoronoiTissueModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (migrationRate !== this.lastMigrationRate) { this.lastMigrationRate = migrationRate; this.model.setMigrationRate(migrationRate); this.modelOptions = { ...this.modelOptions, migrationRate }; }
    if (membraneTension !== this.lastMembraneTension) { this.lastMembraneTension = membraneTension; this.model.setMembraneTension(membraneTension); this.modelOptions = { ...this.modelOptions, membraneTension }; }
    if (signalStrength !== this.lastSignalStrength) { this.lastSignalStrength = signalStrength; this.model.setSignalStrength(signalStrength); this.modelOptions = { ...this.modelOptions, signalStrength }; }
    if (divisionRate !== this.lastDivisionRate) { this.lastDivisionRate = divisionRate; this.model.setDivisionRate(divisionRate); this.modelOptions = { ...this.modelOptions, divisionRate }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastCellCount = this.modelOptions.cellCount;
    this.lastMigrationRate = this.modelOptions.migrationRate;
    this.lastMembraneTension = this.modelOptions.membraneTension;
    this.lastSignalStrength = this.modelOptions.signalStrength;
    this.lastDivisionRate = this.modelOptions.divisionRate;
  }
}
