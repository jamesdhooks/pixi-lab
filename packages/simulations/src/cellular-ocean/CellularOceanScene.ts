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
import { CELLULAR_OCEAN_DEFAULTS } from './cellular-ocean.config.js';
import { CellularOceanModel, type CellularOceanModelOptions } from './CellularOceanModel.js';
import { abyssalNucleiStyle } from './styles/abyssal-nuclei.js';
import { coralMitosisStyle } from './styles/coral-mitosis.js';
import { lagoonCellsStyle } from './styles/lagoon-cells.js';

export const cellularOceanStyleManifest: SimStyleManifest = {
  defaultStyleId: 'lagoon-cells',
  capabilities: {
    renderLayers: ['field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [lagoonCellsStyle, coralMitosisStyle, abyssalNucleiStyle],
};

export class CellularOceanScene extends SimulationScene {
  readonly name = 'CellularOcean';
  private layer: SimulationCanvasLayer | null = null;
  private model: CellularOceanModel | null = null;
  private modelOptions: CellularOceanModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastResolution = 0;
  private lastCellCount = 0;
  private lastMembranePoints = 0;
  private lastMembraneTension = 0;
  private lastViscosity = 0;
  private lastPulseStrength = 0;
  private lastDriftStrength = 0;

  constructor(private readonly previewResolution?: number, private readonly previewCells?: number, private readonly previewMembranePoints?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const resolution = this.previewResolution ?? ((settings.get('resolution') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.resolution as number));
    const cellCount = this.previewCells ?? ((settings.get('cellCount') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.cellCount as number));
    const membranePoints = this.previewMembranePoints ?? ((settings.get('membranePoints') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.membranePoints as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns: resolution,
      rows: Math.max(12, Math.round(resolution * ctx.height / Math.max(1, ctx.width))),
      cellCount,
      membranePoints,
      membraneTension: (settings.get('membraneTension') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.membraneTension as number),
      viscosity: (settings.get('viscosity') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.viscosity as number),
      pulseStrength: (settings.get('pulseStrength') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.pulseStrength as number),
      driftStrength: (settings.get('driftStrength') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.driftStrength as number),
    };
    this.model = new CellularOceanModel(this.modelOptions);
    this.lastResolution = resolution;
    this.lastCellCount = cellCount;
    this.lastMembranePoints = membranePoints;
    this.lastMembraneTension = this.modelOptions.membraneTension;
    this.lastViscosity = this.modelOptions.viscosity;
    this.lastPulseStrength = this.modelOptions.pulseStrength;
    this.lastDriftStrength = this.modelOptions.driftStrength;
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
    this.pollSettings();
    for (const gesture of this.consumeGestures()) this.model.handleGesture(gesture);
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.layer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? lagoonCellsStyle;
    this.layer.clear();
    this.layer.renderField(this.model.densityField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const debug = this.ctx_.systems.debug;
    if (debug?.isEnabled()) {
      const stats = this.model.stats();
      debug.update({ fps: 0, quality: this.quality, particleCount: stats.nodeCount, fieldVariance: stats.fieldVariance });
    }
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new CellularOceanModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new CellularOceanModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers { return this.layer?.getRenderLayers() ?? {}; }
  getStyleManifest(): SimStyleManifest { return cellularOceanStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }
  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new CellularOceanModel(this.modelOptions);
      return;
    }
    this.reset();
  }

  private pollSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const membraneTension = (settings.get('membraneTension') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.membraneTension as number);
    if (membraneTension !== this.lastMembraneTension) { this.lastMembraneTension = membraneTension; this.model.setMembraneTension(membraneTension); this.modelOptions = { ...this.modelOptions, membraneTension }; }
    const viscosity = (settings.get('viscosity') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.viscosity as number);
    if (viscosity !== this.lastViscosity) { this.lastViscosity = viscosity; this.model.setViscosity(viscosity); this.modelOptions = { ...this.modelOptions, viscosity }; }
    const pulseStrength = (settings.get('pulseStrength') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.pulseStrength as number);
    if (pulseStrength !== this.lastPulseStrength) { this.lastPulseStrength = pulseStrength; this.model.setPulseStrength(pulseStrength); this.modelOptions = { ...this.modelOptions, pulseStrength }; }
    const driftStrength = (settings.get('driftStrength') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.driftStrength as number);
    if (driftStrength !== this.lastDriftStrength) { this.lastDriftStrength = driftStrength; this.model.setDriftStrength(driftStrength); this.modelOptions = { ...this.modelOptions, driftStrength }; }
    const resolution = this.previewResolution ?? ((settings.get('resolution') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.resolution as number));
    const cellCount = this.previewCells ?? ((settings.get('cellCount') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.cellCount as number));
    const membranePoints = this.previewMembranePoints ?? ((settings.get('membranePoints') as number | undefined) ?? (CELLULAR_OCEAN_DEFAULTS.membranePoints as number));
    if (resolution !== this.lastResolution || cellCount !== this.lastCellCount || membranePoints !== this.lastMembranePoints) {
      this.lastResolution = resolution;
      this.lastCellCount = cellCount;
      this.lastMembranePoints = membranePoints;
      this.modelOptions = { ...this.modelOptions, columns: resolution, rows: Math.max(12, Math.round(resolution * this.ctx_.height / Math.max(1, this.ctx_.width))), cellCount, membranePoints, seed: this.modelOptions.seed + 1 };
      this.model = new CellularOceanModel(this.modelOptions);
    }
  }
}
