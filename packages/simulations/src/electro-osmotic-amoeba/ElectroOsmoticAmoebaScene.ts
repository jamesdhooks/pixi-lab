import {
  PixiSemanticRenderPipeline,
  SimulationScene,
  createFieldPaletteLayer,
  createParticlePointLayer,
  createRenderFrame,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { ELECTRO_OSMOTIC_AMOEBA_DEFAULTS } from './electro-osmotic-amoeba.config.js';
import { ElectroOsmoticAmoebaModel, type ElectroOsmoticAmoebaModelOptions } from './ElectroOsmoticAmoebaModel.js';
import { ionBloomStyle } from './styles/ion-bloom.js';
import { membraneNoirStyle } from './styles/membrane-noir.js';
import { voltageLagoonStyle } from './styles/voltage-lagoon.js';

export const electroOsmoticAmoebaStyleManifest: SimStyleManifest = {
  defaultStyleId: 'ion-bloom',
  capabilities: {
    renderLayers: ['particles', 'density', 'glow', 'debug'],
    passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'normalLighting', 'distortion', 'bloom', 'contourBands'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [ionBloomStyle, voltageLagoonStyle, membraneNoirStyle],
};

export class ElectroOsmoticAmoebaScene extends SimulationScene {
  readonly name: string = 'ElectroOsmoticAmoeba';
  private pipeline: PixiSemanticRenderPipeline | null = null;
  private model: ElectroOsmoticAmoebaModel | null = null;
  private modelOptions: ElectroOsmoticAmoebaModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastVoltage = 0;
  private lastOsmoticPressure = 0;
  private lastMembraneElasticity = 0;
  private lastIonDiffusion = 0;
  private lastCellCount = 0;
  private lastParticleBudget = 0;
  private lastResolution = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.pipeline = new PixiSemanticRenderPipeline({ app: ctx.systems.pixi.app, quality: ctx.quality });
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.resolution as number));
    const particleBudget = this.previewBudget ?? ((settings.get('particleBudget') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.particleBudget as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      cellCount: (settings.get('cellCount') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.cellCount as number),
      particleBudget,
      voltage: (settings.get('voltage') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.voltage as number),
      osmoticPressure: (settings.get('osmoticPressure') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.osmoticPressure as number),
      membraneElasticity: (settings.get('membraneElasticity') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.membraneElasticity as number),
      ionDiffusion: (settings.get('ionDiffusion') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.ionDiffusion as number),
      fieldRadius: ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.fieldRadius as number,
    };
    this.model = new ElectroOsmoticAmoebaModel(this.modelOptions);
    this.lastVoltage = this.modelOptions.voltage;
    this.lastOsmoticPressure = this.modelOptions.osmoticPressure;
    this.lastMembraneElasticity = this.modelOptions.membraneElasticity;
    this.lastIonDiffusion = this.modelOptions.ionDiffusion;
    this.lastCellCount = this.modelOptions.cellCount;
    this.lastParticleBudget = this.modelOptions.particleBudget;
    this.lastResolution = this.modelOptions.columns;
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.pipeline?.destroy();
    this.pipeline = null;
    this.model = null;
    this.modelOptions = null;
  }

  override update(dt: number): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const voltage = (settings.get('voltage') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.voltage as number);
    if (voltage !== this.lastVoltage) { this.lastVoltage = voltage; this.model.setVoltage(voltage); this.modelOptions = { ...this.modelOptions, voltage }; }
    const osmoticPressure = (settings.get('osmoticPressure') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.osmoticPressure as number);
    if (osmoticPressure !== this.lastOsmoticPressure) { this.lastOsmoticPressure = osmoticPressure; this.model.setOsmoticPressure(osmoticPressure); this.modelOptions = { ...this.modelOptions, osmoticPressure }; }
    const membraneElasticity = (settings.get('membraneElasticity') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.membraneElasticity as number);
    if (membraneElasticity !== this.lastMembraneElasticity) { this.lastMembraneElasticity = membraneElasticity; this.model.setMembraneElasticity(membraneElasticity); this.modelOptions = { ...this.modelOptions, membraneElasticity }; }
    const ionDiffusion = (settings.get('ionDiffusion') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.ionDiffusion as number);
    if (ionDiffusion !== this.lastIonDiffusion) { this.lastIonDiffusion = ionDiffusion; this.model.setIonDiffusion(ionDiffusion); this.modelOptions = { ...this.modelOptions, ionDiffusion }; }

    const cellCount = (settings.get('cellCount') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.cellCount as number);
    const particleBudget = this.previewBudget ?? ((settings.get('particleBudget') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.particleBudget as number));
    const resolution = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (ELECTRO_OSMOTIC_AMOEBA_DEFAULTS.resolution as number));
    if (cellCount !== this.lastCellCount || particleBudget !== this.lastParticleBudget || resolution !== this.lastResolution) {
      this.lastCellCount = cellCount;
      this.lastParticleBudget = particleBudget;
      this.lastResolution = resolution;
      this.modelOptions = {
        ...this.modelOptions,
        cellCount,
        particleBudget,
        columns: resolution,
        rows: Math.max(12, Math.round(resolution * this.ctx_.height / Math.max(1, this.ctx_.width))),
        seed: this.modelOptions.seed + 1,
      };
      this.model = new ElectroOsmoticAmoebaModel(this.modelOptions);
    }

    for (const gesture of this.consumeGestures()) this.model.handleGesture(gesture);
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.pipeline || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? ionBloomStyle;
    this.pipeline.render(createRenderFrame({
      width: this.ctx_.width,
      height: this.ctx_.height,
      style,
      layers: [
        createFieldPaletteLayer({ id: 'density', field: this.model.densityField, alpha: 0.9, gamma: 0.55, zIndex: 0 }),
        createParticlePointLayer({ id: 'ions', particles: this.model.renderParticles(), zIndex: 1 }),
      ],
    }));
    const debug = this.ctx_.systems.debug;
    if (debug?.isEnabled()) {
      const stats = this.model.stats();
      debug.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.fieldVariance });
    }
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new ElectroOsmoticAmoebaModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new ElectroOsmoticAmoebaModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.pipeline?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers { return {}; }
  getStyleManifest(): SimStyleManifest { return electroOsmoticAmoebaStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }
  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new ElectroOsmoticAmoebaModel(this.modelOptions);
      return;
    }
    this.reset();
  }
}
