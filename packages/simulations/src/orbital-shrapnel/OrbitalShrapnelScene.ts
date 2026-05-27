import {
  FieldPaletteRenderer,
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
import { ORBITAL_SHRAPNEL_DEFAULTS } from './orbital-shrapnel.config.js';
import { OrbitalShrapnelModel, type OrbitalShrapnelModelOptions } from './OrbitalShrapnelModel.js';
import { blackHoleLensStyle } from './styles/black-hole-lens.js';
import { iceRingStyle } from './styles/ice-ring.js';
import { solarDebrisStyle } from './styles/solar-debris.js';

type OrbitalShrapnelMode = 'add' | 'influence';

interface PointerTrack {
  x: number;
  y: number;
}

export const orbitalShrapnelStyleManifest: SimStyleManifest = {
  defaultStyleId: 'ice-ring',
  capabilities: {
    renderLayers: ['particles', 'trails', 'glow', 'debug'],
    passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom', 'shockwave', 'chromaticAberration', 'distortion'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [iceRingStyle, solarDebrisStyle, blackHoleLensStyle],
};

export class OrbitalShrapnelScene extends SimulationScene {
  readonly name: string = 'OrbitalShrapnel';
  private trailRenderer: TrailFeedbackRenderer | null = null;
  private particleRenderer: ParticlePointRenderer | null = null;
  /** Basic-quality fallback — renders the trail density field without RTT overhead. */
  private fieldRenderer: FieldPaletteRenderer | null = null;
  private model: OrbitalShrapnelModel | null = null;
  private modelOptions: OrbitalShrapnelModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastParticleCount = 0;
  private lastTrailColumns = 0;
  private lastPlanetRadius = 0;
  private lastGravity = 0;
  private lastTrailFade = 0;
  private interactionMode: OrbitalShrapnelMode = 'add';
  private readonly pointerTracks = new Map<number, PointerTrack>();

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    if (ctx.quality === 'enhanced') {
      this.trailRenderer = new TrailFeedbackRenderer(ctx.systems.pixi.app);
      this.particleRenderer = new ParticlePointRenderer(ctx.systems.pixi.app);
      this.trailRenderer.setQuality(ctx.quality);
      this.particleRenderer.setQuality(ctx.quality);
    } else {
      this.fieldRenderer = new FieldPaletteRenderer(ctx.systems.pixi.app);
      this.fieldRenderer.setQuality(ctx.quality);
    }
    const settings = ctx.systems.settings;
    const trailColumns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.resolution as number));
    const particleCount = this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.particleCount as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      particleCount,
      trailColumns,
      trailRows: Math.max(12, Math.round(trailColumns * ctx.height / Math.max(1, ctx.width))),
      planetRadius: (settings.get('planetRadius') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.planetRadius as number),
      gravity: (settings.get('gravity') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.gravity as number),
      drag: ORBITAL_SHRAPNEL_DEFAULTS.drag as number,
      trailFade: (settings.get('trailFade') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailFade as number),
    };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.trailRenderer?.destroy();
    this.particleRenderer?.destroy();
    this.fieldRenderer?.destroy();
    this.trailRenderer = null;
    this.particleRenderer = null;
    this.fieldRenderer = null;
    this.model = null;
    this.modelOptions = null;
  }

  override update(dt: number): void {
    if (!this.model || !this.modelOptions) return;
    this.applyLiveSettings();
    for (const gesture of this.consumeGestures()) {
      if (gesture.kind !== 'tap' && gesture.kind !== 'drag') continue;
      if (this.interactionMode === 'add') {
        this.model.addShrapnel(gesture.x, gesture.y, gesture.dx, gesture.dy);
      } else {
        this.model.influenceBody(gesture.x, gesture.y, gesture.dx ?? 0, gesture.dy ?? 0, dt);
      }
    }
    if (this.interactionMode === 'influence') this.applyPointerInfluence(dt);
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? iceRingStyle;
    if (this.trailRenderer && this.particleRenderer) {
      this.trailRenderer.clear();
      this.particleRenderer.clear();
      this.trailRenderer.renderTrail('orbit', this.model.trailField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.88, gamma: 0.36, zIndex: 0 });
      this.particleRenderer.renderParticles(this.model.renderParticles(), style, { sizeScale: 0.58, zIndex: 1 });
    } else if (this.fieldRenderer) {
      this.fieldRenderer.clear();
      this.fieldRenderer.renderField('orbit', this.model.trailField, this.ctx_.width, this.ctx_.height, style, { alpha: 0.88, gamma: 0.36, zIndex: 0 });
    }
    const debug = this.ctx_.systems.debug;
    if (debug?.isEnabled()) {
      const stats = this.model.stats();
      debug.update({ fps: 0, quality: this.quality, particleCount: stats.particleCount, fieldVariance: stats.trailVariance });
    }
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, width, height, trailRows: Math.max(12, Math.round(this.modelOptions.trailColumns * height / Math.max(1, width))), seed: this.modelOptions.seed + Math.floor(width + height) };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + 1 };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  override setQuality(quality: RenderQuality): void {
    const prev = this.quality;
    super.setQuality(quality);
    this.trailRenderer?.setQuality(quality);
    this.particleRenderer?.setQuality(quality);
    this.fieldRenderer?.setQuality(quality);
    // Dynamic renderer swap — only when scene is running and quality actually changed.
    if (!this.model || prev === quality) return;
    const pixi = this.ctx_.systems.pixi.app;
    if (quality === 'enhanced') {
      this.fieldRenderer?.destroy();
      this.fieldRenderer = null;
      this.trailRenderer = new TrailFeedbackRenderer(pixi);
      this.trailRenderer.setQuality(quality);
      this.particleRenderer = new ParticlePointRenderer(pixi);
      this.particleRenderer.setQuality(quality);
    } else {
      this.trailRenderer?.destroy();
      this.trailRenderer = null;
      this.particleRenderer?.destroy();
      this.particleRenderer = null;
      this.fieldRenderer = new FieldPaletteRenderer(pixi);
      this.fieldRenderer.setQuality(quality);
    }
  }

  override setMode(id: string): void {
    if (id !== 'add' && id !== 'influence') return;
    this.interactionMode = id;
    this.pointerTracks.clear();
  }


  private applyLiveSettings(): void {
    if (!this.modelOptions) return;
    const settings = this.ctx_.systems.settings;
    const particleCount = this.previewBudget ?? ((settings.get('particleCount') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.particleCount as number));
    const trailColumns = this.previewColumns ?? ((settings.get('resolution') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.resolution as number));
    const planetRadius = (settings.get('planetRadius') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.planetRadius as number);
    const gravity = (settings.get('gravity') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.gravity as number);
    const trailFade = (settings.get('trailFade') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailFade as number);

    if (
      particleCount === this.lastParticleCount &&
      trailColumns === this.lastTrailColumns &&
      planetRadius === this.lastPlanetRadius &&
      gravity === this.lastGravity &&
      trailFade === this.lastTrailFade
    ) {
      return;
    }

    this.modelOptions = {
      ...this.modelOptions,
      particleCount,
      trailColumns,
      trailRows: Math.max(12, Math.round(trailColumns * this.ctx_.height / Math.max(1, this.ctx_.width))),
      planetRadius,
      gravity,
      trailFade,
      seed: this.modelOptions.seed + 1,
    };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
  }

  private cacheLiveSettings(): void {
    if (!this.modelOptions) return;
    this.lastParticleCount = this.modelOptions.particleCount;
    this.lastTrailColumns = this.modelOptions.trailColumns;
    this.lastPlanetRadius = this.modelOptions.planetRadius;
    this.lastGravity = this.modelOptions.gravity;
    this.lastTrailFade = this.modelOptions.trailFade ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailFade as number);
  }

  private applyPointerInfluence(dt: number): void {
    if (!this.model) return;
    const activeIds = new Set<number>();
    for (const pointer of this.input_.snapshot.pointers.values()) {
      activeIds.add(pointer.id);
      const previous = this.pointerTracks.get(pointer.id);
      const vx = previous ? (pointer.x - previous.x) / Math.max(0.016, dt) : 0;
      const vy = previous ? (pointer.y - previous.y) / Math.max(0.016, dt) : 0;
      this.model.influenceBody(pointer.x, pointer.y, vx, vy, dt);
      this.pointerTracks.set(pointer.id, { x: pointer.x, y: pointer.y });
    }
    for (const id of Array.from(this.pointerTracks.keys())) if (!activeIds.has(id)) this.pointerTracks.delete(id);
  }

  getRenderLayers(): SimRenderLayers {
    return {
      trails: this.trailRenderer?.getLayer('orbit') ?? this.fieldRenderer?.getLayer('orbit'),
      particles: this.particleRenderer?.particles,
      glow: this.trailRenderer?.getLayer('orbit') ?? this.fieldRenderer?.getLayer('orbit'),
    };
  }

  getStyleManifest(): SimStyleManifest {
    return orbitalShrapnelStyleManifest;
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
      this.model = new OrbitalShrapnelModel(this.modelOptions);
      this.cacheLiveSettings();
      return;
    }
    this.reset();
  }
}
