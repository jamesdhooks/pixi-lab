import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface MemoryDriftModelOptions {
  seed: number;
  width: number;
  height: number;
  memoryCount: number;
  moteCount: number;
  maxBrightness: number;
}

interface MemoryFrame {
  x: number;
  y: number;
  radius: number;
  phase: number;
  warmth: number;
  saturation: number;
}

interface MemoryMote {
  x: number;
  y: number;
  size: number;
  phase: number;
  drift: number;
  warmth: number;
}

export interface MemoryDriftStats {
  memoryCount: number;
  moteCount: number;
  visibleParticles: number;
  paletteEnergy: number;
  photoActivity: number;
  nostalgia: number;
  warmth: number;
  brightness: number;
  motionScale: number;
  width: number;
  height: number;
}

export interface MemoryDriftSnapshot {
  stats: MemoryDriftStats;
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

function blendWarmColor(warmth: number, saturation: number, index: number): number {
  const cool = [0x93c5fd, 0xa78bfa, 0x67e8f9, 0xc4b5fd];
  const warm = [0xfde68a, 0xf9a8d4, 0xfca5a5, 0xfdba74];
  const base = warmth > 0.5 ? warm[index % warm.length] : cool[index % cool.length];
  if (saturation > 0.72) return index % 2 === 0 ? 0xfef3c7 : 0xf0abfc;
  return base;
}

export class MemoryDriftModel {
  private width: number;
  private height: number;
  private readonly memories: MemoryFrame[];
  private readonly motes: MemoryMote[];
  private maxBrightness: number;
  private elapsed = 0;
  private paletteEnergy = 0.48;
  private photoActivity = 0.42;
  private warmth = 0.58;
  private nostalgia = 0.55;
  private globalIntensity = 0.64;
  private driftSpeed = 0.42;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: MemoryDriftModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.1, 0.7);
    const rng = new SeededRng(options.seed);
    const memoryCount = Math.max(8, Math.floor(options.memoryCount));
    const moteCount = Math.max(0, Math.floor(options.moteCount));
    this.memories = Array.from({ length: memoryCount }, (_, index) => ({
      x: clamp(0.08 + rng.next() * 0.84, 0.04, 0.96),
      y: clamp(0.12 + rng.next() * 0.76, 0.06, 0.94),
      radius: rng.range(8, 28) * (index % 5 === 0 ? 1.35 : 1),
      phase: rng.next(),
      warmth: rng.next(),
      saturation: rng.range(0.35, 0.9),
    }));
    this.motes = Array.from({ length: moteCount }, () => ({
      x: clamp(0.04 + rng.next() * 0.92, 0.02, 0.98),
      y: clamp(0.04 + rng.next() * 0.92, 0.02, 0.98),
      size: rng.range(1.2, 4.8),
      phase: rng.next(),
      drift: rng.range(-0.08, 0.08),
      warmth: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const photos = snapshots.find((snapshot) => snapshot.source === 'photos');
    const media = snapshots.find((snapshot) => snapshot.source === 'media');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'phase') ?? 0.35;
    const activity = numberValue(synthetic, 'activity') ?? numberValue(synthetic, 'intensity') ?? 0.42;

    const photoCount = numberValue(photos, 'photoCount') ?? numberValue(photos, 'memories') ?? numberValue(photos, 'count');
    const paletteEnergy = numberValue(photos, 'paletteEnergy') ?? numberValue(photos, 'colorfulness') ?? numberValue(media, 'energy');
    const warmth = numberValue(photos, 'warmth') ?? numberValue(photos, 'paletteWarmth') ?? numberValue(media, 'warmth');
    const nostalgia = numberValue(photos, 'nostalgia') ?? numberValue(photos, 'age') ?? numberValue(synthetic, 'nostalgia');
    const sleep = boolValue(photos, 'sleepMode') ?? boolValue(media, 'sleepMode') ?? boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    this.photoActivity = photoCount !== null ? normalizeCount(photoCount, 120) : clamp(0.26 + activity * 0.38 + Math.max(0, Math.sin(wrap01(phase + 0.12) * Math.PI * 2)) * 0.22);
    this.paletteEnergy = paletteEnergy !== null ? clamp(paletteEnergy) : clamp(0.26 + activity * 0.44 + Math.max(0, Math.cos(wrap01(phase + 0.4) * Math.PI * 2)) * 0.18);
    this.warmth = warmth !== null ? clamp(warmth) : clamp(0.38 + Math.max(0, Math.sin(wrap01(phase + 0.68) * Math.PI * 2)) * 0.36);
    this.nostalgia = nostalgia !== null ? clamp(nostalgia) : clamp(0.32 + Math.max(0, Math.cos(wrap01(phase + 0.24) * Math.PI * 2)) * 0.34);
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
    this.maxBrightness = clamp(value, 0.1, 0.7);
  }

  setPaletteWarmth(value: number): void {
    this.warmth = clamp(value);
  }

  setDriftSpeed(value: number): void {
    this.driftSpeed = clamp(value);
  }

  setNostalgia(value: number): void {
    this.nostalgia = clamp(value);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const memoryCount = this.visibleMemoryCount();
    const moteCount = this.visibleMoteCount();
    const memoryParticles = this.memories.slice(0, memoryCount).map((memory, index) => {
      const orbit = (memory.phase + this.elapsed * (0.018 + this.driftSpeed * 0.06)) * Math.PI * 2;
      const nostalgiaPull = (this.nostalgia - 0.5) * 18;
      const shimmer = 0.68 + Math.sin(orbit * 1.7) * 0.18;
      const x = clamp(memory.x + Math.cos(orbit) * 0.018 * (this.lowMotion ? 0.25 : 1), 0, 1) * this.width;
      const y = clamp(memory.y + Math.sin(orbit * 0.8) * 0.018 * (this.lowMotion ? 0.25 : 1), 0, 1) * this.height + nostalgiaPull;
      return {
        position: { x, y: clamp(y, 0, this.height) },
        velocity: { x: Math.cos(orbit) * stats.motionScale, y: Math.sin(orbit) * stats.motionScale },
        size: memory.radius * (0.72 + stats.photoActivity * 0.34 + shimmer * 0.18),
        color: blendWarmColor((memory.warmth + stats.warmth) * 0.5, memory.saturation + stats.paletteEnergy * 0.2, index),
        alpha: clamp((0.1 + stats.photoActivity * 0.18 + stats.paletteEnergy * 0.16 + shimmer * 0.08) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });

    const moteParticles = this.motes.slice(0, moteCount).map((mote, index) => {
      const drift = wrap01(mote.phase + this.elapsed * (0.03 + this.driftSpeed * 0.12));
      const sway = Math.sin((drift + mote.warmth) * Math.PI * 2);
      return {
        position: {
          x: clamp(mote.x + mote.drift * sway * (this.lowMotion ? 0.2 : 1), 0, 1) * this.width,
          y: wrap01(mote.y - drift * 0.08 * (0.4 + this.nostalgia)) * this.height,
        },
        velocity: { x: mote.drift * this.width * stats.motionScale, y: -stats.motionScale },
        size: mote.size * (0.7 + stats.paletteEnergy * 0.45),
        color: blendWarmColor((mote.warmth + stats.warmth) * 0.5, stats.paletteEnergy, index + 3),
        alpha: clamp((0.04 + stats.paletteEnergy * 0.14 + stats.nostalgia * 0.08) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });

    return [...memoryParticles, ...moteParticles];
  }

  stats(): MemoryDriftStats {
    const sleepScale = this.sleepMode ? 0.22 : 1;
    const lowMotionScale = this.lowMotion ? 0.32 : 1;
    const brightnessBase = 0.2 + this.photoActivity * 0.22 + this.paletteEnergy * 0.2 + this.nostalgia * 0.08;
    return {
      memoryCount: this.visibleMemoryCount(),
      moteCount: this.visibleMoteCount(),
      visibleParticles: this.visibleMemoryCount() + this.visibleMoteCount(),
      paletteEnergy: this.paletteEnergy,
      photoActivity: this.photoActivity,
      nostalgia: this.nostalgia,
      warmth: this.warmth,
      brightness: clamp(brightnessBase * this.globalIntensity * sleepScale, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.18 + this.driftSpeed * 0.44 + this.paletteEnergy * 0.18),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): MemoryDriftSnapshot {
    const stats = this.stats();
    return {
      stats: {
        ...stats,
        paletteEnergy: Number(stats.paletteEnergy.toFixed(4)),
        photoActivity: Number(stats.photoActivity.toFixed(4)),
        nostalgia: Number(stats.nostalgia.toFixed(4)),
        warmth: Number(stats.warmth.toFixed(4)),
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

  private visibleMemoryCount(): number {
    const sleepScale = this.sleepMode ? 0.45 : 1;
    return Math.max(4, Math.floor(this.memories.length * sleepScale));
  }

  private visibleMoteCount(): number {
    const sleepScale = this.sleepMode ? 0.16 : 1;
    const lowMotionScale = this.lowMotion ? 0.42 : 1;
    return Math.floor(this.motes.length * sleepScale * lowMotionScale * (0.35 + this.paletteEnergy * 0.65));
  }
}
