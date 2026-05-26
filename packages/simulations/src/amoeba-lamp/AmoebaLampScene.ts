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
import { AMOEBA_LAMP_DEFAULTS } from './amoeba-lamp.config.js';
import { AmoebaLampModel, type AmoebaLampModelOptions } from './AmoebaLampModel.js';
import { bioPlasmaStyle } from './styles/bio-plasma.js';
import { oilSlickStyle } from './styles/oil-slick.js';
import { toxicLagoonStyle } from './styles/toxic-lagoon.js';

export const amoebaLampStyleManifest: SimStyleManifest = {
  defaultStyleId: 'bio-plasma',
  capabilities: {
    renderLayers: ['particles', 'density', 'glow', 'debug'],
    passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'normalLighting', 'distortion', 'bloom', 'contourBands'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [bioPlasmaStyle, oilSlickStyle, toxicLagoonStyle],
};

export class AmoebaLampScene extends SimulationScene {
  readonly name: string = 'AmoebaLamp';
  private layer: SimulationCanvasLayer | null = null;
  private model: AmoebaLampModel | null = null;
  private modelOptions: AmoebaLampModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastSurfaceTension = 0;
  private lastBuoyancy = 0;
  private lastDensityRadius = 0;
  private lastBlobCount = 0;
  private lastParticleBudget = 0;
  private lastGridColumns = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('gridColumns') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.gridColumns as number));
    const particleBudget = this.previewBudget ?? ((settings.get('particleBudget') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.particleBudget as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      blobCount: (settings.get('blobCount') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.blobCount as number),
      particleBudget,
      densityRadius: (settings.get('densityRadius') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.densityRadius as number),
      heatDiffusion: AMOEBA_LAMP_DEFAULTS.heatDiffusion as number,
      surfaceTension: (settings.get('surfaceTension') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.surfaceTension as number),
      buoyancy: (settings.get('buoyancy') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.buoyancy as number),
    };
    this.model = new AmoebaLampModel(this.modelOptions);
    this.lastSurfaceTension = this.modelOptions.surfaceTension;
    this.lastBuoyancy = this.modelOptions.buoyancy;
    this.lastDensityRadius = this.modelOptions.densityRadius;
    this.lastBlobCount = this.modelOptions.blobCount;
    this.lastParticleBudget = this.modelOptions.particleBudget;
    this.lastGridColumns = this.modelOptions.columns;
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

    // Poll every live-editable setting so slider changes take effect immediately
    // without restarting the simulation (mirrors HarmonicSandScene pattern).
    const settings = this.ctx_.systems.settings;

    const newSurfaceTension = (settings.get('surfaceTension') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.surfaceTension as number);
    if (newSurfaceTension !== this.lastSurfaceTension) {
      this.lastSurfaceTension = newSurfaceTension;
      this.model.setSurfaceTension(newSurfaceTension);
      this.modelOptions = { ...this.modelOptions, surfaceTension: newSurfaceTension };
    }

    const newBuoyancy = (settings.get('buoyancy') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.buoyancy as number);
    if (newBuoyancy !== this.lastBuoyancy) {
      this.lastBuoyancy = newBuoyancy;
      this.model.setBuoyancy(newBuoyancy);
      this.modelOptions = { ...this.modelOptions, buoyancy: newBuoyancy };
    }

    const newDensityRadius = (settings.get('densityRadius') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.densityRadius as number);
    if (newDensityRadius !== this.lastDensityRadius) {
      this.lastDensityRadius = newDensityRadius;
      this.model.setDensityRadius(newDensityRadius);
      this.modelOptions = { ...this.modelOptions, densityRadius: newDensityRadius };
    }

    // Structural params (grid size, blob count, budget) require a full model rebuild.
    const newBlobCount = (settings.get('blobCount') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.blobCount as number);
    const newParticleBudget = (settings.get('particleBudget') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.particleBudget as number);
    const newGridColumns = (settings.get('gridColumns') as number | undefined) ?? (AMOEBA_LAMP_DEFAULTS.gridColumns as number);
    if (newBlobCount !== this.lastBlobCount || newParticleBudget !== this.lastParticleBudget || newGridColumns !== this.lastGridColumns) {
      this.lastBlobCount = newBlobCount;
      this.lastParticleBudget = newParticleBudget;
      this.lastGridColumns = newGridColumns;
      this.modelOptions = {
        ...this.modelOptions,
        blobCount: newBlobCount,
        particleBudget: newParticleBudget,
        columns: newGridColumns,
        rows: Math.max(12, Math.round(newGridColumns * this.ctx_.height / Math.max(1, this.ctx_.width))),
        surfaceTension: newSurfaceTension,
        buoyancy: newBuoyancy,
        densityRadius: newDensityRadius,
        seed: this.modelOptions.seed + 1,
      };
      this.model = new AmoebaLampModel(this.modelOptions);
    }

    for (const gesture of this.consumeGestures()) this.model.handleGesture(gesture);
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.layer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? bioPlasmaStyle;
    this.layer.clear();
    this.layer.renderField(this.model.densityField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.fieldVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new AmoebaLampModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new AmoebaLampModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return this.layer?.getRenderLayers() ?? {};
  }

  getStyleManifest(): SimStyleManifest {
    return amoebaLampStyleManifest;
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
      this.model = new AmoebaLampModel(this.modelOptions);
      return;
    }
    this.reset();
  }
}
