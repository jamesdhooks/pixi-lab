import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface RainStreaksModelOptions {
  seed: number;
  width: number;
  height: number;
  streakCount: number;
  maxBrightness: number;
}

interface RainStreak {
  baseX: number;
  baseY: number;
  fallSpeed: number;
  slant: number;
  size: number;
  depth: number;
  phase: number;
}

export interface RainStreaksStats {
  precipitation: number;
  wind: number;
  humidity: number;
  brightness: number;
  motionScale: number;
  streakCount: number;
  width: number;
  height: number;
}

export interface RainStreaksSnapshot {
  weather: {
    precipitation: number;
    wind: number;
    humidity: number;
  };
  brightness: number;
  motionScale: number;
  streaks: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }>;
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

export class RainStreaksModel {
  private width: number;
  private height: number;
  private readonly streaks: RainStreak[];
  private maxBrightness: number;
  private precipitation = 0.58;
  private weatherWind = 0.34;
  private humidity = 0.72;
  private manualWind = 0.46;
  private manualSpeed = 0.62;
  private trailLength = 0.72;
  private elapsed = 0;
  private globalIntensity = 1;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: RainStreaksModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.85);
    const count = Math.max(24, Math.floor(options.streakCount));
    const rng = new SeededRng(options.seed);
    this.streaks = Array.from({ length: count }, () => ({
      baseX: rng.next(),
      baseY: rng.next(),
      fallSpeed: rng.range(0.28, 1.15),
      slant: rng.range(-0.18, 0.18),
      size: rng.range(1.2, 4.6),
      depth: rng.range(0.22, 1),
      phase: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const weather = snapshots.find((snapshot) => snapshot.source === 'weather');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const phase = numberValue(synthetic, 'phase') ?? 0.36;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.54;

    const rain = numberValue(weather, 'rain') ?? numberValue(weather, 'precipitation') ?? numberValue(weather, 'storm');
    const wind = numberValue(weather, 'windKph') ?? numberValue(weather, 'wind');
    const humidity = numberValue(weather, 'humidity');

    this.precipitation = rain !== null
      ? normalizePercent(rain)
      : clamp(0.22 + syntheticIntensity * 0.58 + Math.sin(wrap01(phase + 0.11) * Math.PI * 2) * 0.14);
    this.weatherWind = wind !== null
      ? clamp(wind / 82)
      : clamp(0.18 + syntheticIntensity * 0.3 + Math.cos(wrap01(phase + 0.27) * Math.PI * 2) * 0.12);
    this.humidity = humidity !== null
      ? normalizePercent(humidity)
      : clamp(0.48 + syntheticIntensity * 0.28 + Math.sin(wrap01(phase + 0.42) * Math.PI * 2) * 0.1);
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
    this.globalIntensity = clamp(value, 0.04, 1.25);
  }

  setMaxBrightness(value: number): void {
    this.maxBrightness = clamp(value, 0.08, 0.85);
  }

  setWind(value: number): void {
    this.manualWind = clamp(value, 0, 1);
  }

  setSpeed(value: number): void {
    this.manualSpeed = clamp(value, 0, 1);
  }

  setTrailLength(value: number): void {
    this.trailLength = clamp(value, 0, 1);
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
    const wind = (stats.wind - 0.5) * 2;
    return this.streaks.slice(0, count).map((streak) => {
      const depthSpeed = 0.58 + streak.depth * 1.22;
      const fall = wrap01(streak.baseY + this.elapsed * streak.fallSpeed * depthSpeed * (0.35 + stats.precipitation));
      const gust = Math.sin((fall + streak.phase + this.elapsed * 0.09) * Math.PI * 2) * 0.08;
      const x = wrap01(streak.baseX + (wind + streak.slant + gust) * this.elapsed * 0.16 * streak.depth) * this.width;
      const y = fall * this.height;
      const velocityY = (220 + 560 * depthSpeed * (0.45 + this.manualSpeed)) * (0.72 + stats.precipitation * 0.6);
      const velocityX = (wind * 180 + streak.slant * 120) * (0.45 + this.trailLength);
      const alpha = clamp((0.1 + streak.depth * 0.46 + this.humidity * 0.12) * stats.brightness, 0, this.maxBrightness);
      const color = this.humidity > 0.82 ? 0xbfdbfe : 0xe0f2fe;
      return {
        position: { x, y },
        velocity: { x: velocityX, y: velocityY },
        size: streak.size * (0.72 + streak.depth * 0.6 + this.trailLength * 0.42),
        color,
        alpha,
      };
    });
  }

  stats(): RainStreaksStats {
    const sleepScale = this.sleepMode ? 0.22 : 1;
    const lowMotionScale = this.lowMotion ? 0.34 : 1;
    const brightness = (0.2 + this.precipitation * 0.5 + this.humidity * 0.14) * this.globalIntensity * sleepScale;
    return {
      precipitation: this.precipitation,
      wind: clamp((this.weatherWind + this.manualWind) * 0.5),
      humidity: this.humidity,
      brightness: clamp(brightness, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.34 + this.precipitation * 0.58 + this.manualSpeed * 0.32) * this.globalIntensity,
      streakCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): RainStreaksSnapshot {
    const stats = this.stats();
    return {
      weather: {
        precipitation: Number(stats.precipitation.toFixed(3)),
        wind: Number(stats.wind.toFixed(3)),
        humidity: Number(stats.humidity.toFixed(3)),
      },
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      streaks: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        vx: Number(particle.velocity.x.toFixed(3)),
        vy: Number(particle.velocity.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.24 : 1;
    const motion = this.lowMotion ? 0.54 : 1;
    const rain = 0.3 + this.precipitation * 0.7;
    return Math.max(10, Math.min(this.streaks.length, Math.round(this.streaks.length * sleep * motion * rain)));
  }
}
