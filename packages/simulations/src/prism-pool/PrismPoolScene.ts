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
import { PRISM_POOL_DEFAULTS } from './prism-pool.config.js';
import { PrismPoolModel, type PrismPoolModelOptions } from './PrismPoolModel.js';
import { crystalCausticsStyle } from './styles/crystal-caustics.js';
import { moonlitGlassStyle } from './styles/moonlit-glass.js';
import { rainbowTilesStyle } from './styles/rainbow-tiles.js';

export const prismPoolStyleManifest: SimStyleManifest = {
  defaultStyleId: 'crystal-caustics',
  capabilities: {
    renderLayers: ['field', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion', 'normalLighting', 'chromaticAberration', 'contourBands'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [crystalCausticsStyle, rainbowTilesStyle, moonlitGlassStyle],
};

export class PrismPoolScene extends SimulationScene {
  readonly name: string = 'PrismPool';
  private heightRenderer: FieldPaletteRenderer | null = null;
  private causticRenderer: FieldPaletteRenderer | null = null;
  private normalRenderer: FieldPaletteRenderer | null = null;
  private model: PrismPoolModel | null = null;
  private modelOptions: PrismPoolModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastColumns = 0;
  private lastWaveSpeed = 0;
  private lastRefractionStrength = 0;
  private lastCausticIntensity = 0;
  private lastDamping = 0;

  constructor(private readonly previewColumns?: number) { super(); }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.heightRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.causticRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.normalRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
    this.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (PRISM_POOL_DEFAULTS.resolution as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      waveSpeed: (settings.get('waveSpeed') as number | undefined) ?? (PRISM_POOL_DEFAULTS.waveSpeed as number),
      refractionStrength: (settings.get('refractionStrength') as number | undefined) ?? (PRISM_POOL_DEFAULTS.refractionStrength as number),
      causticIntensity: (settings.get('causticIntensity') as number | undefined) ?? (PRISM_POOL_DEFAULTS.causticIntensity as number),
      damping: (settings.get('damping') as number | undefined) ?? (PRISM_POOL_DEFAULTS.damping as number),
    };
    this.model = new PrismPoolModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.heightRenderer?.destroy();
    this.causticRenderer?.destroy();
    this.normalRenderer?.destroy();
    this.heightRenderer = null;
    this.causticRenderer = null;
    this.normalRenderer = null;
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
    if (!this.model || !this.heightRenderer || !this.causticRenderer || !this.normalRenderer) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? crystalCausticsStyle;
    this.heightRenderer.clear();
    this.causticRenderer.clear();
    this.normalRenderer.clear();
    this.heightRenderer.renderField('prism-pool-height', this.model.heightField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.9, gamma: 0.82, zIndex: 0 });
    this.causticRenderer.renderField('prism-pool-caustics', this.model.causticField, this.ctx_.width, this.ctx_.height, style, { alpha: this.quality === 'enhanced' ? 0.74 : 0.52, gamma: 0.45, zIndex: 1 });
    if (this.quality === 'enhanced') {
      this.normalRenderer.renderField('prism-pool-normals', this.model.normalField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.32, gamma: 0.58, zIndex: 2 });
    }
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.columns * stats.rows, fieldVariance: stats.causticVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new PrismPoolModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new PrismPoolModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.heightRenderer?.setQuality(quality);
    this.causticRenderer?.setQuality(quality);
    this.normalRenderer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      field: this.heightRenderer?.getLayer('prism-pool-height'),
      glow: this.causticRenderer?.getLayer('prism-pool-caustics'),
      debug: this.normalRenderer?.getLayer('prism-pool-normals'),
    };
  }

  getStyleManifest(): SimStyleManifest { return prismPoolStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new PrismPoolModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (PRISM_POOL_DEFAULTS.resolution as number));
    const waveSpeed = (settings.get('waveSpeed') as number | undefined) ?? (PRISM_POOL_DEFAULTS.waveSpeed as number);
    const refractionStrength = (settings.get('refractionStrength') as number | undefined) ?? (PRISM_POOL_DEFAULTS.refractionStrength as number);
    const causticIntensity = (settings.get('causticIntensity') as number | undefined) ?? (PRISM_POOL_DEFAULTS.causticIntensity as number);
    const damping = (settings.get('damping') as number | undefined) ?? (PRISM_POOL_DEFAULTS.damping as number);
    if (columns !== this.lastColumns) {
      this.modelOptions = { ...this.modelOptions, columns, rows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))), waveSpeed, refractionStrength, causticIntensity, damping, seed: this.modelOptions.seed + 1 };
      this.model = new PrismPoolModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    if (waveSpeed !== this.lastWaveSpeed) { this.lastWaveSpeed = waveSpeed; this.model.setWaveSpeed(waveSpeed); this.modelOptions = { ...this.modelOptions, waveSpeed }; }
    if (refractionStrength !== this.lastRefractionStrength) { this.lastRefractionStrength = refractionStrength; this.model.setRefractionStrength(refractionStrength); this.modelOptions = { ...this.modelOptions, refractionStrength }; }
    if (causticIntensity !== this.lastCausticIntensity) { this.lastCausticIntensity = causticIntensity; this.model.setCausticIntensity(causticIntensity); this.modelOptions = { ...this.modelOptions, causticIntensity }; }
    if (damping !== this.lastDamping) { this.lastDamping = damping; this.model.setDamping(damping); this.modelOptions = { ...this.modelOptions, damping }; }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastColumns = this.modelOptions.columns;
    this.lastWaveSpeed = this.modelOptions.waveSpeed;
    this.lastRefractionStrength = this.modelOptions.refractionStrength;
    this.lastCausticIntensity = this.modelOptions.causticIntensity;
    this.lastDamping = this.modelOptions.damping;
  }
}
