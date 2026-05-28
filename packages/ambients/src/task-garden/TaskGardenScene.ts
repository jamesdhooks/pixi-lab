import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { TASK_GARDEN_DEFAULTS } from './task-garden.config.js';
import { TaskGardenModel } from './TaskGardenModel.js';

export const taskGardenStyles: SimStyle[] = [
  {
    id: 'morning-chores',
    name: 'Morning Chores',
    description: 'Soft greens and warm task blooms for morning dashboard planning.',
    palette: [0x86efac, 0xfef3c7, 0xfacc15, 0x34d399],
    background: 0x052e16,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.28, dew: 0.42, warmth: 0.52 },
  },
  {
    id: 'bloom-board',
    name: 'Bloom Board',
    description: 'Completion-forward garden colors with visible fruit and sparkle cues.',
    palette: [0x22c55e, 0xfacc15, 0xfb7185, 0xc084fc],
    background: 0x111827,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.4, blossom: 0.7, contrast: 0.46 },
  },
  {
    id: 'neon-garden',
    name: 'Neon Garden',
    description: 'Night-friendly cyan and violet plants for ambient organizer walls.',
    palette: [0x67e8f9, 0xa78bfa, 0x34d399, 0xf0abfc],
    background: 0x020617,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.52, dim: 0.2, saturation: 0.62 },
  },
];

export class TaskGardenScene extends Scene {
  readonly name = 'TaskGarden';
  private renderer: ParticlePointRenderer | null = null;
  private model: TaskGardenModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = taskGardenStyles[0];
  private elapsedSinceDataPoll = 0;
  private activePlantBudget = 0;
  private activeSparkleBudget = 0;

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
      alpha: this.preview ? 0.64 : 0.86,
      sizeScale: this.quality === 'basic' ? 0.84 : 1.12,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.visibleParticles,
      fieldVariance: stats.dueSoon + stats.overdue,
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
    this.style = taskGardenStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedPlants = this.preview ? 36 : Number(settings.get('plantCount') ?? TASK_GARDEN_DEFAULTS.plantCount);
    const requestedSparkles = this.preview ? 18 : Number(settings.get('sparkleCount') ?? TASK_GARDEN_DEFAULTS.sparkleCount);
    const plantCount = Number.isFinite(requestedPlants) ? Math.max(18, Math.min(360, Math.floor(requestedPlants))) : TASK_GARDEN_DEFAULTS.plantCount;
    const sparkleCount = Number.isFinite(requestedSparkles) ? Math.max(0, Math.min(260, Math.floor(requestedSparkles))) : TASK_GARDEN_DEFAULTS.sparkleCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? TASK_GARDEN_DEFAULTS.maxBrightness);
    this.activePlantBudget = plantCount;
    this.activeSparkleBudget = sparkleCount;
    this.model = new TaskGardenModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      plantCount,
      sparkleCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : TASK_GARDEN_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedPlants = Number(this.ctx.systems.settings.get('plantCount') ?? this.activePlantBudget);
    const requestedSparkles = Number(this.ctx.systems.settings.get('sparkleCount') ?? this.activeSparkleBudget);
    const nextPlants = Number.isFinite(requestedPlants) ? Math.max(18, Math.min(360, Math.floor(requestedPlants))) : this.activePlantBudget;
    const nextSparkles = Number.isFinite(requestedSparkles) ? Math.max(0, Math.min(260, Math.floor(requestedSparkles))) : this.activeSparkleBudget;
    if (!this.preview && (nextPlants !== this.activePlantBudget || nextSparkles !== this.activeSparkleBudget)) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? TASK_GARDEN_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? TASK_GARDEN_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? TASK_GARDEN_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? TASK_GARDEN_DEFAULTS.maxBrightness);
    const urgency = Number(this.ctx.systems.settings.get('urgencySensitivity') ?? TASK_GARDEN_DEFAULTS.urgencySensitivity);
    const growth = Number(this.ctx.systems.settings.get('growthRate') ?? TASK_GARDEN_DEFAULTS.growthRate);
    const completion = Number(this.ctx.systems.settings.get('completionGlow') ?? TASK_GARDEN_DEFAULTS.completionGlow);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : TASK_GARDEN_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : TASK_GARDEN_DEFAULTS.maxBrightness);
    this.model.setUrgencySensitivity(Number.isFinite(urgency) ? urgency : TASK_GARDEN_DEFAULTS.urgencySensitivity);
    this.model.setGrowthRate(Number.isFinite(growth) ? growth : TASK_GARDEN_DEFAULTS.growthRate);
    this.model.setCompletionGlow(Number.isFinite(completion) ? completion : TASK_GARDEN_DEFAULTS.completionGlow);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['tasks', 'calendar', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.35, intensity: 0.48, activity: 0.42, completed: 0.36 } }];
    this.model.applyAmbientData(snapshots);
  }
}
