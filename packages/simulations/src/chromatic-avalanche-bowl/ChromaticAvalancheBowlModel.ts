import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface ChromaticAvalancheBowlModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  grainCount: number;
  slopeAngle: number;
  friction: number;
  chromaMix: number;
  pourRate: number;
}

export interface ChromaticAvalancheBowlStats {
  columns: number;
  rows: number;
  grainCount: number;
  activeGrains: number;
  pileMean: number;
  pileVariance: number;
  chromaVariance: number;
  avalancheEnergy: number;
}

interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  radius: number;
  active: boolean;
}

export class ChromaticAvalancheBowlModel {
  readonly densityField: ScalarField;
  readonly chromaField: ScalarField;
  readonly motionField: ScalarField;
  readonly grains: Grain[] = [];
  private readonly pile: Float32Array;
  private readonly chroma: Float32Array;
  private rng: SeededRng;
  private stagnantMs = 0;
  private avalancheEnergy = 0;
  private pourAccumulator = 0;

  constructor(private readonly options: ChromaticAvalancheBowlModelOptions) {
    const size = options.columns * options.rows;
    this.densityField = new ScalarField(options.columns, options.rows);
    this.chromaField = new ScalarField(options.columns, options.rows);
    this.motionField = new ScalarField(options.columns, options.rows);
    this.pile = new Float32Array(size);
    this.chroma = new Float32Array(size);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.grains.length = 0;
    this.pile.fill(0);
    this.chroma.fill(0);
    this.motionField.fill(0);
    this.stagnantMs = 0;
    this.avalancheEnergy = 0;
    this.pourAccumulator = 0;
    const base = Math.min(this.options.grainCount, Math.max(24, Math.round(this.options.grainCount * 0.46)));
    for (let i = 0; i < base; i++) this.spawnGrain(this.rng.range(0.18, 0.82), this.rng.range(0.04, 0.32));
    this.projectFields();
  }

  update(dt: number): void {
    const clampedDt = Math.max(0.001, Math.min(0.05, dt));
    this.pourAccumulator += clampedDt * this.options.pourRate * 24;
    while (this.pourAccumulator >= 1 && this.grains.length < this.options.grainCount) {
      this.spawnGrain(this.rng.range(0.34, 0.66), this.rng.range(0.02, 0.1));
      this.pourAccumulator -= 1;
    }

    this.pile.fill(0);
    this.chroma.fill(0);
    this.motionField.values.fill(0);
    let energy = 0;
    const gravityX = Math.sin(this.options.slopeAngle) * 76;
    const gravityY = Math.cos(this.options.slopeAngle) * 118;
    const damping = Math.max(0.05, 1 - this.options.friction * 0.12);
    for (const grain of this.grains) {
      grain.vx = (grain.vx + gravityX * clampedDt * grain.radius) * damping;
      grain.vy = (grain.vy + gravityY * clampedDt * grain.radius) * damping;
      const bowl = this.bowlNormal(grain.x, grain.y);
      grain.vx += bowl.x * clampedDt * 92;
      grain.vy += bowl.y * clampedDt * 92;
      grain.x += grain.vx * clampedDt;
      grain.y += grain.vy * clampedDt;
      this.constrainToBowl(grain);
      energy += Math.hypot(grain.vx, grain.vy);
      this.deposit(grain, Math.hypot(grain.vx, grain.vy));
    }
    this.avalancheEnergy = energy / Math.max(1, this.grains.length);
    this.relaxPile(clampedDt);
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    const strength = event.kind === 'fast_swipe' ? 2.2 : event.kind === 'drag' ? 1.35 : event.kind === 'hold' ? 0.9 : 1.1;
    const radius = event.kind === 'fast_swipe' ? 124 : event.kind === 'hold' ? 86 : 64;
    if (event.kind === 'tap' || event.kind === 'hold') {
      const bursts = event.kind === 'hold' ? 18 : 28;
      for (let i = 0; i < bursts && this.grains.length < this.options.grainCount; i++) {
        this.spawnGrain(event.x / Math.max(1, this.options.width) + this.rng.range(-0.05, 0.05), event.y / Math.max(1, this.options.height) + this.rng.range(-0.05, 0.05));
      }
    }
    const dx = event.dx ?? this.rng.range(-120, 120);
    const dy = event.dy ?? this.rng.range(-80, 130);
    for (const grain of this.grains) {
      const dist = Math.hypot(grain.x - event.x, grain.y - event.y);
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      grain.vx += dx * 0.32 * falloff * strength;
      grain.vy += dy * 0.32 * falloff * strength - (event.kind === 'tap' ? 95 * falloff : 0);
      grain.hue = this.wrap01(grain.hue + this.options.chromaMix * 0.13 * falloff);
    }
    this.paintChroma(event.x, event.y, radius, strength);
    this.projectFields();
  }

  setSlopeAngle(value: number): void { this.options.slopeAngle = value; }
  setFriction(value: number): void { this.options.friction = value; }
  setChromaMix(value: number): void { this.options.chromaMix = value; }
  setPourRate(value: number): void { this.options.pourRate = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.activeGrains < 8 || stats.avalancheEnergy < 2.2 || stats.pileVariance < 0.00002 || stats.chromaVariance < 0.00002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1500,
      reason: stagnant ? 'chromatic grains settled into a low-motion flat pile' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4500) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const bursts = Math.min(90, Math.max(24, Math.round(this.options.grainCount * 0.12)));
    for (let i = 0; i < bursts; i++) {
      if (this.grains.length < this.options.grainCount) this.spawnGrain(this.rng.range(0.28, 0.72), this.rng.range(0.04, 0.22));
      const grain = this.grains[Math.floor(this.rng.next() * this.grains.length)];
      if (!grain) continue;
      grain.vx += this.rng.range(-210, 210);
      grain.vy += this.rng.range(-260, -70);
      grain.hue = this.rng.next();
    }
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): ChromaticAvalancheBowlStats {
    const density = this.densityField.stats();
    const chroma = this.chromaField.stats();
    let active = 0;
    for (const grain of this.grains) if (Math.hypot(grain.vx, grain.vy) > 4) active++;
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      grainCount: this.grains.length,
      activeGrains: active,
      pileMean: density.mean,
      pileVariance: density.variance,
      chromaVariance: chroma.variance,
      avalancheEnergy: this.avalancheEnergy,
    };
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.densityField.values.length / 42));
    for (let i = 0; i < this.densityField.values.length && sample.length < 42; i += stride) sample.push(Number(this.densityField.values[i].toFixed(4)));
    for (let i = 0; i < Math.min(6, this.grains.length); i++) {
      const grain = this.grains[i];
      sample.push(Number((grain.x / Math.max(1, this.options.width)).toFixed(4)), Number((grain.y / Math.max(1, this.options.height)).toFixed(4)), Number(grain.hue.toFixed(4)));
    }
    return sample;
  }

  collapseForTest(): void {
    this.grains.length = 0;
    this.pile.fill(0.25);
    this.chroma.fill(0.5);
    this.densityField.fill(0.25);
    this.chromaField.fill(0.5);
    this.motionField.fill(0);
    this.avalancheEnergy = 0;
  }

  private spawnGrain(nx: number, ny: number): void {
    const x = Math.max(0, Math.min(this.options.width, nx * this.options.width));
    const y = Math.max(0, Math.min(this.options.height, ny * this.options.height));
    this.grains.push({
      x,
      y,
      vx: this.rng.range(-36, 36),
      vy: this.rng.range(-24, 42),
      hue: this.rng.next(),
      radius: this.rng.range(0.72, 1.42),
      active: true,
    });
  }

  private constrainToBowl(grain: Grain): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.54;
    const rx = this.options.width * 0.46;
    const ry = this.options.height * 0.42;
    const nx = (grain.x - cx) / rx;
    const ny = (grain.y - cy) / ry;
    const d = Math.hypot(nx, ny);
    if (d <= 1) return;
    grain.x = cx + (nx / d) * rx;
    grain.y = cy + (ny / d) * ry;
    grain.vx *= -0.34;
    grain.vy *= -0.28;
  }

  private bowlNormal(x: number, y: number): { x: number; y: number } {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.56;
    return { x: (cx - x) / Math.max(1, this.options.width), y: (cy - y) / Math.max(1, this.options.height) };
  }

  private deposit(grain: Grain, speed: number): void {
    const gx = Math.max(0, Math.min(this.options.columns - 1, Math.floor((grain.x / Math.max(1, this.options.width)) * this.options.columns)));
    const gy = Math.max(0, Math.min(this.options.rows - 1, Math.floor((grain.y / Math.max(1, this.options.height)) * this.options.rows)));
    const i = gy * this.options.columns + gx;
    this.pile[i] += 0.04 * grain.radius;
    this.chroma[i] += grain.hue * 0.04 * this.options.chromaMix;
    this.motionField.values[i] = Math.max(this.motionField.values[i], Math.min(1, speed / 260));
  }

  private relaxPile(dt: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const limit = 0.055 + this.options.friction * 0.06;
    for (let y = 1; y < r - 1; y++) {
      for (let x = 1; x < c - 1; x++) {
        const i = y * c + x;
        const h = this.pile[i];
        const down = (y + 1) * c + x;
        const side = y * c + (x + (this.rng.next() > 0.5 ? 1 : -1));
        if (h - this.pile[down] > limit) this.slide(i, down, (h - this.pile[down] - limit) * dt * 2.8);
        if (h - this.pile[side] > limit * 1.3) this.slide(i, side, (h - this.pile[side] - limit) * dt * 1.2);
      }
    }
  }

  private slide(from: number, to: number, amount: number): void {
    const moved = Math.max(0, Math.min(this.pile[from] * 0.45, amount));
    if (moved <= 0) return;
    const hue = this.chroma[from] / Math.max(0.0001, this.pile[from]);
    this.pile[from] -= moved;
    this.pile[to] += moved;
    this.chroma[from] = Math.max(0, this.chroma[from] - hue * moved);
    this.chroma[to] += hue * moved;
    this.motionField.values[to] = Math.min(1, this.motionField.values[to] + moved * 8);
  }

  private paintChroma(px: number, py: number, radius: number, strength: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const gx = (px / Math.max(1, this.options.width)) * (c - 1);
    const gy = (py / Math.max(1, this.options.height)) * (r - 1);
    const gr = Math.max(1, (radius / Math.max(1, this.options.width)) * c);
    for (let y = Math.max(0, Math.floor(gy - gr)); y <= Math.min(r - 1, Math.ceil(gy + gr)); y++) {
      for (let x = Math.max(0, Math.floor(gx - gr)); x <= Math.min(c - 1, Math.ceil(gx + gr)); x++) {
        const d2 = (x - gx) * (x - gx) + (y - gy) * (y - gy);
        if (d2 > gr * gr) continue;
        const falloff = 1 - d2 / (gr * gr);
        const i = y * c + x;
        this.chroma[i] += strength * falloff * 0.05;
        this.pile[i] += strength * falloff * 0.014;
      }
    }
  }

  private projectFields(): void {
    for (let i = 0; i < this.pile.length; i++) {
      const density = Math.max(0, Math.min(1.5, this.pile[i]));
      this.densityField.values[i] = density;
      const hue = this.chroma[i] / Math.max(0.0001, this.pile[i]);
      this.chromaField.values[i] = Math.max(0, Math.min(1.4, this.wrap01(hue) * 0.8 + density * 0.18));
    }
  }

  private wrap01(value: number): number { return value - Math.floor(value); }
}
