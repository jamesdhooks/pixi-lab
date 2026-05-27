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
import { PROTO_GALAXY_FORGE_DEFAULTS } from './proto-galaxy-forge.config.js';
import { ProtoGalaxyForgeModel, type ProtoGalaxyForgeModelOptions } from './ProtoGalaxyForgeModel.js';
import { darkMatterFilamentStyle } from './styles/dark-matter-filament.js';
import { infraredForgeStyle } from './styles/infrared-forge.js';
import { stellarNurseryStyle } from './styles/stellar-nursery.js';

export const protoGalaxyForgeStyleManifest: SimStyleManifest = {
  defaultStyleId: 'stellar-nursery',
  capabilities: {
    renderLayers: ['field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [stellarNurseryStyle, darkMatterFilamentStyle, infraredForgeStyle],
};

export class ProtoGalaxyForgeScene extends SimulationScene {
  readonly name: string = 'ProtoGalaxyForge';
  private densityRenderer: FieldPaletteRenderer | null = null;
  private heatRenderer: FieldPaletteRenderer | null = null;
  private gravityRenderer: FieldPaletteRenderer | null = null;
  private particleRenderer: ParticlePointRenderer | null = null;
  private model: ProtoGalaxyForgeModel | null = null;
  private modelOptions: ProtoGalaxyForgeModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastParticleCount = 0;
  private lastWellCount = 0;
  private lastGravityStrength = 0;
  private lastSpinBias = 0;
  private lastFusionRate = 0;

  constructor(private readonly previewColumns?: number, private readonly previewParticleCount?: number, private readonly previewWellCount?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.densityRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.heatRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.gravityRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.particleRenderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.resolution as number));
    const particleCount = this.previewParticleCount ?? ((settings.get('particleCount') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.particleCount as number));
    const wellCount = this.previewWellCount ?? ((settings.get('wellCount') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.wellCount as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      particleCount,
      wellCount,
      gravityStrength: (settings.get('gravityStrength') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.gravityStrength as number),
      spinBias: (settings.get('spinBias') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.spinBias as number),
      fusionRate: (settings.get('fusionRate') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.fusionRate as number),
    };
    this.model = new ProtoGalaxyForgeModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(Boolean(settings.get('debug')));
  }

  override onExit(): void {
    this.densityRenderer?.destroy();
    this.heatRenderer?.destroy();
    this.gravityRenderer?.destroy();
    this.particleRenderer?.destroy();
    this.densityRenderer = null;
    this.heatRenderer = null;
    this.gravityRenderer = null;
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
    if (!this.model || !this.densityRenderer || !this.heatRenderer || !this.gravityRenderer || !this.particleRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? stellarNurseryStyle;
    this.densityRenderer.clear();
    this.heatRenderer.clear();
    this.gravityRenderer.clear();
    this.particleRenderer.clear();
    this.densityRenderer.renderField('proto-galaxy-density', this.model.densityField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.68, gamma: 0.72, zIndex: 0 });
    this.gravityRenderer.renderField('proto-galaxy-gravity', this.model.gravityField, this.ctx_.width, this.ctx_.height, style, { alpha: this.quality === 'enhanced' ? 0.42 : 0.25, gamma: 0.45, zIndex: 1 });
    if (this.quality === 'enhanced') this.heatRenderer.renderField('proto-galaxy-heat', this.model.heatField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.58, gamma: 0.5, zIndex: 2 });
    this.particleRenderer.renderParticles(this.model.renderParticles, style, { alpha: 0.9, sizeScale: this.quality === 'enhanced' ? 0.95 : 0.7, zIndex: 3 });
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.densityVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new ProtoGalaxyForgeModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new ProtoGalaxyForgeModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.densityRenderer?.setQuality(quality);
    this.heatRenderer?.setQuality(quality);
    this.gravityRenderer?.setQuality(quality);
    this.particleRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      field: this.densityRenderer?.getLayer('proto-galaxy-density'),
      particles: this.particleRenderer?.container,
      glow: this.heatRenderer?.getLayer('proto-galaxy-heat'),
      debug: this.gravityRenderer?.getLayer('proto-galaxy-gravity'),
    };
  }

  getStyleManifest(): SimStyleManifest { return protoGalaxyForgeStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new ProtoGalaxyForgeModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.resolution as number));
    const particleCount = this.previewParticleCount ?? ((settings.get('particleCount') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.particleCount as number));
    const wellCount = this.previewWellCount ?? ((settings.get('wellCount') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.wellCount as number));
    const gravityStrength = (settings.get('gravityStrength') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.gravityStrength as number);
    const spinBias = (settings.get('spinBias') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.spinBias as number);
    const fusionRate = (settings.get('fusionRate') as number | undefined) ?? (PROTO_GALAXY_FORGE_DEFAULTS.fusionRate as number);
    this.ctx_.systems.debug?.setEnabled(Boolean(settings.get('debug')));
    if (columns !== this.lastColumns || particleCount !== this.lastParticleCount || wellCount !== this.lastWellCount) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), particleCount, wellCount, gravityStrength, spinBias, fusionRate, seed: this.modelOptions.seed + 1 };
      this.model = new ProtoGalaxyForgeModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (gravityStrength !== this.lastGravityStrength) { this.lastGravityStrength = gravityStrength; this.model.setGravityStrength(gravityStrength); this.modelOptions = { ...this.modelOptions, gravityStrength }; }
    if (spinBias !== this.lastSpinBias) { this.lastSpinBias = spinBias; this.model.setSpinBias(spinBias); this.modelOptions = { ...this.modelOptions, spinBias }; }
    if (fusionRate !== this.lastFusionRate) { this.lastFusionRate = fusionRate; this.model.setFusionRate(fusionRate); this.modelOptions = { ...this.modelOptions, fusionRate }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastParticleCount = this.modelOptions.particleCount;
    this.lastWellCount = this.modelOptions.wellCount;
    this.lastGravityStrength = this.modelOptions.gravityStrength;
    this.lastSpinBias = this.modelOptions.spinBias;
    this.lastFusionRate = this.modelOptions.fusionRate;
  }
}
