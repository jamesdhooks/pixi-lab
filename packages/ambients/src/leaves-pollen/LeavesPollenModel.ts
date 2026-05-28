import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface LeavesPollenModelOptions {
  seed: number;
  width: number;
  height: number;
  particleCount: number;
  maxBrightness: number;
}

interface Drifter {
  baseX: number;
  baseY: number;
  fallSpeed: number;
  sway: number;
  size: number;
  depth: number;
  phase: number;
  kind: number;
}

export interface LeavesPollenStats {
  seasonality: number;
  pollen: number;
  wind: number;
  brightness: number;
  motionScale: number;
  particleCount: number;
  width: number;
  height: number;
}

export interface LeavesPollenSnapshot {
  seasonal: {
    seasonality: number;
    pollen: number;
    wind: number;
  };
  brightness: number;
  motionScale: number;
  particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: number }>;
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

export class LeavesPollenModel {
  private width: number;
  private height: number;
  private readonly drifters: Drifter[];
  private maxBrightness: number;
  private seasonality = 0.62;
  private pollen = 0.44;
  private weatherWind = 0.28;
  private manualBreeze = 0.48;
  private driftSpeed = 0.52;
  private pollenMix = 0.46;
  private elapsed = 0;
  private globalIntensity = 1;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: LeavesPollenModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.9);
    const count = Math.max(24, Math.floor(options.particleCount));
    const rng = new SeededRng(options.seed);
    this.drifters = Array.from({ length: count }, () => ({
      baseX: rng.next(),
      baseY: rng.next(),
      fallSpeed: rng.range(0.035, 0.24),
      sway: rng.range(0.08, 0.42),
      size: rng.range(1.2, 6.8),
      depth: rng.range(0.18, 1),
      phase: rng.next(),
      kind: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const weather = snapshots.find((snapshot) => snapshot.source === 'weather');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'dayProgress') ?? 0.58;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.52;

    const pollen = numberValue(weather, 'pollen') ?? numberValue(weather, 'pollenIndex') ?? numberValue(synthetic, 'pollen');
    const wind = numberValue(weather, 'windKph') ?? numberValue(weather, 'wind');
    const season = numberValue(time, 'seasonProgress') ?? numberValue(synthetic, 'seasonProgress') ?? numberValue(synthetic, 'seasonality');

    this.seasonality = season !== null
      ? normalizePercent(season)
      : clamp(0.48 + syntheticIntensity * 0.28 + Math.sin(wrap01(phase + 0.18) * Math.PI * 2) * 0.18);
    this.pollen = pollen !== null
      ? normalizePercent(pollen)
      : clamp(0.22 + syntheticIntensity * 0.48 + Math.cos(wrap01(phase + 0.33) * Math.PI * 2) * 0.16);
    this.weatherWind = wind !== null
      ? clamp(wind / 72)
      : clamp(0.16 + syntheticIntensity * 0.32 + Math.sin(wrap01(phase + 0.61) * Math.PI * 2) * 0.14);
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
    this.maxBrightness = clamp(value, 0.08, 0.9);
  }

  setBreeze(value: number): void {
    this.manualBreeze = clamp(value, 0, 1);
  }

  setDriftSpeed(value: number): void {
    this.driftSpeed = clamp(value, 0, 1);
  }

  setPollenMix(value: number): void {
    this.pollenMix = clamp(value, 0, 1);
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
    return this.drifters.slice(0, count).map((drifter) => {
      const isPollen = drifter.kind < this.pollenMix;
      const depthSpeed = 0.36 + drifter.depth * 1.1;
      const fall = wrap01(drifter.baseY + this.elapsed * drifter.fallSpeed * depthSpeed * (0.55 + this.driftSpeed));
      const swayWave = Math.sin((fall * 1.7 + drifter.phase + this.elapsed * 0.07) * Math.PI * 2);
      const sideDrift = wind * this.elapsed * (0.08 + drifter.depth * 0.12) + swayWave * drifter.sway;
      const x = wrap01(drifter.baseX + sideDrift) * this.width;
      const y = fall * this.height;
      const vy = (isPollen ? 16 : 46) + 120 * depthSpeed * (0.25 + this.driftSpeed) * (0.6 + this.seasonality * 0.4);
      const vx = wind * (18 + drifter.depth * 84) + swayWave * (isPollen ? 18 : 42);
      const brightness = stats.brightness * (isPollen ? 0.72 + this.pollen * 0.42 : 0.62 + this.seasonality * 0.5);
      const alpha = clamp(brightness * (0.38 + drifter.depth * 0.58), 0, this.maxBrightness);
      const leafColor = this.seasonality > 0.58 ? 0xf59e0b : 0x84cc16;
      const color = isPollen ? 0xfef08a : leafColor;
      return {
        position: { x, y },
        velocity: { x: vx, y: vy },
        size: drifter.size * (isPollen ? 0.46 : 0.86 + drifter.depth * 0.34),
        color,
        alpha,
      };
    });
  }

  stats(): LeavesPollenStats {
    const sleepScale = this.sleepMode ? 0.2 : 1;
    const lowMotionScale = this.lowMotion ? 0.36 : 1;
    const density = 0.36 + this.seasonality * 0.32 + this.pollen * 0.28;
    const brightness = (0.24 + density * 0.44) * this.globalIntensity * sleepScale;
    return {
      seasonality: this.seasonality,
      pollen: this.pollen,
      wind: clamp((this.weatherWind + this.manualBreeze) * 0.5),
      brightness: clamp(brightness, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.22 + this.driftSpeed * 0.46 + density * 0.34) * this.globalIntensity,
      particleCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): LeavesPollenSnapshot {
    const stats = this.stats();
    return {
      seasonal: {
        seasonality: Number(stats.seasonality.toFixed(3)),
        pollen: Number(stats.pollen.toFixed(3)),
        wind: Number(stats.wind.toFixed(3)),
      },
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      particles: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        vx: Number(particle.velocity.x.toFixed(3)),
        vy: Number(particle.velocity.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
        color: particle.color,
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.22 : 1;
    const motion = this.lowMotion ? 0.56 : 1;
    const seasonalDensity = 0.28 + this.seasonality * 0.34 + this.pollen * 0.38;
    return Math.max(8, Math.min(this.drifters.length, Math.round(this.drifters.length * sleep * motion * seasonalDensity)));
  }
}
