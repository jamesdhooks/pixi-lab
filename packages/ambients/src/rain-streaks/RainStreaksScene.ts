import {
  ArcLineRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
  type SimStyleManifest,
} from '@hooksjam/pixi-lab-core';
import { RAIN_STREAKS_DEFAULTS } from './rain-streaks.config.js';
import { RainStreaksModel } from './RainStreaksModel.js';

export const rainStreaksStyles: SimStyle[] = [
  {
    id: 'storm-glass',
    name: 'Storm Glass',
    description: 'Cool blue rain streaks for transparent foreground overlays.',
    palette: [0xe0f2fe, 0xbfdbfe, 0x60a5fa, 0x0f172a],
    background: 0x020617,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.2, transparency: 0.76, chill: 0.7 },
  },
  {
    id: 'city-window',
    name: 'City Window',
    description: 'Dim urban rain with sodium-vapor warmth.',
    palette: [0xfef3c7, 0xbae6fd, 0x64748b, 0x111827],
    background: 0x0f172a,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.12, warmth: 0.4, transparency: 0.82 },
  },
  {
    id: 'sleep-rain',
    name: 'Sleep Rain',
    description: 'Sparse, low-brightness rain for overnight passive displays.',
    palette: [0x94a3b8, 0x64748b, 0xbfdbfe, 0x020617],
    background: 0x020617,
    passes: ['primitive'],
    uniforms: { glow: 0.05, dim: 0.86, transparency: 0.9 },
  },
];

export const rainStreaksStyleManifest: SimStyleManifest = {
  defaultStyleId: 'storm-glass',
  capabilities: {
    renderLayers: ['particles', 'glow', 'debug'],
    passes: ['primitive', 'bloom', 'colorGrade'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [
    ...rainStreaksStyles,
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random rain streak style each time.',
      palette: [0xe0f2fe, 0xbfdbfe, 0xfef3c7, 0x020617],
      background: 0x000000,
      passes: [],
      uniforms: {},
      uniformSchema: [],
    },
  ],
};

export class RainStreaksScene extends Scene {
  readonly name = 'Rain Streaks';
  private renderer: ArcLineRenderer | null = null;
  private model: RainStreaksModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = rainStreaksStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeStreakBudget = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override shouldRender() { return true; }

  override onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    this.renderer = new ArcLineRenderer(ctx.systems.pixi.app);
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
    this.renderer.renderParticleArcs(this.model.renderParticles(), style, {
      alpha: this.preview ? 0.5 : 0.74,
      velocityScale: this.quality === 'basic' ? 0.055 : 0.082,
      zIndex: 22,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.streakCount,
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
    this.style = rainStreaksStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview
      ? 96
      : Number(settings.get('streakCount') ?? RAIN_STREAKS_DEFAULTS.streakCount);
    const streakCount = Number.isFinite(requestedBudget)
      ? Math.max(36, Math.min(1400, Math.floor(requestedBudget)))
      : RAIN_STREAKS_DEFAULTS.streakCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? RAIN_STREAKS_DEFAULTS.maxBrightness);
    this.activeStreakBudget = streakCount;
    this.model = new RainStreaksModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      streakCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : RAIN_STREAKS_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('streakCount') ?? this.activeStreakBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(36, Math.min(1400, Math.floor(requestedBudget))) : this.activeStreakBudget;
    if (!this.preview && nextBudget !== this.activeStreakBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? RAIN_STREAKS_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? RAIN_STREAKS_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? RAIN_STREAKS_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? RAIN_STREAKS_DEFAULTS.maxBrightness);
    const wind = Number(this.ctx.systems.settings.get('wind') ?? RAIN_STREAKS_DEFAULTS.wind);
    const speed = Number(this.ctx.systems.settings.get('speed') ?? RAIN_STREAKS_DEFAULTS.speed);
    const trailLength = Number(this.ctx.systems.settings.get('trailLength') ?? RAIN_STREAKS_DEFAULTS.trailLength);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : RAIN_STREAKS_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : RAIN_STREAKS_DEFAULTS.maxBrightness);
    this.model.setWind(Number.isFinite(wind) ? wind : RAIN_STREAKS_DEFAULTS.wind);
    this.model.setSpeed(Number.isFinite(speed) ? speed : RAIN_STREAKS_DEFAULTS.speed);
    this.model.setTrailLength(Number.isFinite(trailLength) ? trailLength : RAIN_STREAKS_DEFAULTS.trailLength);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['weather', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.36, intensity: 0.54 } }];
    this.model.applyAmbientData(snapshots);
  }
}
