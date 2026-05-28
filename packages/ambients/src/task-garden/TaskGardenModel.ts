import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface TaskGardenModelOptions {
  seed: number;
  width: number;
  height: number;
  plantCount: number;
  sparkleCount: number;
  maxBrightness: number;
}

interface GardenPlant {
  x: number;
  y: number;
  row: number;
  baseSize: number;
  phase: number;
  perennial: boolean;
  species: number;
}

interface CompletionSparkle {
  x: number;
  y: number;
  phase: number;
  drift: number;
  size: number;
}

export interface TaskGardenStats {
  plantCount: number;
  sparkleCount: number;
  visibleParticles: number;
  openTasks: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  recurring: number;
  brightness: number;
  motionScale: number;
  width: number;
  height: number;
}

export interface TaskGardenSnapshot {
  stats: TaskGardenStats;
  particles: Array<{ x: number; y: number; size: number; alpha: number; color: number }>;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function numberValue(snapshot: AmbientDataSnapshot | undefined, key: string): number | null {
  const value = snapshot?.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boolValue(snapshot: AmbientDataSnapshot | undefined, key: string): boolean | null {
  const value = snapshot?.values[key];
  return typeof value === 'boolean' ? value : null;
}

function normalizeCount(value: number, scale: number): number {
  if (value <= 1) return clamp(value);
  return clamp(value / scale);
}

export class TaskGardenModel {
  private width: number;
  private height: number;
  private readonly plants: GardenPlant[];
  private readonly sparkles: CompletionSparkle[];
  private maxBrightness: number;
  private elapsed = 0;
  private openTasks = 0.52;
  private dueSoon = 0.3;
  private overdue = 0.16;
  private completed = 0.38;
  private recurring = 0.24;
  private globalIntensity = 0.7;
  private urgencySensitivity = 0.66;
  private growthRate = 0.58;
  private completionGlow = 0.62;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: TaskGardenModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.1, 0.72);
    const rng = new SeededRng(options.seed);
    const plantCount = Math.max(18, Math.floor(options.plantCount));
    const sparkleCount = Math.max(0, Math.floor(options.sparkleCount));
    this.plants = Array.from({ length: plantCount }, (_, index) => {
      const row = index % 5;
      return {
        x: clamp(0.06 + rng.next() * 0.88, 0.04, 0.96),
        y: clamp(0.22 + row * 0.14 + rng.range(-0.035, 0.04), 0.14, 0.92),
        row,
        baseSize: rng.range(3.2, 11.6),
        phase: rng.next(),
        perennial: rng.next() > 0.72,
        species: Math.floor(rng.next() * 5),
      };
    });
    this.sparkles = Array.from({ length: sparkleCount }, () => ({
      x: clamp(0.05 + rng.next() * 0.9, 0.03, 0.97),
      y: clamp(0.18 + rng.next() * 0.72, 0.1, 0.96),
      phase: rng.next(),
      drift: rng.range(-0.04, 0.04),
      size: rng.range(1.4, 4.6),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const tasks = snapshots.find((snapshot) => snapshot.source === 'tasks');
    const calendar = snapshots.find((snapshot) => snapshot.source === 'calendar');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'phase') ?? 0.2;
    const activity = numberValue(synthetic, 'activity') ?? numberValue(synthetic, 'intensity') ?? 0.45;

    const open = numberValue(tasks, 'open') ?? numberValue(tasks, 'openTasks') ?? numberValue(tasks, 'taskCount');
    const due = numberValue(tasks, 'dueSoon') ?? numberValue(calendar, 'dueSoon') ?? numberValue(calendar, 'upcoming');
    const overdue = numberValue(tasks, 'overdue') ?? numberValue(calendar, 'overdue');
    const completed = numberValue(tasks, 'completed') ?? numberValue(tasks, 'completedToday') ?? numberValue(synthetic, 'completed');
    const recurring = numberValue(tasks, 'recurring') ?? numberValue(calendar, 'recurring');
    const sleep = boolValue(tasks, 'sleepMode') ?? boolValue(calendar, 'sleepMode') ?? boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    this.openTasks = open !== null ? normalizeCount(open, 32) : clamp(0.34 + activity * 0.32 + Math.sin(wrap01(phase) * Math.PI * 2) * 0.12);
    this.dueSoon = due !== null ? normalizeCount(due, 12) : clamp(0.16 + activity * 0.28 + Math.max(0, Math.sin(wrap01(phase + 0.18) * Math.PI * 2)) * 0.28);
    this.overdue = overdue !== null ? normalizeCount(overdue, 8) : clamp(0.04 + Math.max(0, Math.sin(wrap01(phase + 0.58) * Math.PI * 2)) * 0.2);
    this.completed = completed !== null ? normalizeCount(completed, 18) : clamp(0.18 + activity * 0.38 + Math.max(0, Math.cos(wrap01(phase + 0.34) * Math.PI * 2)) * 0.22);
    this.recurring = recurring !== null ? normalizeCount(recurring, 10) : clamp(0.12 + Math.max(0, Math.sin(wrap01(phase + 0.77) * Math.PI * 2)) * 0.26);
    if (sleep !== null) this.sleepMode = sleep;
  }

  update(dt: number): void {
    const safeDt = Math.max(0, Math.min(0.1, dt));
    this.elapsed += safeDt * this.stats().motionScale;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  setGlobalIntensity(value: number): void {
    this.globalIntensity = clamp(value, 0.05, 1.2);
  }

  setMaxBrightness(value: number): void {
    this.maxBrightness = clamp(value, 0.1, 0.72);
  }

  setUrgencySensitivity(value: number): void {
    this.urgencySensitivity = clamp(value, 0, 1);
  }

  setGrowthRate(value: number): void {
    this.growthRate = clamp(value, 0, 1);
  }

  setCompletionGlow(value: number): void {
    this.completionGlow = clamp(value, 0, 1);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const palette = [0x86efac, 0x34d399, 0xfacc15, 0xfb7185, 0xc084fc, 0x67e8f9];
    const urgency = clamp(stats.dueSoon * 0.62 + stats.overdue * this.urgencySensitivity);
    const plantCount = this.visiblePlantCount();
    const sparkleCount = this.visibleSparkleCount();
    const plantParticles = this.plants.slice(0, plantCount).map((plant, index) => {
      const wave = 0.54 + Math.sin((plant.phase + this.elapsed * (0.04 + this.growthRate * 0.2)) * Math.PI * 2) * 0.18;
      const growth = clamp(0.28 + stats.openTasks * 0.38 + stats.completed * 0.26 + (plant.perennial ? stats.recurring * 0.24 : 0));
      const wilt = plant.row >= 3 ? stats.overdue * this.urgencySensitivity : stats.overdue * 0.35;
      const bloom = (index % 4 === 0 ? stats.dueSoon : stats.completed) * (0.45 + this.completionGlow * 0.55);
      const color = wilt > 0.42 ? 0x7f1d1d : bloom > 0.48 ? palette[2 + (plant.species % 4)] : palette[plant.species % 2];
      return {
        position: {
          x: plant.x * this.width + Math.sin(this.elapsed + plant.phase * Math.PI * 2) * (this.lowMotion ? 0.8 : 3.2),
          y: plant.y * this.height - growth * plant.baseSize * 1.8,
        },
        velocity: { x: 0, y: -growth },
        size: plant.baseSize * (0.62 + growth + bloom * 0.34 + wave * 0.24),
        color,
        alpha: clamp((0.16 + growth * 0.3 + bloom * 0.24 - wilt * 0.12 + urgency * 0.08) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });

    const sparkleParticles = this.sparkles.slice(0, sparkleCount).map((sparkle, index) => {
      const drift = Math.sin((sparkle.phase + this.elapsed * 0.34) * Math.PI * 2);
      return {
        position: {
          x: clamp(sparkle.x + sparkle.drift * drift, 0, 1) * this.width,
          y: clamp(sparkle.y - stats.completed * 0.08 * wrap01(sparkle.phase + this.elapsed * 0.18), 0, 1) * this.height,
        },
        velocity: { x: sparkle.drift * this.width, y: -stats.completed },
        size: sparkle.size * (0.7 + this.completionGlow * 0.7),
        color: index % 3 === 0 ? 0xfef3c7 : 0xa7f3d0,
        alpha: clamp((0.08 + stats.completed * 0.36 + stats.recurring * 0.1) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });
    return [...plantParticles, ...sparkleParticles];
  }

  stats(): TaskGardenStats {
    const sleepScale = this.sleepMode ? 0.24 : 1;
    const lowMotionScale = this.lowMotion ? 0.36 : 1;
    const activeBrightness = 0.2 + this.openTasks * 0.18 + this.dueSoon * 0.18 + this.completed * 0.24 + this.recurring * 0.1 - this.overdue * 0.08;
    return {
      plantCount: this.visiblePlantCount(),
      sparkleCount: this.visibleSparkleCount(),
      visibleParticles: this.visiblePlantCount() + this.visibleSparkleCount(),
      openTasks: this.openTasks,
      dueSoon: this.dueSoon,
      overdue: this.overdue,
      completed: this.completed,
      recurring: this.recurring,
      brightness: clamp(activeBrightness * this.globalIntensity * sleepScale, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.2 + this.growthRate * 0.3 + this.completed * 0.24 + this.dueSoon * 0.18),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): TaskGardenSnapshot {
    const stats = this.stats();
    return {
      stats: {
        ...stats,
        openTasks: Number(stats.openTasks.toFixed(4)),
        dueSoon: Number(stats.dueSoon.toFixed(4)),
        overdue: Number(stats.overdue.toFixed(4)),
        completed: Number(stats.completed.toFixed(4)),
        recurring: Number(stats.recurring.toFixed(4)),
        brightness: Number(stats.brightness.toFixed(5)),
        motionScale: Number(stats.motionScale.toFixed(5)),
      },
      particles: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
        color: particle.color,
      })),
    };
  }

  private visiblePlantCount(): number {
    const sleep = this.sleepMode ? 0.5 : 1;
    const motion = this.lowMotion ? 0.76 : 1;
    const activity = 0.42 + this.openTasks * 0.34 + this.dueSoon * 0.14 + this.recurring * 0.1;
    return Math.max(10, Math.min(this.plants.length, Math.round(this.plants.length * sleep * motion * activity)));
  }

  private visibleSparkleCount(): number {
    const sleep = this.sleepMode ? 0.22 : 1;
    const motion = this.lowMotion ? 0.42 : 1;
    const completion = 0.1 + this.completed * (0.5 + this.completionGlow * 0.5) + this.recurring * 0.16;
    return Math.max(0, Math.min(this.sparkles.length, Math.round(this.sparkles.length * sleep * motion * completion)));
  }
}
