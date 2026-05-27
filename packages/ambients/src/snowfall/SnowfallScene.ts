import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
  type SimStyleManifest,
} from '@hooksjam/pixi-lab-core';
import { SNOWFALL_DEFAULTS } from './snowfall.config.js';
import { SnowfallModel } from './SnowfallModel.js';

export const snowfallStyles: SimStyle[] = [
  {
    id: 'moonlit-flurry',
    name: 'Moonlit Flurry',
    description: 'Cool white flakes over a transparent foreground overlay.',
    palette: [0xf8fafc, 0xdbeafe, 0x93c5fd, 0x475569],
    background: 0x020617,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.18, transparency: 0.72, chill: 0.64 },
  },
  {
    id: 'warm-window-snow',
    name: 'Warm Window Snow',
    description: 'Soft flakes with a small amber lift for cozy dashboards.',
    palette: [0xffffff, 0xfef3c7, 0xbfdbfe, 0x64748b],
    background: 0x0f172a,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.16, warmth: 0.34, transparency: 0.78 },
  },
  {
    id: 'sleep-snow',
    name: 'Sleep Snow',
    description: 'Dim, sparse, low-motion snowfall for passive night use.',
    palette: [0x94a3b8, 0x64748b, 0xdbeafe, 0x020617],
    background: 0x020617,
    passes: ['primitive'],
    uniforms: { glow: 0.06, dim: 0.84, transparency: 0.9 },
  },
];

export const snowfallStyleManifest: SimStyleManifest = {
  defaultStyleId: 'moonlit-flurry',
  capabilities: {
    renderLayers: ['particles', 'glow', 'debug'],
    passes: ['primitive', 'bloom', 'colorGrade'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [
    ...snowfallStyles,
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random snowfall style each time.',
      palette: [0xf8fafc, 0xdbeafe, 0x93c5fd, 0x020617],
      background: 0x000000,
      passes: [],
      uniforms: {},
      uniformSchema: [],
    },
  ],
};

export class SnowfallScene extends Scene {
  readonly name = 'Snowfall';
  private renderer: ParticlePointRenderer | null = null;
  private model: SnowfallModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = snowfallStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeFlakeBudget = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    this.renderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.renderer.setQuality(ctx.quality);
    this.createModel(ctx.seed);
    const style = ctx.systems.settings.get('style');
    if (typeof style === 'string') this.setStyle(style);
    this.pollAmbientData();
    this.syncSettings();
  }

  override onExit(): void {
    this.renderer?.destroy();
    this.renderer = null;
    this.model = null;
  }

  override update(dt: number): void {
    if (!this.model) return;
    this.elapsedSinceDataPoll += dt;
    if (this.elapsedSinceDataPoll >= 1 || this.elapsedSinceDataPoll === dt) {
      this.elapsedSinceDataPoll = 0;
      this.pollAmbientData();
      this.syncSettings();
    }
    this.model.update(dt);
  }

  override render(): void {
    if (!this.renderer || !this.model) return;
    const style = this.ctx.systems.styleManager?.getStyle() ?? this.style;
    this.renderer.renderParticles(this.model.renderParticles(), style, {
      alpha: this.preview ? 0.58 : 0.78,
      sizeScale: this.quality === 'basic' ? 0.82 : 1.08,
      zIndex: 20,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.flakeCount,
      fieldVariance: stats.precipitation,
    });
  }

  override resize(width: number, height: number): void {
    this.model?.resize(width, height);
  }

  override reset(): void {
    if (!this.ctx) return;
    this.createModel(this.ctx.seed + 1);
    this.pollAmbientData();
    this.syncSettings();
  }

  override setStyle(id: string): void {
    this.style = snowfallStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview
      ? 72
      : Number(settings.get('flakeCount') ?? SNOWFALL_DEFAULTS.flakeCount);
    const flakeCount = Number.isFinite(requestedBudget)
      ? Math.max(36, Math.min(1200, Math.floor(requestedBudget)))
      : SNOWFALL_DEFAULTS.flakeCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? SNOWFALL_DEFAULTS.maxBrightness);
    this.activeFlakeBudget = flakeCount;
    this.model = new SnowfallModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      flakeCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : SNOWFALL_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('flakeCount') ?? this.activeFlakeBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(36, Math.min(1200, Math.floor(requestedBudget))) : this.activeFlakeBudget;
    if (!this.preview && nextBudget !== this.activeFlakeBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? SNOWFALL_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? SNOWFALL_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? SNOWFALL_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? SNOWFALL_DEFAULTS.maxBrightness);
    const wind = Number(this.ctx.systems.settings.get('wind') ?? SNOWFALL_DEFAULTS.wind);
    const depthDrift = Number(this.ctx.systems.settings.get('depthDrift') ?? SNOWFALL_DEFAULTS.depthDrift);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : SNOWFALL_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : SNOWFALL_DEFAULTS.maxBrightness);
    this.model.setWind(Number.isFinite(wind) ? wind : SNOWFALL_DEFAULTS.wind);
    this.model.setDepthDrift(Number.isFinite(depthDrift) ? depthDrift : SNOWFALL_DEFAULTS.depthDrift);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['weather', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.72, intensity: 0.42 } }];
    this.model.applyAmbientData(snapshots);
  }
}
