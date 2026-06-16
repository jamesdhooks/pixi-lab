import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface TuringSkinModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  feedRate: number;
  killRate: number;
  diffusionA: number;
  diffusionB: number;
  brushStrength: number;
}

export interface TuringSkinStats {
  columns: number;
  rows: number;
  fieldMean: number;
  fieldVariance: number;
  fieldMax: number;
  reagentMean: number;
  reactionEnergy: number;
}

export class TuringSkinModel {
  readonly pigmentField: ScalarField;
  readonly reagentA: Float32Array;
  readonly reagentB: Float32Array;
  private nextA: Float32Array;
  private nextB: Float32Array;
  private rng: SeededRng;
  private stagnantMs = 0;
  private reactionEnergy = 0;

  constructor(private readonly options: TuringSkinModelOptions) {
    const size = options.columns * options.rows;
    this.pigmentField = new ScalarField(options.columns, options.rows);
    this.reagentA = new Float32Array(size);
    this.reagentB = new Float32Array(size);
    this.nextA = new Float32Array(size);
    this.nextB = new Float32Array(size);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.stagnantMs = 0;
    this.reactionEnergy = 0;
    this.reagentA.fill(1);
    this.reagentB.fill(0);
    this.pigmentField.fill(0);
    const spots = Math.max(8, Math.round((this.options.columns * this.options.rows) / 420));
    for (let i = 0; i < spots; i++) {
      this.inject(this.rng.range(0, this.options.width), this.rng.range(0, this.options.height), this.rng.range(18, 52), this.rng.range(0.45, 1));
    }
    this.projectPigment();
  }

  update(dt: number): void {
    const steps = Math.max(1, Math.min(4, Math.ceil(dt * 90)));
    const subDt = Math.max(0.08, Math.min(1, (dt * 60) / steps));
    for (let i = 0; i < steps; i++) this.step(subDt);
    this.projectPigment();
  }

  handleGesture(event: GestureEvent): void {
    const radius = event.kind === 'fast_swipe' ? 92 : event.kind === 'drag' ? 58 : event.kind === 'hold' ? 72 : 44;
    const strength = this.options.brushStrength * (event.kind === 'hold' ? -0.55 : event.kind === 'fast_swipe' ? 1.35 : 1);
    this.inject(event.x, event.y, radius, strength);
    if (event.kind === 'drag' || event.kind === 'fast_swipe') {
      this.inject(event.x + (event.dx ?? 0) * 0.18, event.y + (event.dy ?? 0) * 0.18, radius * 0.72, strength * 0.75);
    }
    this.projectPigment();
  }

  setFeedRate(value: number): void { this.options.feedRate = value; }
  setKillRate(value: number): void { this.options.killRate = value; }
  setDiffusionA(value: number): void { this.options.diffusionA = value; }
  setDiffusionB(value: number): void { this.options.diffusionB = value; }
  setBrushStrength(value: number): void { this.options.brushStrength = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.fieldVariance < 0.000004 || stats.reactionEnergy < 0.000003;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1400,
      reason: stagnant ? 'turing reaction field lost pigment variance or reaction energy' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4200) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const bursts = 5;
    for (let i = 0; i < bursts; i++) {
      this.inject(this.rng.range(0, this.options.width), this.rng.range(0, this.options.height), this.rng.range(36, 84), this.rng.range(0.65, 1.45));
    }
    this.stagnantMs = 0;
    this.projectPigment();
  }

  stats(): TuringSkinStats {
    const field = this.pigmentField.stats();
    let meanA = 0;
    for (let i = 0; i < this.reagentA.length; i++) meanA += this.reagentA[i];
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      fieldMean: field.mean,
      fieldVariance: field.variance,
      fieldMax: field.max,
      reagentMean: meanA / Math.max(1, this.reagentA.length),
      reactionEnergy: this.reactionEnergy,
    };
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.reagentB.length / 48));
    for (let i = 0; i < this.reagentB.length && sample.length < 48; i += stride) sample.push(Number(this.reagentB[i].toFixed(4)));
    return sample;
  }

  collapseForTest(): void {
    this.reagentA.fill(1);
    this.reagentB.fill(0);
    this.pigmentField.fill(0);
    this.reactionEnergy = 0;
  }

  private step(dt: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    let energy = 0;
    for (let y = 0; y < r; y++) {
      const ym = y === 0 ? r - 1 : y - 1;
      const yp = y === r - 1 ? 0 : y + 1;
      for (let x = 0; x < c; x++) {
        const xm = x === 0 ? c - 1 : x - 1;
        const xp = x === c - 1 ? 0 : x + 1;
        const i = y * c + x;
        const a = this.reagentA[i];
        const b = this.reagentB[i];
        const lapA = this.reagentA[y * c + xm] + this.reagentA[y * c + xp] + this.reagentA[ym * c + x] + this.reagentA[yp * c + x] - 4 * a;
        const lapB = this.reagentB[y * c + xm] + this.reagentB[y * c + xp] + this.reagentB[ym * c + x] + this.reagentB[yp * c + x] - 4 * b;
        const reaction = a * b * b;
        const nextA = a + (this.options.diffusionA * lapA - reaction + this.options.feedRate * (1 - a)) * dt;
        const nextB = b + (this.options.diffusionB * lapB + reaction - (this.options.killRate + this.options.feedRate) * b) * dt;
        this.nextA[i] = Math.max(0, Math.min(1.2, nextA));
        this.nextB[i] = Math.max(0, Math.min(1.4, nextB));
        energy += Math.abs(reaction);
      }
    }
    this.reagentA.set(this.nextA);
    this.reagentB.set(this.nextB);
    this.reactionEnergy = energy / Math.max(1, this.reagentB.length);
  }

  private inject(px: number, py: number, radius: number, strength: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const gx = (px / Math.max(1, this.options.width)) * (c - 1);
    const gy = (py / Math.max(1, this.options.height)) * (r - 1);
    const gr = Math.max(1, (radius / Math.max(1, this.options.width)) * c);
    const minX = Math.max(0, Math.floor(gx - gr));
    const maxX = Math.min(c - 1, Math.ceil(gx + gr));
    const minY = Math.max(0, Math.floor(gy - gr));
    const maxY = Math.min(r - 1, Math.ceil(gy + gr));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - gx;
        const dy = y - gy;
        const d2 = dx * dx + dy * dy;
        if (d2 > gr * gr) continue;
        const falloff = 1 - d2 / (gr * gr);
        const i = y * c + x;
        this.reagentB[i] = Math.max(0, Math.min(1.25, this.reagentB[i] + falloff * strength * 0.72));
        this.reagentA[i] = Math.max(0, Math.min(1.05, this.reagentA[i] - Math.max(0, strength) * falloff * 0.18));
      }
    }
  }

  private projectPigment(): void {
    for (let i = 0; i < this.reagentB.length; i++) this.pigmentField.values[i] = Math.max(0, Math.min(1.6, this.reagentB[i]));
  }
}
