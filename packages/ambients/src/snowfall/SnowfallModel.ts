import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface SnowfallModelOptions {
  seed: number;
  width: number;
  height: number;
  flakeCount: number;
  maxBrightness: number;
}

interface Snowflake {
  baseX: number;
  baseY: number;
  fallSpeed: number;
  sway: number;
  size: number;
  depth: number;
  phase: number;
}

export interface SnowfallStats {
  temperatureC: number;
  precipitation: number;
  wind: number;
  brightness: number;
  motionScale: number;
  flakeCount: number;
  width: number;
  height: number;
}

export interface SnowfallSnapshot {
  weather: {
    temperatureC: number;
    precipitation: number;
    wind: number;
  };
  brightness: number;
  motionScale: number;
  flakes: Array<{ x: number; y: number; size: number; alpha: number }>;
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

export class SnowfallModel {
  private width: number;
  private height: number;
  private readonly flakes: Snowflake[];
  private maxBrightness: number;
  private temperatureC = -3;
  private precipitation = 0.46;
  private weatherWind = 0.22;
  private manualWind = 0.34;
  private elapsed = 0;
  private globalIntensity = 1;
  private depthDrift = 0.58;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: SnowfallModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.9);
    const count = Math.max(24, Math.floor(options.flakeCount));
    const rng = new SeededRng(options.seed);
    this.flakes = Array.from({ length: count }, () => ({
      baseX: rng.next(),
      baseY: rng.next(),
      fallSpeed: rng.range(0.018, 0.14),
      sway: rng.range(-0.22, 0.22),
      size: rng.range(1.2, 5.8),
      depth: rng.range(0.24, 1),
      phase: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const weather = snapshots.find((snapshot) => snapshot.source === 'weather');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const phase = numberValue(synthetic, 'phase') ?? 0.72;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.42;

    const temperature = numberValue(weather, 'temperatureC') ?? numberValue(weather, 'temperature');
    const precipitation = numberValue(weather, 'snow') ?? numberValue(weather, 'precipitation') ?? numberValue(weather, 'rain');
    const wind = numberValue(weather, 'windKph') ?? numberValue(weather, 'wind');

    if (temperature !== null) {
      this.temperatureC = Math.max(-40, Math.min(18, temperature));
    } else {
      this.temperatureC = -5 + Math.sin(wrap01(phase) * Math.PI * 2) * 5;
    }

    this.precipitation = precipitation !== null
      ? normalizePercent(precipitation)
      : clamp(0.18 + syntheticIntensity * 0.62 + Math.cos(wrap01(phase + 0.08) * Math.PI * 2) * 0.12);
    this.weatherWind = wind !== null
      ? clamp(wind / 72)
      : clamp(0.14 + syntheticIntensity * 0.26 + Math.sin(wrap01(phase + 0.2) * Math.PI * 2) * 0.1);
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
    this.maxBrightness = clamp(value, 0.08, 0.9);
  }

  setWind(value: number): void {
    this.manualWind = clamp(value, 0, 1);
  }

  setDepthDrift(value: number): void {
    this.depthDrift = clamp(value, 0, 1);
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
    return this.flakes.slice(0, count).map((flake) => {
      const depthSpeed = 0.55 + flake.depth * 0.9;
      const fall = wrap01(flake.baseY + this.elapsed * flake.fallSpeed * depthSpeed * (0.52 + stats.precipitation));
      const swirl = Math.sin((fall + flake.phase + this.elapsed * 0.035) * Math.PI * 2) * flake.sway;
      const drift = wind * this.depthDrift * flake.depth * this.elapsed * 0.08;
      const x = wrap01(flake.baseX + drift + swirl * 0.08) * this.width;
      const y = fall * this.height;
      const alpha = clamp((0.14 + flake.depth * 0.52) * stats.brightness, 0, this.maxBrightness);
      const coldTint = this.temperatureC < -8 ? 0xdbeafe : 0xf8fafc;
      return {
        position: { x, y },
        velocity: { x: wind * 18 * flake.depth, y: flake.fallSpeed * this.height },
        size: flake.size * (0.72 + flake.depth * 0.48),
        color: coldTint,
        alpha,
      };
    });
  }

  stats(): SnowfallStats {
    const sleepScale = this.sleepMode ? 0.24 : 1;
    const lowMotionScale = this.lowMotion ? 0.32 : 1;
    const coldBoost = clamp((6 - this.temperatureC) / 18, 0.2, 1);
    const brightness = (0.28 + this.precipitation * 0.44 + coldBoost * 0.16) * this.globalIntensity * sleepScale;
    return {
      temperatureC: this.temperatureC,
      precipitation: this.precipitation,
      wind: clamp((this.weatherWind + this.manualWind) * 0.5),
      brightness: clamp(brightness, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.42 + this.precipitation * 0.48 + this.weatherWind * 0.25) * this.globalIntensity,
      flakeCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): SnowfallSnapshot {
    const stats = this.stats();
    return {
      weather: {
        temperatureC: Number(stats.temperatureC.toFixed(3)),
        precipitation: Number(stats.precipitation.toFixed(3)),
        wind: Number(stats.wind.toFixed(3)),
      },
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      flakes: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.28 : 1;
    const motion = this.lowMotion ? 0.58 : 1;
    const snow = 0.38 + this.precipitation * 0.62;
    return Math.max(10, Math.min(this.flakes.length, Math.round(this.flakes.length * sleep * motion * snow)));
  }
}
