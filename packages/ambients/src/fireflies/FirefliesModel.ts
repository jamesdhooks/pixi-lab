import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface FirefliesModelOptions {
  seed: number;
  width: number;
  height: number;
  fireflyCount: number;
  maxBrightness: number;
}

interface FireflyParticle {
  baseX: number;
  baseY: number;
  orbit: number;
  size: number;
  phase: number;
  pulse: number;
  depth: number;
}

export interface FirefliesStats {
  night: number;
  humidity: number;
  meadow: number;
  brightness: number;
  motionScale: number;
  fireflyCount: number;
  width: number;
  height: number;
}

export interface FirefliesSnapshot {
  night: number;
  humidity: number;
  meadow: number;
  brightness: number;
  motionScale: number;
  fireflies: Array<{ x: number; y: number; size: number; alpha: number }>;
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

function boolValue(snapshot: AmbientDataSnapshot | undefined, key: string): boolean | null {
  const value = snapshot?.values[key];
  return typeof value === 'boolean' ? value : null;
}

export class FirefliesModel {
  private width: number;
  private height: number;
  private readonly fireflies: FireflyParticle[];
  private maxBrightness: number;
  private night = 0.66;
  private humidity = 0.5;
  private manualMeadow = 0.52;
  private glow = 0.64;
  private drift = 0.44;
  private elapsed = 0;
  private globalIntensity = 0.58;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: FirefliesModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.86);
    const count = Math.max(24, Math.floor(options.fireflyCount));
    const rng = new SeededRng(options.seed);
    this.fireflies = Array.from({ length: count }, () => ({
      baseX: rng.next(),
      baseY: rng.range(0.12, 0.92),
      orbit: rng.range(0.008, 0.08),
      size: rng.range(1.4, 5.8),
      phase: rng.next(),
      pulse: rng.range(0.34, 1),
      depth: rng.range(0.35, 1),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const weather = snapshots.find((snapshot) => snapshot.source === 'weather');
    const presence = snapshots.find((snapshot) => snapshot.source === 'presence');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'phase') ?? 0.74;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.42;

    const humidity = numberValue(weather, 'humidity') ?? numberValue(weather, 'humidityPercent');
    const cloud = numberValue(weather, 'cloudCover') ?? numberValue(weather, 'clouds');
    const daylight = numberValue(time, 'daylight') ?? numberValue(time, 'sun') ?? numberValue(synthetic, 'daylight');
    const activity = numberValue(presence, 'activity') ?? numberValue(presence, 'peopleHome');
    const sleep = boolValue(weather, 'sleepMode') ?? boolValue(presence, 'sleepMode') ?? boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    this.humidity = humidity !== null ? normalizePercent(humidity) : clamp(0.34 + syntheticIntensity * 0.38 + Math.sin(wrap01(phase + 0.2) * Math.PI * 2) * 0.12);
    const darkness = daylight !== null ? 1 - normalizePercent(daylight) : clamp(0.46 + Math.max(0, Math.sin(wrap01(phase + 0.58) * Math.PI * 2)) * 0.4);
    const cloudBoost = cloud !== null ? normalizePercent(cloud) * 0.16 : 0;
    this.night = clamp(darkness + cloudBoost);
    if (activity !== null) this.manualMeadow = clamp(activity > 1 ? activity / 8 : activity);
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
    this.globalIntensity = clamp(value, 0.04, 1.2);
  }

  setMaxBrightness(value: number): void {
    this.maxBrightness = clamp(value, 0.08, 0.86);
  }

  setGlow(value: number): void {
    this.glow = clamp(value);
  }

  setDrift(value: number): void {
    this.drift = clamp(value);
  }

  setMeadow(value: number): void {
    this.manualMeadow = clamp(value);
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
    return this.fireflies.slice(0, count).map((firefly) => {
      const t = firefly.phase + this.elapsed * (0.018 + this.drift * 0.08) * firefly.depth;
      const wave = Math.sin(t * Math.PI * 2);
      const pulse = Math.max(0, Math.sin((t * (1.6 + firefly.pulse)) * Math.PI * 2));
      const x = wrap01(firefly.baseX + Math.cos(t * Math.PI * 2) * firefly.orbit * (this.lowMotion ? 0.24 : 1)) * this.width;
      const y = clamp(firefly.baseY + wave * firefly.orbit * 0.7 * (this.lowMotion ? 0.2 : 1), 0.04, 0.96) * this.height;
      const alpha = clamp((0.04 + pulse * (0.28 + this.glow * 0.42) + stats.humidity * 0.08) * stats.brightness * firefly.depth, 0, this.maxBrightness);
      return {
        position: { x, y },
        velocity: { x: Math.cos(t) * stats.motionScale, y: wave * stats.motionScale },
        size: firefly.size * (0.72 + pulse * 0.72 + this.glow * 0.24),
        color: firefly.depth > 0.72 ? 0xfef08a : firefly.pulse > 0.7 ? 0xd9f99d : 0xa3e635,
        alpha,
      };
    });
  }

  stats(): FirefliesStats {
    const sleepScale = this.sleepMode ? 0.22 : 1;
    const lowMotionScale = this.lowMotion ? 0.34 : 1;
    const meadow = this.manualMeadow;
    const brightness = (0.16 + this.night * 0.42 + this.humidity * 0.18 + meadow * 0.16) * this.globalIntensity * sleepScale;
    return {
      night: this.night,
      humidity: this.humidity,
      meadow,
      brightness: clamp(brightness, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.18 + this.drift * 0.38 + this.humidity * 0.18),
      fireflyCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): FirefliesSnapshot {
    const stats = this.stats();
    return {
      night: Number(stats.night.toFixed(3)),
      humidity: Number(stats.humidity.toFixed(3)),
      meadow: Number(stats.meadow.toFixed(3)),
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      fireflies: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.24 : 1;
    const motion = this.lowMotion ? 0.48 : 1;
    const habitat = 0.28 + this.night * 0.32 + this.humidity * 0.22 + this.manualMeadow * 0.18;
    return Math.max(8, Math.min(this.fireflies.length, Math.round(this.fireflies.length * sleep * motion * habitat)));
  }
}
