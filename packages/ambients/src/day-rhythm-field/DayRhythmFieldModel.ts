import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface DayRhythmFieldModelOptions {
  seed: number;
  width: number;
  height: number;
  particleCount: number;
  maxBrightness: number;
}

interface DayParticle {
  baseX: number;
  baseY: number;
  orbit: number;
  drift: number;
  phaseOffset: number;
  size: number;
  warmth: number;
}

export interface DayRhythmFieldStats {
  phase: number;
  brightness: number;
  motionScale: number;
  particleCount: number;
  width: number;
  height: number;
}

export interface DayRhythmFieldSnapshot {
  phase: number;
  brightness: number;
  motionScale: number;
  particles: Array<{ x: number; y: number; size: number; warmth: number }>;
}

const DAWN = [0xff8a4c, 0xffc36b, 0x84d4ff] as const;
const DAY = [0x7dd3fc, 0xfef3c7, 0x86efac] as const;
const DUSK = [0xfb7185, 0xc084fc, 0x60a5fa] as const;
const NIGHT = [0x1e3a8a, 0x7c3aed, 0xa7f3d0] as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (mixChannel(ar, br, t) << 16) | (mixChannel(ag, bg, t) << 8) | mixChannel(ab, bb, t);
}

function paletteForPhase(phase: number): readonly number[] {
  if (phase < 0.24) return NIGHT;
  if (phase < 0.38) return DAWN;
  if (phase < 0.68) return DAY;
  if (phase < 0.84) return DUSK;
  return NIGHT;
}

export class DayRhythmFieldModel {
  private width: number;
  private height: number;
  private readonly maxBrightness: number;
  private readonly targetCount: number;
  private readonly particles: DayParticle[];
  private phase = 0.5;
  private syntheticIntensity = 0.5;
  private elapsed = 0;
  private globalIntensity = 1;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: DayRhythmFieldModelOptions) {
    this.width = options.width;
    this.height = options.height;
    this.maxBrightness = clamp(options.maxBrightness, 0, 1);
    this.targetCount = Math.max(1, Math.floor(options.particleCount));
    const rng = new SeededRng(options.seed);
    this.particles = Array.from({ length: this.targetCount }, () => ({
      baseX: rng.next(),
      baseY: rng.next(),
      orbit: rng.range(4, 34),
      drift: rng.range(0.08, 0.42),
      phaseOffset: rng.next(),
      size: rng.range(1.1, 4.8),
      warmth: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    if (time) {
      const hour = typeof time.values.hour === 'number' ? time.values.hour : null;
      const minute = typeof time.values.minute === 'number' ? time.values.minute : 0;
      if (hour !== null) {
        this.phase = wrap01((hour + minute / 60) / 24);
      } else if (typeof time.values.phase === 'number') {
        this.phase = wrap01(time.values.phase);
      }
    } else if (synthetic && typeof synthetic.values.phase === 'number') {
      this.phase = wrap01(synthetic.values.phase);
    }
    if (synthetic && typeof synthetic.values.intensity === 'number') {
      this.syntheticIntensity = clamp(synthetic.values.intensity);
    }
  }

  update(dt: number): void {
    const safeDt = Math.max(0, Math.min(0.1, dt));
    this.elapsed += safeDt * this.stats().motionScale;
    if (!this.sleepMode) {
      this.phase = wrap01(this.phase + safeDt * 0.0025 * (this.lowMotion ? 0.25 : 1));
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  setGlobalIntensity(value: number): void {
    this.globalIntensity = clamp(value);
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
    const palette = paletteForPhase(stats.phase);
    const brightness = stats.brightness;
    return this.particles.slice(0, count).map((particle, index) => {
      const wave = this.elapsed * particle.drift + particle.phaseOffset * Math.PI * 2;
      const orbit = particle.orbit * stats.motionScale;
      const x = clamp(particle.baseX + Math.cos(wave) * orbit / this.width, 0, 1) * this.width;
      const y = clamp(particle.baseY + Math.sin(wave * 0.7) * orbit / this.height, 0, 1) * this.height;
      const paletteColor = palette[index % palette.length];
      const warmColor = mixColor(paletteColor, 0xffffff, particle.warmth * 0.18);
      return {
        position: { x, y },
        velocity: { x: Math.cos(wave) * particle.drift, y: Math.sin(wave) * particle.drift },
        size: particle.size * (this.sleepMode ? 0.72 : 1),
        color: warmColor,
        alpha: clamp((0.18 + particle.warmth * 0.47) * brightness, 0, this.maxBrightness),
      };
    });
  }

  stats(): DayRhythmFieldStats {
    const solar = 0.25 + 0.75 * Math.max(0, Math.sin(this.phase * Math.PI));
    const sleepScale = this.sleepMode ? 0.32 : 1;
    const lowMotionScale = this.lowMotion ? 0.38 : 1;
    const brightness = clamp(
      solar * (0.68 + this.syntheticIntensity * 0.32) * this.globalIntensity * sleepScale,
      0,
      this.maxBrightness,
    );
    return {
      phase: this.phase,
      brightness,
      motionScale: sleepScale * lowMotionScale * this.globalIntensity,
      particleCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): DayRhythmFieldSnapshot {
    const particles = this.renderParticles().map((particle) => ({
      x: Number(particle.position.x.toFixed(3)),
      y: Number(particle.position.y.toFixed(3)),
      size: Number(particle.size.toFixed(3)),
      warmth: Number((particle.alpha / Math.max(0.001, this.maxBrightness)).toFixed(3)),
    }));
    const stats = this.stats();
    return {
      phase: Number(stats.phase.toFixed(5)),
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      particles,
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.45 : 1;
    const motion = this.lowMotion ? 0.7 : 1;
    return Math.max(8, Math.min(this.targetCount, Math.round(this.targetCount * sleep * motion)));
  }
}
