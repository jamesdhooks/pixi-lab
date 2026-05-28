import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface EmbersModelOptions {
  seed: number;
  width: number;
  height: number;
  emberCount: number;
  maxBrightness: number;
}

interface EmberParticle {
  baseX: number;
  baseY: number;
  riseSpeed: number;
  wobble: number;
  size: number;
  heat: number;
  phase: number;
}

export interface EmbersStats {
  heat: number;
  activity: number;
  brightness: number;
  motionScale: number;
  emberCount: number;
  width: number;
  height: number;
}

export interface EmbersSnapshot {
  heat: number;
  activity: number;
  brightness: number;
  motionScale: number;
  embers: Array<{ x: number; y: number; size: number; alpha: number }>;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function normalizePercent(value: number): number {
  return value > 1 ? clamp(value / 100) : clamp(value);
}

function numberValue(snapshot: AmbientDataSnapshot | undefined, key: string): number | null {
  const value = snapshot?.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class EmbersModel {
  private width: number;
  private height: number;
  private readonly embers: EmberParticle[];
  private maxBrightness: number;
  private ambientHeat = 0.48;
  private ambientActivity = 0.44;
  private manualHeat = 0.56;
  private updraft = 0.48;
  private elapsed = 0;
  private globalIntensity = 1;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: EmbersModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.92);
    const count = Math.max(24, Math.floor(options.emberCount));
    const rng = new SeededRng(options.seed);
    this.embers = Array.from({ length: count }, () => ({
      baseX: rng.next(),
      baseY: rng.next(),
      riseSpeed: rng.range(0.016, 0.13),
      wobble: rng.range(-0.28, 0.28),
      size: rng.range(1.4, 7.2),
      heat: rng.range(0.22, 1),
      phase: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const home = snapshots.find((snapshot) => snapshot.source === 'homeAssistant');
    const weather = snapshots.find((snapshot) => snapshot.source === 'weather');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const phase = numberValue(synthetic, 'phase') ?? 0.64;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.38;

    const fireplace = numberValue(home, 'fireplace') ?? numberValue(home, 'heat') ?? numberValue(home, 'cozy');
    const indoorTemp = numberValue(home, 'temperatureC') ?? numberValue(home, 'temperature');
    const outsideTemp = numberValue(weather, 'temperatureC') ?? numberValue(weather, 'temperature');
    const wind = numberValue(weather, 'windKph') ?? numberValue(weather, 'wind');

    if (fireplace !== null) {
      this.ambientHeat = normalizePercent(fireplace);
    } else if (indoorTemp !== null) {
      this.ambientHeat = clamp((indoorTemp - 16) / 12);
    } else if (outsideTemp !== null) {
      this.ambientHeat = clamp(0.68 - (outsideTemp + 4) / 42);
    } else {
      this.ambientHeat = clamp(0.24 + syntheticIntensity * 0.52 + Math.sin(wrap01(phase + 0.1) * Math.PI * 2) * 0.12);
    }

    this.ambientActivity = wind !== null
      ? clamp(0.22 + normalizePercent(wind) * 0.7)
      : clamp(0.18 + syntheticIntensity * 0.58 + Math.cos(wrap01(phase + 0.22) * Math.PI * 2) * 0.1);
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
    this.globalIntensity = clamp(value, 0.04, 1.2);
  }

  setMaxBrightness(value: number): void {
    this.maxBrightness = clamp(value, 0.08, 0.92);
  }

  setHeat(value: number): void {
    this.manualHeat = clamp(value, 0, 1);
  }

  setUpdraft(value: number): void {
    this.updraft = clamp(value, 0, 1);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const count = this.visibleCount();
    return this.embers.slice(0, count).map((ember) => {
      const heatLift = 0.58 + ember.heat * 0.86;
      const rise = wrap01(ember.baseY - this.elapsed * ember.riseSpeed * heatLift * (0.5 + stats.heat));
      const turbulence = Math.sin((rise + ember.phase + this.elapsed * 0.055) * Math.PI * 2) * ember.wobble;
      const x = wrap01(ember.baseX + turbulence * (0.08 + this.updraft * 0.08)) * this.width;
      const y = rise * this.height;
      const fade = Math.sin((1 - rise) * Math.PI);
      const alpha = clamp((0.12 + ember.heat * 0.58) * fade * stats.brightness, 0, this.maxBrightness);
      const color = ember.heat > 0.72 ? 0xfef3c7 : ember.heat > 0.44 ? 0xfb923c : 0xef4444;
      return {
        position: { x, y },
        velocity: { x: turbulence * 18, y: -ember.riseSpeed * this.height * (0.7 + this.updraft) },
        size: ember.size * (0.64 + ember.heat * 0.52),
        color,
        alpha,
      };
    });
  }

  stats(): EmbersStats {
    const sleepScale = this.sleepMode ? 0.22 : 1;
    const lowMotionScale = this.lowMotion ? 0.34 : 1;
    const heat = clamp((this.ambientHeat + this.manualHeat) * 0.5);
    const activity = clamp((this.ambientActivity + this.updraft) * 0.5);
    const brightness = (0.22 + heat * 0.54 + activity * 0.16) * this.globalIntensity * sleepScale;
    return {
      heat,
      activity,
      brightness: clamp(brightness, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.34 + heat * 0.42 + activity * 0.32) * this.globalIntensity,
      emberCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): EmbersSnapshot {
    const stats = this.stats();
    return {
      heat: Number(stats.heat.toFixed(3)),
      activity: Number(stats.activity.toFixed(3)),
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      embers: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.26 : 1;
    const motion = this.lowMotion ? 0.56 : 1;
    const activity = 0.34 + clamp((this.ambientHeat + this.manualHeat) * 0.5) * 0.44 + this.ambientActivity * 0.22;
    return Math.max(8, Math.min(this.embers.length, Math.round(this.embers.length * sleep * motion * activity)));
  }
}
