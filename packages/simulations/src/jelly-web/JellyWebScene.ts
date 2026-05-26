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
import { JELLY_WEB_DEFAULTS } from './jelly-web.config.js';
import { JellyWebModel, type JellyWebModelOptions } from './JellyWebModel.js';
import { moonJellyStyle } from './styles/moon-jelly.js';
import { neuralCoralStyle } from './styles/neural-coral.js';
import { ultravioletWebStyle } from './styles/ultraviolet-web.js';

export const jellyWebStyleManifest: SimStyleManifest = {
  defaultStyleId: 'moon-jelly',
  capabilities: {
    renderLayers: ['field', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [moonJellyStyle, neuralCoralStyle, ultravioletWebStyle],
};

export class JellyWebScene extends SimulationScene {
  readonly name: string = 'JellyWeb';
  private layer: SimulationCanvasLayer | null = null;
  private model: JellyWebModel | null = null;
  private modelOptions: JellyWebModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastRingCount = 0;
  private lastSpokeCount = 0;
  private lastResolution = 0;
  private lastSpringTension = 0;
  private lastDamping = 0;
  private lastPulseStrength = 0;
  private lastResonance = 0;

  constructor(private readonly previewResolution?: number, private readonly previewRings?: number, private readonly previewSpokes?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const resolution = this.previewResolution ?? ((settings.get('resolution') as number | undefined) ?? (JELLY_WEB_DEFAULTS.resolution as number));
    const ringCount = this.previewRings ?? ((settings.get('ringCount') as number | undefined) ?? (JELLY_WEB_DEFAULTS.ringCount as number));
    const spokeCount = this.previewSpokes ?? ((settings.get('spokeCount') as number | undefined) ?? (JELLY_WEB_DEFAULTS.spokeCount as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns: resolution,
      rows: Math.max(12, Math.round(resolution * ctx.height / Math.max(1, ctx.width))),
      ringCount,
      spokeCount,
      springTension: (settings.get('springTension') as number | undefined) ?? (JELLY_WEB_DEFAULTS.springTension as number),
      damping: (settings.get('damping') as number | undefined) ?? (JELLY_WEB_DEFAULTS.damping as number),
      pulseStrength: (settings.get('pulseStrength') as number | undefined) ?? (JELLY_WEB_DEFAULTS.pulseStrength as number),
      resonance: (settings.get('resonance') as number | undefined) ?? (JELLY_WEB_DEFAULTS.resonance as number),
    };
    this.model = new JellyWebModel(this.modelOptions);
    this.lastRingCount = ringCount;
    this.lastSpokeCount = spokeCount;
    this.lastResolution = resolution;
    this.lastSpringTension = this.modelOptions.springTension;
    this.lastDamping = this.modelOptions.damping;
    this.lastPulseStrength = this.modelOptions.pulseStrength;
    this.lastResonance = this.modelOptions.resonance;
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
    const style = this.ctx_.systems.styleManager?.getStyle() ?? moonJellyStyle;
    this.layer.clear();
    this.layer.renderField(this.model.resonanceField, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.renderParticles(), style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.nodeCount, fieldVariance: stats.fieldVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new JellyWebModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new JellyWebModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers { return this.layer?.getRenderLayers() ?? {}; }
  getStyleManifest(): SimStyleManifest { return jellyWebStyleManifest; }
  detectStagnation(): StagnationReport { return this.stagnationReport; }
  stabilize(): void { this.model?.stabilize(); this.stagnationReport = { stagnant: false, severity: 0 }; }
  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new JellyWebModel(this.modelOptions);
      return;
    }
    this.reset();
  }

  private pollSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const springTension = (settings.get('springTension') as number | undefined) ?? (JELLY_WEB_DEFAULTS.springTension as number);
    if (springTension !== this.lastSpringTension) { this.lastSpringTension = springTension; this.model.setSpringTension(springTension); this.modelOptions = { ...this.modelOptions, springTension }; }
    const damping = (settings.get('damping') as number | undefined) ?? (JELLY_WEB_DEFAULTS.damping as number);
    if (damping !== this.lastDamping) { this.lastDamping = damping; this.model.setDamping(damping); this.modelOptions = { ...this.modelOptions, damping }; }
    const pulseStrength = (settings.get('pulseStrength') as number | undefined) ?? (JELLY_WEB_DEFAULTS.pulseStrength as number);
    if (pulseStrength !== this.lastPulseStrength) { this.lastPulseStrength = pulseStrength; this.model.setPulseStrength(pulseStrength); this.modelOptions = { ...this.modelOptions, pulseStrength }; }
    const resonance = (settings.get('resonance') as number | undefined) ?? (JELLY_WEB_DEFAULTS.resonance as number);
    if (resonance !== this.lastResonance) { this.lastResonance = resonance; this.model.setResonance(resonance); this.modelOptions = { ...this.modelOptions, resonance }; }
    const ringCount = this.previewRings ?? ((settings.get('ringCount') as number | undefined) ?? (JELLY_WEB_DEFAULTS.ringCount as number));
    const spokeCount = this.previewSpokes ?? ((settings.get('spokeCount') as number | undefined) ?? (JELLY_WEB_DEFAULTS.spokeCount as number));
    const resolution = this.previewResolution ?? ((settings.get('resolution') as number | undefined) ?? (JELLY_WEB_DEFAULTS.resolution as number));
    if (ringCount !== this.lastRingCount || spokeCount !== this.lastSpokeCount || resolution !== this.lastResolution) {
      this.lastRingCount = ringCount;
      this.lastSpokeCount = spokeCount;
      this.lastResolution = resolution;
      this.modelOptions = { ...this.modelOptions, ringCount, spokeCount, columns: resolution, rows: Math.max(12, Math.round(resolution * this.ctx_.height / Math.max(1, this.ctx_.width))), seed: this.modelOptions.seed + 1 };
      this.model = new JellyWebModel(this.modelOptions);
    }
  }
}
