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
import { LEAVES_POLLEN_DEFAULTS } from './leaves-pollen.config.js';
import { LeavesPollenModel } from './LeavesPollenModel.js';

export const leavesPollenStyles: SimStyle[] = [
  {
    id: 'autumn-window',
    name: 'Autumn Window',
    description: 'Warm floating leaves and golden pollen for seasonal foreground overlays.',
    palette: [0xf59e0b, 0xf97316, 0xfef08a, 0x422006],
    background: 0x0f172a,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.18, warmth: 0.76, transparency: 0.82 },
  },
  {
    id: 'spring-pollen',
    name: 'Spring Pollen',
    description: 'Soft green pollen motes with sparse young leaves.',
    palette: [0xfef08a, 0xbef264, 0x86efac, 0x14532d],
    background: 0x052e16,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.24, pollen: 0.84, transparency: 0.86 },
  },
  {
    id: 'sleep-breeze',
    name: 'Sleep Breeze',
    description: 'Dim low-motion drifting specks for overnight passive displays.',
    palette: [0xfde68a, 0xa3e635, 0x64748b, 0x020617],
    background: 0x020617,
    passes: ['primitive'],
    uniforms: { glow: 0.06, dim: 0.9, transparency: 0.92 },
  },
];

export const leavesPollenStyleManifest: SimStyleManifest = {
  defaultStyleId: 'autumn-window',
  capabilities: {
    renderLayers: ['particles', 'glow', 'debug'],
    passes: ['primitive', 'bloom', 'colorGrade'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [
    ...leavesPollenStyles,
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random leaves and pollen style each time.',
      palette: [0xf59e0b, 0xfef08a, 0x86efac, 0x020617],
      background: 0x000000,
      passes: [],
      uniforms: {},
      uniformSchema: [],
    },
  ],
};

export class LeavesPollenScene extends Scene {
  readonly name = 'Leaves/Pollen';
  private renderer: ParticlePointRenderer | null = null;
  private model: LeavesPollenModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = leavesPollenStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeParticleBudget = 0;

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
      alpha: this.preview ? 0.52 : 0.78,
      sizeScale: this.quality === 'basic' ? 0.62 : 0.86,
      zIndex: 24,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.particleCount,
      fieldVariance: stats.pollen,
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
    this.style = leavesPollenStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedBudget = this.preview
      ? 90
      : Number(settings.get('particleCount') ?? LEAVES_POLLEN_DEFAULTS.particleCount);
    const particleCount = Number.isFinite(requestedBudget)
      ? Math.max(36, Math.min(1200, Math.floor(requestedBudget)))
      : LEAVES_POLLEN_DEFAULTS.particleCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? LEAVES_POLLEN_DEFAULTS.maxBrightness);
    this.activeParticleBudget = particleCount;
    this.model = new LeavesPollenModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      particleCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : LEAVES_POLLEN_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedBudget = Number(this.ctx.systems.settings.get('particleCount') ?? this.activeParticleBudget);
    const nextBudget = Number.isFinite(requestedBudget) ? Math.max(36, Math.min(1200, Math.floor(requestedBudget))) : this.activeParticleBudget;
    if (!this.preview && nextBudget !== this.activeParticleBudget) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? LEAVES_POLLEN_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? LEAVES_POLLEN_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? LEAVES_POLLEN_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? LEAVES_POLLEN_DEFAULTS.maxBrightness);
    const breeze = Number(this.ctx.systems.settings.get('breeze') ?? LEAVES_POLLEN_DEFAULTS.breeze);
    const driftSpeed = Number(this.ctx.systems.settings.get('driftSpeed') ?? LEAVES_POLLEN_DEFAULTS.driftSpeed);
    const pollenMix = Number(this.ctx.systems.settings.get('pollenMix') ?? LEAVES_POLLEN_DEFAULTS.pollenMix);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : LEAVES_POLLEN_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : LEAVES_POLLEN_DEFAULTS.maxBrightness);
    this.model.setBreeze(Number.isFinite(breeze) ? breeze : LEAVES_POLLEN_DEFAULTS.breeze);
    this.model.setDriftSpeed(Number.isFinite(driftSpeed) ? driftSpeed : LEAVES_POLLEN_DEFAULTS.driftSpeed);
    this.model.setPollenMix(Number.isFinite(pollenMix) ? pollenMix : LEAVES_POLLEN_DEFAULTS.pollenMix);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['weather', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.58, intensity: 0.52, pollen: 0.44 } }];
    this.model.applyAmbientData(snapshots);
  }
}
