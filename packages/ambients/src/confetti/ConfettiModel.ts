import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface ConfettiModelOptions {
  seed: number;
  width: number;
  height: number;
  pieceCount: number;
  maxBrightness: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  drift: number;
  fall: number;
  size: number;
  phase: number;
  spin: number;
  colorIndex: number;
  depth: number;
}

export interface ConfettiStats {
  celebration: number;
  gravity: number;
  spread: number;
  brightness: number;
  motionScale: number;
  pieceCount: number;
  width: number;
  height: number;
}

export interface ConfettiSnapshot {
  celebration: number;
  gravity: number;
  spread: number;
  brightness: number;
  motionScale: number;
  pieces: Array<{ x: number; y: number; size: number; alpha: number }>;
}

const COLORS = [0xf43f5e, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6, 0xec4899] as const;

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

export class ConfettiModel {
  private width: number;
  private height: number;
  private readonly pieces: ConfettiPiece[];
  private maxBrightness: number;
  private elapsed = 0;
  private celebration = 0.54;
  private manualBurst = 0.58;
  private gravity = 0.5;
  private spread = 0.62;
  private globalIntensity = 0.72;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: ConfettiModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.9);
    const count = Math.max(24, Math.floor(options.pieceCount));
    const rng = new SeededRng(options.seed);
    this.pieces = Array.from({ length: count }, () => ({
      x: rng.next(),
      y: rng.next(),
      drift: rng.range(-1, 1),
      fall: rng.range(0.18, 1),
      size: rng.range(2.2, 7.8),
      phase: rng.next(),
      spin: rng.range(0.4, 2.4),
      colorIndex: Math.floor(rng.range(0, COLORS.length)),
      depth: rng.range(0.35, 1),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const tasks = snapshots.find((snapshot) => snapshot.source === 'tasks');
    const calendar = snapshots.find((snapshot) => snapshot.source === 'calendar');
    const presence = snapshots.find((snapshot) => snapshot.source === 'presence');
    const phase = numberValue(synthetic, 'phase') ?? 0.31;
    const syntheticIntensity = numberValue(synthetic, 'intensity') ?? 0.48;
    const completed = numberValue(tasks, 'completed') ?? numberValue(tasks, 'completion') ?? numberValue(calendar, 'completed');
    const eventPulse = numberValue(calendar, 'celebration') ?? numberValue(calendar, 'eventPulse') ?? numberValue(presence, 'activity');
    const sleep = boolValue(synthetic, 'sleepMode') ?? boolValue(calendar, 'sleepMode') ?? boolValue(presence, 'sleepMode');

    const wave = 0.5 + Math.sin(wrap01(phase + 0.12) * Math.PI * 2) * 0.5;
    const completionSignal = completed !== null ? normalizePercent(completed) : 0;
    const eventSignal = eventPulse !== null ? normalizePercent(eventPulse) : 0;
    this.celebration = clamp(0.22 + syntheticIntensity * 0.28 + wave * 0.18 + completionSignal * 0.22 + eventSignal * 0.2);
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
    this.maxBrightness = clamp(value, 0.08, 0.9);
  }

  setBurst(value: number): void {
    this.manualBurst = clamp(value);
  }

  setGravity(value: number): void {
    this.gravity = clamp(value);
  }

  setSpread(value: number): void {
    this.spread = clamp(value);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const visible = this.visibleCount();
    return this.pieces.slice(0, visible).map((piece) => {
      const fallSpeed = (0.025 + piece.fall * 0.1) * (0.35 + stats.gravity * 1.25);
      const driftSpeed = (piece.drift * 0.08 + Math.sin((this.elapsed + piece.phase) * Math.PI * 2) * 0.035) * stats.spread;
      const x = wrap01(piece.x + this.elapsed * driftSpeed) * this.width;
      const y = wrap01(piece.y + this.elapsed * fallSpeed + Math.sin((this.elapsed * piece.spin + piece.phase) * Math.PI * 2) * 0.018) * this.height;
      const twirl = 0.5 + Math.sin((this.elapsed * piece.spin + piece.phase) * Math.PI * 2) * 0.5;
      const alpha = clamp((0.18 + twirl * 0.44 + stats.celebration * 0.22) * stats.brightness * piece.depth, 0, this.maxBrightness);
      const color = COLORS[piece.colorIndex] ?? COLORS[0];
      return {
        position: { x, y },
        velocity: { x: driftSpeed * this.width, y: fallSpeed * this.height },
        size: piece.size * (0.72 + piece.depth * 0.42 + twirl * 0.22),
        color,
        alpha,
      };
    });
  }

  stats(): ConfettiStats {
    const sleepScale = this.sleepMode ? 0.12 : 1;
    const lowMotionScale = this.lowMotion ? 0.3 : 1;
    const celebration = clamp((this.celebration * 0.62) + (this.manualBurst * 0.38));
    const brightness = (0.2 + celebration * 0.62) * this.globalIntensity * sleepScale;
    return {
      celebration,
      gravity: this.gravity,
      spread: this.spread,
      brightness: clamp(brightness, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.2 + celebration * 0.6 + this.gravity * 0.22),
      pieceCount: this.visibleCount(),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): ConfettiSnapshot {
    const stats = this.stats();
    return {
      celebration: Number(stats.celebration.toFixed(3)),
      gravity: Number(stats.gravity.toFixed(3)),
      spread: Number(stats.spread.toFixed(3)),
      brightness: Number(stats.brightness.toFixed(5)),
      motionScale: Number(stats.motionScale.toFixed(5)),
      pieces: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
      })),
    };
  }

  private visibleCount(): number {
    const sleep = this.sleepMode ? 0.18 : 1;
    const motion = this.lowMotion ? 0.42 : 1;
    const celebration = clamp((this.celebration * 0.62) + (this.manualBurst * 0.38));
    const activity = 0.22 + celebration * 0.78;
    return Math.max(8, Math.min(this.pieces.length, Math.round(this.pieces.length * sleep * motion * activity)));
  }
}
