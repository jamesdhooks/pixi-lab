import {
  PixiSemanticRenderPipeline,
  SimulationScene,
  WebGL2SemanticRenderPipeline,
  createFieldPaletteLayer,
  createParticlePointLayer,
  createRenderFrame,
  createTrailFeedbackLayer,
  type GameContext,
  type Input,
  type RenderQuality,
  type SemanticRenderPipeline,
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
    qualities: ['basic', 'enhanced', 'raw'],
  },
  styles: [iceRingStyle, solarDebrisStyle, blackHoleLensStyle],
};

export class OrbitalShrapnelScene extends SimulationScene {
  readonly name: string = 'OrbitalShrapnel';
  private semanticPipeline: SemanticRenderPipeline | null = null;
  private pixiPipeline: PixiSemanticRenderPipeline | null = null;
  private webgl2Pipeline: WebGL2SemanticRenderPipeline | null = null;
  private model: OrbitalShrapnelModel | null = null;
  private modelOptions: OrbitalShrapnelModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached settings values — detect changes each update tick and apply live. */
  private lastParticleCount = 0;
  private lastTrailColumns = 0;
  private lastPlanetRadius = 0;
  private lastGravity = 0;
  private lastTrailFade = 0;
  private lastRawParticleTextureSize: number | string = ORBITAL_SHRAPNEL_DEFAULTS.rawParticleTextureSize as string;
  private lastRawTrailTextureWidth: number | string = ORBITAL_SHRAPNEL_DEFAULTS.rawTrailTextureWidth as string;
  private lastRawMaxSpeed = ORBITAL_SHRAPNEL_DEFAULTS.rawMaxSpeed as number;
  private interactionMode: OrbitalShrapnelMode = 'add';
  private readonly pointerTracks = new Map<number, PointerTrack>();

  constructor(private readonly previewColumns?: number, private readonly previewBudget?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.pixiPipeline = new PixiSemanticRenderPipeline({ app: ctx.systems.pixi.app, quality: ctx.quality });
    this.webgl2Pipeline = new WebGL2SemanticRenderPipeline();
    this.semanticPipeline = ctx.quality === 'raw' ? this.webgl2Pipeline : this.pixiPipeline;
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
      maxSpeed: (settings.get('rawMaxSpeed') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawMaxSpeed as number),
    };
    this.model = new OrbitalShrapnelModel(this.modelOptions);
    this.cacheLiveSettings();
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.semanticPipeline = null;
    this.pixiPipeline?.destroy();
    this.webgl2Pipeline?.destroy();
    this.pixiPipeline = null;
    this.webgl2Pipeline = null;
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
    if (!this.model || !this.modelOptions || !this.semanticPipeline) return;
    const settings = this.ctx_.systems.settings;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? iceRingStyle;
    const trailGamma = (settings.get('trailGamma') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.trailGamma as number);
    const debrisSize = (settings.get('debrisSize') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.debrisSize as number);
    const frame = createRenderFrame({
      width: this.ctx_.width,
      height: this.ctx_.height,
      style,
      layers: this.quality === 'basic'
        ? [
          createFieldPaletteLayer({
            id: 'orbit',
            field: this.model.trailField,
            alpha: 0.88,
            gamma: 0.36,
            zIndex: 0,
          }),
        ]
        : [
          createTrailFeedbackLayer({
            id: 'orbit',
            field: this.model.trailField,
            alpha: this.quality === 'raw' ? 0.98 : 0.94,
            gamma: this.quality === 'raw' ? Math.max(0.18, trailGamma * 0.72) : trailGamma,
            zIndex: 0,
          }),
          createParticlePointLayer({
            id: 'debris',
            particles: this.model.renderParticles(),
            sizeScale: this.quality === 'raw' ? debrisSize * 1.12 : debrisSize,
            zIndex: 1,
          }),
        ],
    });
    this.semanticPipeline.render(frame);
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
    this.pixiPipeline?.setQuality(quality);
    this.semanticPipeline = quality === 'raw' ? this.webgl2Pipeline : this.pixiPipeline;
    if (!this.model || prev === quality) return;
    this.semanticPipeline?.clear();
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
    const rawParticleTextureSize = (settings.get('rawParticleTextureSize') as number | string | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawParticleTextureSize as string);
    const rawTrailTextureWidth = (settings.get('rawTrailTextureWidth') as number | string | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawTrailTextureWidth as string);
    const rawMaxSpeed = (settings.get('rawMaxSpeed') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawMaxSpeed as number);

    if (
      particleCount === this.lastParticleCount &&
      trailColumns === this.lastTrailColumns &&
      planetRadius === this.lastPlanetRadius &&
      gravity === this.lastGravity &&
      trailFade === this.lastTrailFade &&
      rawParticleTextureSize === this.lastRawParticleTextureSize &&
      rawTrailTextureWidth === this.lastRawTrailTextureWidth &&
      rawMaxSpeed === this.lastRawMaxSpeed
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
      maxSpeed: rawMaxSpeed,
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
    const settings = this.ctx_.systems.settings;
    this.lastRawParticleTextureSize = (settings.get('rawParticleTextureSize') as number | string | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawParticleTextureSize as string);
    this.lastRawTrailTextureWidth = (settings.get('rawTrailTextureWidth') as number | string | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawTrailTextureWidth as string);
    this.lastRawMaxSpeed = (settings.get('rawMaxSpeed') as number | undefined) ?? (ORBITAL_SHRAPNEL_DEFAULTS.rawMaxSpeed as number);
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
    return {};
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
