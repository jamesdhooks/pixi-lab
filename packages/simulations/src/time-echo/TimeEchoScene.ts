import {
  ParticlePointRenderer,
  SimulationScene,
  TrailFeedbackRenderer,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { TIME_ECHO_DEFAULTS } from './time-echo.config.js';
import { TimeEchoModel, type TimeEchoModelOptions } from './TimeEchoModel.js';
import { ghostLoopStyle } from './styles/ghost-loop.js';
import { phaseStormStyle } from './styles/phase-storm.js';
import { timeGlassStyle } from './styles/time-glass.js';

export const timeEchoStyleManifest: SimStyleManifest = {
  defaultStyleId: 'ghost-loop',
  capabilities: {
    renderLayers: ['field', 'trails', 'particles', 'glow', 'debug'],
    passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback', 'chromaticAberration', 'shockwave', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [ghostLoopStyle, timeGlassStyle, phaseStormStyle],
};

export class TimeEchoScene extends SimulationScene {
  readonly name: string = 'TimeEcho';
  private trailRenderer: TrailFeedbackRenderer | null = null;
  private particleRenderer: ParticlePointRenderer | null = null;
  private model: TimeEchoModel | null = null;
  private modelOptions: TimeEchoModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private lastParticleCount = 0;
  private lastTrailColumns = 0;
  private lastHistoryLength = 0;
  private lastEchoDelay = 0;
  private lastMemoryPull = 0;
  private lastTrailFade = 0;

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number, private readonly previewHistory?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.trailRenderer = new TrailFeedbackRenderer(ctx.systems.pixi.app);
    this.particleRenderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.trailRenderer.setQuality(ctx.quality);
    this.particleRenderer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (TIME_ECHO_DEFAULTS.resolution as number));
    const historyLength = this.previewHistory ?? ((settings.get('historyLength') as number | undefined) ?? (TIME_ECHO_DEFAULTS.historyLength as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      particleCount: this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (TIME_ECHO_DEFAULTS.particleCount as number)),
      trailColumns: columns,
      trailRows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      historyLength,
      echoDelay: (settings.get('echoDelay') as number | undefined) ?? (TIME_ECHO_DEFAULTS.echoDelay as number),
      memoryPull: (settings.get('memoryPull') as number | undefined) ?? (TIME_ECHO_DEFAULTS.memoryPull as number),
      trailFade: (settings.get('trailFade') as number | undefined) ?? (TIME_ECHO_DEFAULTS.trailFade as number),
      drag: (TIME_ECHO_DEFAULTS.drag as number),
    };
    this.model = new TimeEchoModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.trailRenderer?.destroy();
    this.particleRenderer?.destroy();
    this.trailRenderer = null;
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
    if (!this.trailRenderer || !this.particleRenderer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? ghostLoopStyle;
    this.trailRenderer.clear();
    this.particleRenderer.clear();
    this.trailRenderer.renderTrail('echo', this.model.trailField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.92, gamma: 0.34, zIndex: 0 });
    this.particleRenderer.renderParticles(this.model.renderParticles(), style, { sizeScale: 0.7, zIndex: 1 });
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.trailVariance });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, trailRows: Math.max(12, Math.round(this.modelOptions.trailColumns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new TimeEchoModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new TimeEchoModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.trailRenderer?.setQuality(quality);
    this.particleRenderer?.setQuality(quality);
  }

  private applyLiveSettings(): void {
    if (!this.model || !this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (TIME_ECHO_DEFAULTS.resolution as number));
    const particleCount = this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (TIME_ECHO_DEFAULTS.particleCount as number));
    const historyLength = this.previewHistory ?? ((settings.get('historyLength') as number | undefined) ?? (TIME_ECHO_DEFAULTS.historyLength as number));
    const echoDelay = (settings.get('echoDelay') as number | undefined) ?? (TIME_ECHO_DEFAULTS.echoDelay as number);
    const memoryPull = (settings.get('memoryPull') as number | undefined) ?? (TIME_ECHO_DEFAULTS.memoryPull as number);
    const trailFade = (settings.get('trailFade') as number | undefined) ?? (TIME_ECHO_DEFAULTS.trailFade as number);

    const structural = columns !== this.lastTrailColumns || particleCount !== this.lastParticleCount || historyLength !== this.lastHistoryLength;
    if (structural) {
      this.modelOptions = {
        ...this.modelOptions,
        particleCount,
        trailColumns: columns,
        trailRows: Math.max(12, Math.round(columns * this.ctx_.height / Math.max(1, this.ctx_.width))),
        historyLength,
        echoDelay,
        memoryPull,
        trailFade,
        seed: this.modelOptions.seed + 1,
      };
      this.model = new TimeEchoModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }

    if (echoDelay !== this.lastEchoDelay) {
      this.lastEchoDelay = echoDelay;
      this.model.setEchoDelay(echoDelay);
      this.modelOptions = { ...this.modelOptions, echoDelay };
    }
    if (memoryPull !== this.lastMemoryPull) {
      this.lastMemoryPull = memoryPull;
      this.model.setMemoryPull(memoryPull);
      this.modelOptions = { ...this.modelOptions, memoryPull };
    }
    if (trailFade !== this.lastTrailFade) {
      this.lastTrailFade = trailFade;
      this.model.setTrailFade(trailFade);
      this.modelOptions = { ...this.modelOptions, trailFade };
    }
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastParticleCount = this.modelOptions.particleCount;
    this.lastTrailColumns = this.modelOptions.trailColumns;
    this.lastHistoryLength = this.modelOptions.historyLength;
    this.lastEchoDelay = this.modelOptions.echoDelay;
    this.lastMemoryPull = this.modelOptions.memoryPull;
    this.lastTrailFade = this.modelOptions.trailFade;
  }

  getRenderLayers(): SimRenderLayers {
    return {
      trails: this.trailRenderer?.getLayer('echo'),
      particles: this.particleRenderer?.particles,
      glow: this.trailRenderer?.getLayer('echo'),
    };
  }

  getStyleManifest(): SimStyleManifest {
    return timeEchoStyleManifest;
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
      this.model = new TimeEchoModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }
}
