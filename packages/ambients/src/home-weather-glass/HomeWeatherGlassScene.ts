import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { HOME_WEATHER_GLASS_DEFAULTS } from './home-weather-glass.config.js';
import { HomeWeatherGlassModel } from './HomeWeatherGlassModel.js';

export const homeWeatherGlassStyles: SimStyle[] = [
  {
    id: 'rain-blue-glass',
    name: 'Rain Blue Glass',
    description: 'Cool blue droplets and soft dashboard contrast for rainy home displays.',
    palette: [0x93c5fd, 0xbfdbfe, 0x60a5fa, 0xdbeafe],
    background: 0x07111f,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.3, glass: 0.46, vignette: 0.24 },
  },
  {
    id: 'warm-window',
    name: 'Warm Window',
    description: 'Amber indoor reflections against cool outside rain.',
    palette: [0xfef3c7, 0xfbbf24, 0x93c5fd, 0x1e3a8a],
    background: 0x0f172a,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.36, glass: 0.5, warmth: 0.42 },
  },
  {
    id: 'sleep-drizzle',
    name: 'Sleep Drizzle',
    description: 'Dim low-motion drizzle for night dashboards and passive background use.',
    palette: [0x1d4ed8, 0x64748b, 0x93c5fd, 0x0f172a],
    background: 0x020617,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.12, glass: 0.62, dim: 0.78 },
  },
];

export class HomeWeatherGlassScene extends Scene {
  readonly name = 'HomeWeatherGlass';
  private renderer: ParticlePointRenderer | null = null;
  private model: HomeWeatherGlassModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = homeWeatherGlassStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeDropletBudget = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override shouldRender() { return true; }

  override onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    this.renderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.renderer.setQuality(ctx.quality);
    this.createModel(ctx.seed);
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
      alpha: this.preview ? 0.68 : 0.86,
      sizeScale: this.quality === 'basic' ? 0.78 : 1.08,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.dropletCount,
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
    this.style = homeWeatherGlassStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview
      ? 72
      : Number(settings.get('dropletCount') ?? HOME_WEATHER_GLASS_DEFAULTS.dropletCount);
    const dropletCount = Number.isFinite(requestedBudget)
      ? Math.max(48, Math.min(1100, Math.floor(requestedBudget)))
      : HOME_WEATHER_GLASS_DEFAULTS.dropletCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? HOME_WEATHER_GLASS_DEFAULTS.maxBrightness);
    this.activeDropletBudget = dropletCount;
    this.model = new HomeWeatherGlassModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      dropletCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : HOME_WEATHER_GLASS_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('dropletCount') ?? this.activeDropletBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(48, Math.min(1100, Math.floor(requestedBudget))) : this.activeDropletBudget;
    if (!this.preview && nextBudget !== this.activeDropletBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? HOME_WEATHER_GLASS_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? HOME_WEATHER_GLASS_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? HOME_WEATHER_GLASS_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? HOME_WEATHER_GLASS_DEFAULTS.maxBrightness);
    const glassBlur = Number(this.ctx.systems.settings.get('glassBlur') ?? HOME_WEATHER_GLASS_DEFAULTS.glassBlur);
    this.model?.setSleepMode(sleep);
    this.model?.setLowMotion(lowMotion);
    this.model?.setGlobalIntensity(Number.isFinite(intensity) ? intensity : HOME_WEATHER_GLASS_DEFAULTS.intensity);
    this.model?.setMaxBrightness(Number.isFinite(brightness) ? brightness : HOME_WEATHER_GLASS_DEFAULTS.maxBrightness);
    this.model?.setGlassBlur(Number.isFinite(glassBlur) ? glassBlur : HOME_WEATHER_GLASS_DEFAULTS.glassBlur);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['weather', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.35, intensity: 0.42 } }];
    this.model.applyAmbientData(snapshots);
  }
}
