import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface OilWaterUniverseModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  separationRate: number;
  boundaryTension: number;
  viscosity: number;
  stirStrength: number;
}

export interface OilWaterUniverseStats {
  columns: number;
  rows: number;
  oilRatio: number;
  fieldMean: number;
  fieldVariance: number;
  boundaryEnergy: number;
  mixingEnergy: number;
}

export class OilWaterUniverseModel {
  readonly densityField: ScalarField;
  readonly edgeField: ScalarField;
  readonly phase: Float32Array;
  private readonly nextPhase: Float32Array;
  private rng: SeededRng;
  private stagnantMs = 0;
  private boundaryEnergy = 0;
  private mixingEnergy = 0;

  constructor(private readonly options: OilWaterUniverseModelOptions) {
    const size = options.columns * options.rows;
    this.densityField = new ScalarField(options.columns, options.rows);
    this.edgeField = new ScalarField(options.columns, options.rows);
    this.phase = new Float32Array(size);
    this.nextPhase = new Float32Array(size);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.stagnantMs = 0;
    this.boundaryEnergy = 0;
    this.mixingEnergy = 0;
    for (let i = 0; i < this.phase.length; i++) this.phase[i] = this.rng.range(-0.18, 0.18);
    const droplets = Math.max(10, Math.round((this.options.columns * this.options.rows) / 520));
    for (let i = 0; i < droplets; i++) {
      this.paintDomain(
        this.rng.range(0, this.options.width),
        this.rng.range(0, this.options.height),
        this.rng.range(18, 56),
        this.rng.next() > 0.5 ? 1 : -1,
      );
    }
    this.projectFields();
  }

  update(dt: number): void {
    const steps = Math.max(1, Math.min(4, Math.ceil(dt * 75)));
    const subDt = Math.max(0.05, Math.min(0.75, (dt * 60) / steps));
    for (let i = 0; i < steps; i++) this.step(subDt);
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    const radius = event.kind === 'fast_swipe' ? 104 : event.kind === 'drag' ? 76 : event.kind === 'hold' ? 88 : 52;
    const baseStrength = this.options.stirStrength * (event.kind === 'hold' ? -0.78 : event.kind === 'fast_swipe' ? 1.45 : 1);
    this.paintDomain(event.x, event.y, radius, baseStrength);
    if (event.kind === 'drag' || event.kind === 'fast_swipe') {
      const dx = event.dx ?? 0;
      const dy = event.dy ?? 0;
      this.paintDomain(event.x + dx * 0.18, event.y + dy * 0.18, radius * 0.72, -baseStrength * 0.65);
      this.shear(event.x, event.y, dx, dy, radius * 1.2, baseStrength * 0.28);
    }
    this.projectFields();
  }

  setSeparationRate(value: number): void { this.options.separationRate = value; }
  setBoundaryTension(value: number): void { this.options.boundaryTension = value; }
  setViscosity(value: number): void { this.options.viscosity = value; }
  setStirStrength(value: number): void { this.options.stirStrength = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.fieldVariance < 0.00005 || stats.boundaryEnergy < 0.002 || stats.mixingEnergy < 0.00004;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1500,
      reason: stagnant ? 'oil-water phase field collapsed into low-variance domains' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4500) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    for (let i = 0; i < 7; i++) {
      this.paintDomain(
        this.rng.range(0, this.options.width),
        this.rng.range(0, this.options.height),
        this.rng.range(28, 82),
        this.rng.next() > 0.5 ? this.rng.range(0.7, 1.45) : this.rng.range(-1.45, -0.7),
      );
    }
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): OilWaterUniverseStats {
    const field = this.densityField.stats();
    let oil = 0;
    for (let i = 0; i < this.phase.length; i++) oil += this.phase[i] > 0 ? 1 : 0;
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      oilRatio: oil / Math.max(1, this.phase.length),
      fieldMean: field.mean,
      fieldVariance: field.variance,
      boundaryEnergy: this.boundaryEnergy,
      mixingEnergy: this.mixingEnergy,
    };
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.phase.length / 48));
    for (let i = 0; i < this.phase.length && sample.length < 48; i += stride) sample.push(Number(this.phase[i].toFixed(4)));
    return sample;
  }

  collapseForTest(): void {
    this.phase.fill(1);
    this.densityField.fill(1);
    this.edgeField.fill(0);
    this.boundaryEnergy = 0;
    this.mixingEnergy = 0;
  }

  private step(dt: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    let boundary = 0;
    let mixing = 0;
    const separation = this.options.separationRate;
    const tension = this.options.boundaryTension;
    const viscosity = this.options.viscosity;
    for (let y = 0; y < r; y++) {
      const ym = y === 0 ? r - 1 : y - 1;
      const yp = y === r - 1 ? 0 : y + 1;
      for (let x = 0; x < c; x++) {
        const xm = x === 0 ? c - 1 : x - 1;
        const xp = x === c - 1 ? 0 : x + 1;
        const i = y * c + x;
        const value = this.phase[i];
        const left = this.phase[y * c + xm];
        const right = this.phase[y * c + xp];
        const up = this.phase[ym * c + x];
        const down = this.phase[yp * c + x];
        const lap = left + right + up + down - 4 * value;
        const diagonalLap = this.phase[ym * c + xm] + this.phase[ym * c + xp] + this.phase[yp * c + xm] + this.phase[yp * c + xp] - 4 * value;
        const separate = value - value * value * value;
        const flow = separation * separate + (viscosity + tension) * lap * 0.34 + tension * diagonalLap * 0.08;
        const next = value + flow * dt * 0.18;
        this.nextPhase[i] = Math.max(-1.25, Math.min(1.25, next));
        const gradient = Math.abs(right - left) + Math.abs(down - up);
        boundary += gradient;
        mixing += Math.max(0, 1 - Math.abs(value));
      }
    }
    this.phase.set(this.nextPhase);
    this.boundaryEnergy = boundary / Math.max(1, this.phase.length);
    this.mixingEnergy = mixing / Math.max(1, this.phase.length);
  }

  private paintDomain(px: number, py: number, radius: number, strength: number): void {
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
        this.phase[i] = Math.max(-1.2, Math.min(1.2, this.phase[i] + strength * falloff * 0.62));
      }
    }
  }

  private shear(px: number, py: number, dx: number, dy: number, radius: number, strength: number): void {
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const nx = -dy / length;
    const ny = dx / length;
    this.paintDomain(px + nx * radius * 0.38, py + ny * radius * 0.38, radius * 0.55, strength);
    this.paintDomain(px - nx * radius * 0.38, py - ny * radius * 0.38, radius * 0.55, -strength);
  }

  private projectFields(): void {
    const c = this.options.columns;
    const r = this.options.rows;
    for (let y = 0; y < r; y++) {
      const ym = y === 0 ? r - 1 : y - 1;
      const yp = y === r - 1 ? 0 : y + 1;
      for (let x = 0; x < c; x++) {
        const xm = x === 0 ? c - 1 : x - 1;
        const xp = x === c - 1 ? 0 : x + 1;
        const i = y * c + x;
        const value = this.phase[i];
        const density = Math.max(0, Math.min(1.4, value * 0.5 + 0.5));
        const edge = Math.abs(this.phase[y * c + xp] - this.phase[y * c + xm]) + Math.abs(this.phase[yp * c + x] - this.phase[ym * c + x]);
        this.densityField.values[i] = density;
        this.edgeField.values[i] = Math.max(0, Math.min(1.4, edge * 0.46));
      }
    }
  }
}
