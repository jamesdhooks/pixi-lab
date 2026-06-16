import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface HomeWeatherGlassModelOptions {
  seed: number;
  width: number;
  height: number;
  dropletCount: number;
  maxBrightness: number;
}

interface WeatherDroplet {
  baseX: number;
  baseY: number;
  fallSpeed: number;
  drift: number;
  size: number;
  depth: number;
  phase: number;
}

export interface HomeWeatherGlassStats {
  temperatureC: number;
  humidity: number;
  precipitation: number;
  cloudCover: number;
  wind: number;
  brightness: number;
  motionScale: number;
  dropletCount: number;
  width: number;
  height: number;
}

export interface HomeWeatherGlassSnapshot {
  weather: {
    temperatureC: number;
    humidity: number;
    precipitation: number;
    cloudCover: number;
    wind: number;
  };
  brightness: number;
  motionScale: number;
  droplets: Array<{ x: number; y: number; size: number; alpha: number }>;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function numberValue(snapshot: AmbientDataSnapshot | undefined, key: string): number | null {
  const value = snapshot?.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function normalizePercent(value: number): number {
  return value > 1 ? clamp(value / 100) : clamp(value);
}

export class HomeWeatherGlassModel {
  private width: number;
  private height: number;
  private readonly droplets: WeatherDroplet[];
  private maxBrightness: number;
  private temperatureC = 18;
  private humidity = 0.54;
  private precipitation = 0.28;
  private cloudCover = 0.42;
  private wind = 0.34;
  private elapsed = 0;
  private globalIntensity = 1;
  private glassBlur = 0.46;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: HomeWeatherGlassModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.12, 0.85);
    const count = Math.max(16, Math.floor(options.dropletCount));
    const rng = new SeededRng(options.seed);
    this.droplets = Array.from({ length: count }, () => ({
      baseX: rng.next(),
      baseY: rng.next(),
      fallSpeed: rng.range(0.035, 0.22),
      drift: rng.range(-0.18, 0.18),
      size: rng.range(1.2, 6.8),
      depth: rng.range(0.28, 1),
      phase: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const weather = snapshots.find((snapshot) => snapshot.source === 'weather');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const phase = numberValue(synthetic, 'phase') ?? 0.35;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.38;

    const temperature = numberValue(weather, 'temperatureC') ?? numberValue(weather, 'temperature');
    const humidity = numberValue(weather, 'humidity');
    const precipitation = numberValue(weather, 'precipitation') ?? numberValue(weather, 'rain');
    const cloudCover = numberValue(weather, 'cloudCover') ?? numberValue(weather, 'clouds');
    const wind = numberValue(weather, 'windKph') ?? numberValue(weather, 'wind');

    if (temperature !== null) {
      this.temperatureC = Math.max(-30, Math.min(48, temperature));
    } else {
      const cycle = Math.sin(wrap01(phase) * Math.PI * 2);
      this.temperatureC = 16 + cycle * 8;
    }

    this.humidity = humidity !== null ? normalizePercent(humidity) : clamp(0.45 + syntheticIntensity * 0.4);
    this.precipitation = precipitation !== null ? normalizePercent(precipitation) : clamp(0.12 + syntheticIntensity * 0.55);
    this.cloudCover = cloudCover !== null ? normalizePercent(cloudCover) : clamp(0.28 + Math.sin(wrap01(phase + 0.18) * Math.PI * 2) * 0.18 + syntheticIntensity * 0.32);
    this.wind = wind !== null ? clamp(wind / 64) : clamp(0.22 + Math.cos(wrap01(phase + 0.1) * Math.PI * 2) * 0.12 + syntheticIntensity * 0.28);
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
    this.maxBrightness = clamp(value, 0.12, 0.85);
  }

  setGlassBlur(value: number): void {
    this.glassBlur = clamp(value, 0, 1);
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
    const rainTint = this.temperatureC <= 0 ? 0xdbeafe : 0x93c5fd;
    const warmTint = this.temperatureC >= 24 ? 0xfef3c7 : 0xbfdbfe;
    return this.droplets.slice(0, count).map((droplet, index) => {
      const fall = wrap01(droplet.baseY + this.elapsed * droplet.fallSpeed * (0.45 + stats.precipitation));
      const sway = Math.sin((fall + droplet.phase) * Math.PI * 2) * 0.025 * stats.wind;
      const x = wrap01(droplet.baseX + this.elapsed * droplet.drift * stats.wind + sway) * this.width;
      const y = fall * this.height;
      const alpha = clamp(
        (0.12 + droplet.depth * 0.54) * stats.brightness * (0.55 + stats.precipitation * 0.72),
        0,
        this.maxBrightness,
      );
      const color = index % 5 === 0 ? warmTint : rainTint;
      return {
        position: { x, y },
        velocity: { x: droplet.drift * stats.wind * 24, y: droplet.fallSpeed * this.height },
        size: droplet.size * (0.65 + stats.precipitation * 0.72 + this.glassBlur * 0.28),
        color,
        alpha,
      };
    });
  }

  stats(): HomeWeatherGlassStats {
    const sleepScale = this.sleepMode ? 0.28 : 1;
    const lowMotionScale = this.lowMotion ? 0.36 : 1;
    const weatherBrightness = 0.26 + this.humidity * 0.22 + this.precipitation * 0.34 + (1 - this.cloudCover) * 0.16;
    return {
      temperatureC: this.temperatureC,
      humidity: this.humidity,
      precipitation: this.precipitation,
      cloudCover: this.cloudCover,
      wind: this.wind,
      brightness: clamp(weatherBrightness * this.globalIntensity * sleepScale, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.35 + this.wind * 0.65) * this.globalIntensity,
      dropletCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): HomeWeatherGlassSnapshot {
    const stats = this.stats();
    return {
      weather: {
        temperatureC: Number(stats.temperatureC.toFixed(3)),
        humidity: Number(stats.humidity.toFixed(3)),
        precipitation: Number(stats.precipitation.toFixed(3)),
        cloudCover: Number(stats.cloudCover.toFixed(3)),
        wind: Number(stats.wind.toFixed(3)),
      },
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      droplets: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.34 : 1;
    const motion = this.lowMotion ? 0.62 : 1;
    const rain = 0.42 + this.precipitation * 0.58;
    return Math.max(12, Math.min(this.droplets.length, Math.round(this.droplets.length * sleep * motion * rain)));
  }
}
