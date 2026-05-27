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
import { CHROMATIC_AVALANCHE_BOWL_DEFAULTS } from './chromatic-avalanche-bowl.config.js';
import { ChromaticAvalancheBowlModel, type ChromaticAvalancheBowlModelOptions } from './ChromaticAvalancheBowlModel.js';
import { emberChuteStyle } from './styles/ember-chute.js';
import { mineralBowlStyle } from './styles/mineral-bowl.js';
import { powderPrismStyle } from './styles/powder-prism.js';

export const chromaticAvalancheBowlStyleManifest: SimStyleManifest = {
  defaultStyleId: 'powder-prism',
  capabilities: {
    renderLayers: ['density', 'field', 'glow', 'debug'],
    passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [powderPrismStyle, mineralBowlStyle, emberChuteStyle],
};

export class ChromaticAvalancheBowlScene extends SimulationScene {
  readonly name: string = 'ChromaticAvalancheBowl';
  private densityRenderer: DensityMetaballRenderer | null = null;
  private chromaRenderer: FieldPaletteRenderer | null = null;
  private motionRenderer: FieldPaletteRenderer | null = null;
  private model: ChromaticAvalancheBowlModel | null = null;
  private modelOptions: ChromaticAvalancheBowlModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastGrainCount = 0;
  private lastSlopeAngle = 0;
  private lastFriction = 0;
  private lastChromaMix = 0;
  private lastPourRate = 0;

  constructor(private readonly previewColumns?: number, private readonly previewGrains?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.densityRenderer = new DensityMetaballRenderer(ctx.systems.pixi.app);
    this.chromaRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.motionRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      grainCount: this.previewGrains ?? ((settings.get('grainCount') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.grainCount as number)),
      slopeAngle: (settings.get('slopeAngle') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.slopeAngle as number),
      friction: (settings.get('friction') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.friction as number),
      chromaMix: (settings.get('chromaMix') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.chromaMix as number),
      pourRate: (settings.get('pourRate') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.pourRate as number),
    };
    this.model = new ChromaticAvalancheBowlModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.densityRenderer?.destroy();
    this.chromaRenderer?.destroy();
    this.motionRenderer?.destroy();
    this.densityRenderer = null;
    this.chromaRenderer = null;
    this.motionRenderer = null;
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
    if (!this.model || !this.densityRenderer || !this.chromaRenderer || !this.motionRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? powderPrismStyle;
    this.densityRenderer.clear();
    this.chromaRenderer.clear();
    this.motionRenderer.clear();
    this.densityRenderer.renderDensity(this.model.densityField, this.ctx_.width, this.ctx_.height, style, {
      alpha: this.quality === 'enhanced' ? 0.96 : 0.88,
      threshold: typeof style.uniforms.threshold === 'number' ? style.uniforms.threshold : 0.38,
      softness: this.quality === 'enhanced' ? 0.22 : 0.15,
      zIndex: 0,
    });
    this.chromaRenderer.renderField('chromatic-avalanche-chroma', this.model.chromaField, this.ctx_.width, this.ctx_.height, style, {
      alpha: this.quality === 'enhanced' ? 0.44 : 0.3,
      gamma: 0.72,
      zIndex: 1,
    });
    if (this.quality === 'enhanced') {
      this.motionRenderer.renderField('chromatic-avalanche-motion', this.model.motionField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.28, gamma: 0.48, zIndex: 2 });
    }
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.grainCount, fieldVariance: stats.pileVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new ChromaticAvalancheBowlModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new ChromaticAvalancheBowlModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.densityRenderer?.setQuality(quality);
    this.chromaRenderer?.setQuality(quality);
    this.motionRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      density: this.densityRenderer?.layer,
      field: this.chromaRenderer?.getLayer('chromatic-avalanche-chroma'),
      glow: this.motionRenderer?.getLayer('chromatic-avalanche-motion') ?? this.densityRenderer?.layer,
    };
  }

  getStyleManifest(): SimStyleManifest { return chromaticAvalancheBowlStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new ChromaticAvalancheBowlModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.resolution as number));
    const grainCount = this.previewGrains ?? ((settings.get('grainCount') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.grainCount as number));
    const slopeAngle = (settings.get('slopeAngle') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.slopeAngle as number);
    const friction = (settings.get('friction') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.friction as number);
    const chromaMix = (settings.get('chromaMix') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.chromaMix as number);
    const pourRate = (settings.get('pourRate') as number | undefined) ?? (CHROMATIC_AVALANCHE_BOWL_DEFAULTS.pourRate as number);
    if (columns !== this.lastColumns || grainCount !== this.lastGrainCount) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), grainCount, slopeAngle, friction, chromaMix, pourRate, seed: this.modelOptions.seed + 1 };
      this.model = new ChromaticAvalancheBowlModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (slopeAngle !== this.lastSlopeAngle) { this.lastSlopeAngle = slopeAngle; this.model.setSlopeAngle(slopeAngle); this.modelOptions = { ...this.modelOptions, slopeAngle }; }
    if (friction !== this.lastFriction) { this.lastFriction = friction; this.model.setFriction(friction); this.modelOptions = { ...this.modelOptions, friction }; }
    if (chromaMix !== this.lastChromaMix) { this.lastChromaMix = chromaMix; this.model.setChromaMix(chromaMix); this.modelOptions = { ...this.modelOptions, chromaMix }; }
    if (pourRate !== this.lastPourRate) { this.lastPourRate = pourRate; this.model.setPourRate(pourRate); this.modelOptions = { ...this.modelOptions, pourRate }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastGrainCount = this.modelOptions.grainCount;
    this.lastSlopeAngle = this.modelOptions.slopeAngle;
    this.lastFriction = this.modelOptions.friction;
    this.lastChromaMix = this.modelOptions.chromaMix;
    this.lastPourRate = this.modelOptions.pourRate;
  }
}
