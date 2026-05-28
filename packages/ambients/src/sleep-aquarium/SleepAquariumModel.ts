import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface SleepAquariumModelOptions {
  seed: number;
  width: number;
  height: number;
  fishCount: number;
  bubbleCount: number;
  maxBrightness: number;
}

interface AquariumFish {
  lane: number;
  phase: number;
  speed: number;
  depth: number;
  size: number;
  hue: number;
  direction: number;
}

interface AquariumBubble {
  x: number;
  y: number;
  speed: number;
  drift: number;
  size: number;
  phase: number;
}

export interface SleepAquariumStats {
  fishCount: number;
  bubbleCount: number;
  visibleParticles: number;
  circadianPhase: number;
  dreamIntensity: number;
  currentStrength: number;
  brightness: number;
  motionScale: number;
  width: number;
  height: number;
}

export interface SleepAquariumSnapshot {
  stats: SleepAquariumStats;
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

function normalizePercent(value: number): number {
  return value > 1 ? clamp(value / 100) : clamp(value);
}

export class SleepAquariumModel {
  private width: number;
  private height: number;
  private readonly fish: AquariumFish[];
  private readonly bubbles: AquariumBubble[];
  private maxBrightness: number;
  private elapsed = 0;
  private circadianPhase = 0.86;
  private dreamIntensity = 0.42;
  private currentStrength = 0.42;
  private globalIntensity = 0.68;
  private sleepMode = true;
  private lowMotion = false;

  constructor(options: SleepAquariumModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.7);
    const rng = new SeededRng(options.seed);
    const fishCount = Math.max(8, Math.floor(options.fishCount));
    const bubbleCount = Math.max(4, Math.floor(options.bubbleCount));
    this.fish = Array.from({ length: fishCount }, () => ({
      lane: rng.range(0.14, 0.88),
      phase: rng.next(),
      speed: rng.range(0.018, 0.072),
      depth: rng.range(0.32, 1),
      size: rng.range(2.2, 8.6),
      hue: rng.next(),
      direction: rng.next() > 0.5 ? 1 : -1,
    }));
    this.bubbles = Array.from({ length: bubbleCount }, () => ({
      x: rng.next(),
      y: rng.next(),
      speed: rng.range(0.018, 0.09),
      drift: rng.range(-0.05, 0.05),
      size: rng.range(1.1, 4.2),
      phase: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const phase = numberValue(time, 'phase') ?? numberValue(synthetic, 'phase');
    const hour = numberValue(time, 'hour');
    const intensity = numberValue(synthetic, 'intensity') ?? numberValue(time, 'intensity');
    const sleep = boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    if (phase !== null) {
      this.circadianPhase = wrap01(phase);
    } else if (hour !== null) {
      this.circadianPhase = wrap01(hour / 24);
    }

    if (intensity !== null) {
      this.dreamIntensity = normalizePercent(intensity);
    } else {
      const nightBias = 1 - Math.abs(this.circadianPhase - 0.5) * 2;
      this.dreamIntensity = clamp(0.24 + nightBias * 0.28);
    }

    if (sleep !== null) {
      this.sleepMode = sleep;
    }
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
    this.maxBrightness = clamp(value, 0.08, 0.7);
  }

  setCurrentStrength(value: number): void {
    this.currentStrength = clamp(value, 0, 1);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const fishCount = this.visibleFishCount();
    const bubbleCount = this.visibleBubbleCount();
    const fishParticles = this.fish.slice(0, fishCount).map((fish, index) => {
      const swim = wrap01(fish.phase + this.elapsed * fish.speed * fish.direction * (0.45 + stats.currentStrength));
      const x = (fish.direction > 0 ? swim : 1 - swim) * this.width;
      const wave = Math.sin((swim + fish.lane + this.elapsed * 0.06) * Math.PI * 2) * 0.045 * stats.currentStrength;
      const y = clamp(fish.lane + wave, 0.06, 0.94) * this.height;
      const palette = [0x67e8f9, 0x93c5fd, 0xc4b5fd, 0x99f6e4, 0xf0abfc];
      const color = palette[(Math.floor(fish.hue * palette.length) + index) % palette.length];
      return {
        position: { x, y },
        velocity: { x: fish.direction * fish.speed * this.width, y: wave * 10 },
        size: fish.size * (0.62 + fish.depth * 0.55),
        color,
        alpha: clamp((0.18 + fish.depth * 0.46) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });

    const bubbleParticles = this.bubbles.slice(0, bubbleCount).map((bubble) => {
      const rise = wrap01(bubble.y - this.elapsed * bubble.speed * (0.35 + stats.currentStrength));
      const sway = Math.sin((rise + bubble.phase + this.elapsed * 0.05) * Math.PI * 2) * 0.035 * stats.currentStrength;
      const x = wrap01(bubble.x + bubble.drift * this.elapsed + sway) * this.width;
      const y = rise * this.height;
      return {
        position: { x, y },
        velocity: { x: bubble.drift * this.width, y: -bubble.speed * this.height },
        size: bubble.size * (0.8 + stats.dreamIntensity * 0.6),
        color: 0xbfdbfe,
        alpha: clamp((0.12 + stats.dreamIntensity * 0.24) * stats.brightness, 0, this.maxBrightness * 0.82),
      } satisfies SimParticle;
    });

    return [...fishParticles, ...bubbleParticles];
  }

  stats(): SleepAquariumStats {
    const sleepScale = this.sleepMode ? 0.38 : 1;
    const lowMotionScale = this.lowMotion ? 0.32 : 1;
    const night = this.circadianPhase >= 0.72 || this.circadianPhase <= 0.22 ? 1 : 0.58;
    const brightness = clamp((0.34 + this.dreamIntensity * 0.34) * this.globalIntensity * night * (this.sleepMode ? 0.72 : 1), 0, this.maxBrightness);
    const motionScale = sleepScale * lowMotionScale * (0.18 + this.currentStrength * 0.64) * (0.65 + this.dreamIntensity * 0.35);
    const fishCount = this.visibleFishCount();
    const bubbleCount = this.visibleBubbleCount();
    return {
      fishCount,
      bubbleCount,
      visibleParticles: fishCount + bubbleCount,
      circadianPhase: this.circadianPhase,
      dreamIntensity: this.dreamIntensity,
      currentStrength: this.currentStrength,
      brightness,
      motionScale,
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): SleepAquariumSnapshot {
    const stats = this.stats();
    return {
      stats: {
        ...stats,
        circadianPhase: Number(stats.circadianPhase.toFixed(4)),
        dreamIntensity: Number(stats.dreamIntensity.toFixed(4)),
        currentStrength: Number(stats.currentStrength.toFixed(4)),
        brightness: Number(stats.brightness.toFixed(5)),
        motionScale: Number(stats.motionScale.toFixed(5)),
      },
      particles: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(4)),
        color: particle.color,
      })),
    };
  }

  private visibleFishCount(): number {
    const sleep = this.sleepMode ? 0.52 : 1;
    const motion = this.lowMotion ? 0.62 : 1;
    const dream = 0.56 + this.dreamIntensity * 0.44;
    return Math.max(4, Math.min(this.fish.length, Math.round(this.fish.length * sleep * motion * dream)));
  }

  private visibleBubbleCount(): number {
    const sleep = this.sleepMode ? 0.44 : 1;
    const motion = this.lowMotion ? 0.55 : 1;
    const current = 0.42 + this.currentStrength * 0.58;
    return Math.max(3, Math.min(this.bubbles.length, Math.round(this.bubbles.length * sleep * motion * current)));
  }
}
