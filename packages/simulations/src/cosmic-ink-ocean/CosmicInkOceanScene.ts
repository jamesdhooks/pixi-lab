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
import { COSMIC_INK_OCEAN_DEFAULTS } from './cosmic-ink-ocean.config.js';
import { CosmicInkOceanModel, type CosmicInkOceanModelOptions } from './CosmicInkOceanModel.js';
import { deepCurrentStyle } from './styles/deep-current.js';
import { goldenTideStyle } from './styles/golden-tide.js';
import { nebulaInkStyle } from './styles/nebula-ink.js';

export const cosmicInkOceanStyleManifest: SimStyleManifest = {
  defaultStyleId: 'nebula-ink',
  capabilities: {
    renderLayers: ['field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback', 'contourBands', 'chromaticAberration', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [nebulaInkStyle, goldenTideStyle, deepCurrentStyle],
};

export class CosmicInkOceanScene extends SimulationScene {
  readonly name: string = 'CosmicInkOcean';
  private fieldRenderer: FieldPaletteRenderer | null = null;
  private particleRenderer: ParticlePointRenderer | null = null;
  private model: CosmicInkOceanModel | null = null;
  private modelOptions: CosmicInkOceanModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastParticleCount = 0;
  private lastColumns = 0;
  private lastTurbulence = 0;
  private lastFlowSpeed = 0;
  private lastInkDiffusion = 0;
  private lastVortexStrength = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.fieldRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.fieldRenderer.setQuality(ctx.quality);
    if (ctx.quality === 'enhanced') {
      this.particleRenderer = new ParticlePointRenderer(ctx.systems.pixi.app);
      this.particleRenderer.setQuality(ctx.quality);
    }
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      particleCount: this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.particleCount as number)),
      turbulence: (settings.get('turbulence') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.turbulence as number),
      flowSpeed: (settings.get('flowSpeed') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.flowSpeed as number),
      inkDiffusion: (settings.get('inkDiffusion') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.inkDiffusion as number),
      vortexStrength: (settings.get('vortexStrength') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.vortexStrength as number),
    };
    this.model = new CosmicInkOceanModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.fieldRenderer?.destroy();
    this.particleRenderer?.destroy();
    this.fieldRenderer = null;
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
    if (!this.model || !this.fieldRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? nebulaInkStyle;
    this.fieldRenderer.clear();
    this.fieldRenderer.renderField('ink', this.model.inkField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.94, gamma: 0.42, zIndex: 0 });
    if (this.particleRenderer) {
      this.particleRenderer.clear();
      this.particleRenderer.renderParticles(this.model.renderParticles(), style, { sizeScale: 0.72, zIndex: 1 });
    }
    const debug = this.ctx_.systems.debug;
    if (debug?.isEnabled()) {
      const stats = this.model.stats();
      debug.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.inkVariance });
    }
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new CosmicInkOceanModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new CosmicInkOceanModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    const prev = this.quality;
    super.setQuality(quality);
    this.fieldRenderer?.setQuality(quality);
    this.particleRenderer?.setQuality(quality);
    if (!this.model || prev === quality) return;
    if (quality === 'enhanced' && !this.particleRenderer) {
      this.particleRenderer = new ParticlePointRenderer(this.ctx_.systems.pixi.app);
      this.particleRenderer.setQuality(quality);
    }
    if (quality !== 'enhanced' && this.particleRenderer) {
      this.particleRenderer.destroy();
      this.particleRenderer = null;
    }
  }

  getRenderLayers(): SimRenderLayers {
    return {
      field: this.fieldRenderer?.getLayer('ink'),
      particles: this.particleRenderer?.particles,
      glow: this.fieldRenderer?.getLayer('ink'),
    };
  }

  getStyleManifest(): SimStyleManifest {
    return cosmicInkOceanStyleManifest;
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
      this.model = new CosmicInkOceanModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.resolution as number));
    const particleCount = this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.particleCount as number));
    const turbulence = (settings.get('turbulence') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.turbulence as number);
    const flowSpeed = (settings.get('flowSpeed') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.flowSpeed as number);
    const inkDiffusion = (settings.get('inkDiffusion') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.inkDiffusion as number);
    const vortexStrength = (settings.get('vortexStrength') as number | undefined) ?? (COSMIC_INK_OCEAN_DEFAULTS.vortexStrength as number);

    if (columns !== this.lastColumns || particleCount !== this.lastParticleCount) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), particleCount, turbulence, flowSpeed, inkDiffusion, vortexStrength, seed: this.modelOptions.seed + 1 };
      this.model = new CosmicInkOceanModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (turbulence !== this.lastTurbulence) {
      this.lastTurbulence = turbulence;
      this.model.setTurbulence(turbulence);
      this.modelOptions = { ...this.modelOptions, turbulence };
    }
    if (flowSpeed !== this.lastFlowSpeed) {
      this.lastFlowSpeed = flowSpeed;
      this.model.setFlowSpeed(flowSpeed);
      this.modelOptions = { ...this.modelOptions, flowSpeed };
    }
    if (inkDiffusion !== this.lastInkDiffusion) {
      this.lastInkDiffusion = inkDiffusion;
      this.model.setInkDiffusion(inkDiffusion);
      this.modelOptions = { ...this.modelOptions, inkDiffusion };
    }
    if (vortexStrength !== this.lastVortexStrength) {
      this.lastVortexStrength = vortexStrength;
      this.model.setVortexStrength(vortexStrength);
      this.modelOptions = { ...this.modelOptions, vortexStrength };
    }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastParticleCount = this.modelOptions.particleCount;
    this.lastColumns = this.modelOptions.columns;
    this.lastTurbulence = this.modelOptions.turbulence;
    this.lastFlowSpeed = this.modelOptions.flowSpeed;
    this.lastInkDiffusion = this.modelOptions.inkDiffusion;
    this.lastVortexStrength = this.modelOptions.vortexStrength;
  }
}
