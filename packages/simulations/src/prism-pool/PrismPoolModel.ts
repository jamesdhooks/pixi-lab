import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface PrismPoolModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  waveSpeed: number;
  refractionStrength: number;
  causticIntensity: number;
  damping: number;
}

export interface PrismPoolStats {
  columns: number;
  rows: number;
  heightMean: number;
  heightVariance: number;
  causticMean: number;
  causticVariance: number;
  rippleEnergy: number;
}

export class PrismPoolModel {
  readonly heightField: ScalarField;
  readonly causticField: ScalarField;
  readonly normalField: ScalarField;
  readonly height: Float32Array;
  private readonly velocity: Float32Array;
  private readonly nextHeight: Float32Array;
  private readonly nextVelocity: Float32Array;
  private rng: SeededRng;
  private time = 0;
  private rippleEnergy = 0;
  private stagnantMs = 0;

  constructor(private readonly options: PrismPoolModelOptions) {
    const size = options.columns * options.rows;
    this.heightField = new ScalarField(options.columns, options.rows);
    this.causticField = new ScalarField(options.columns, options.rows);
    this.normalField = new ScalarField(options.columns, options.rows);
    this.height = new Float32Array(size);
    this.velocity = new Float32Array(size);
    this.nextHeight = new Float32Array(size);
    this.nextVelocity = new Float32Array(size);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.rippleEnergy = 0;
    this.stagnantMs = 0;
    this.height.fill(0);
    this.velocity.fill(0);
    const ripples = Math.max(8, Math.round((this.options.columns * this.options.rows) / 620));
    for (let i = 0; i < ripples; i++) {
      this.disturb(
        this.rng.range(0, this.options.width),
        this.rng.range(0, this.options.height),
        this.rng.range(18, 64),
        this.rng.range(-0.55, 0.85),
      );
    }
    this.projectFields();
  }

  update(dt: number): void {
    const steps = Math.max(1, Math.min(4, Math.ceil(dt * 90)));
    const subDt = Math.max(0.04, Math.min(0.55, (dt * 60) / steps));
    for (let i = 0; i < steps; i++) this.step(subDt);
    this.time += dt;
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    const radius = event.kind === 'fast_swipe' ? 108 : event.kind === 'drag' ? 72 : event.kind === 'hold' ? 92 : 48;
    const strength = this.options.refractionStrength * (event.kind === 'hold' ? -0.9 : event.kind === 'fast_swipe' ? 1.55 : 1);
    this.disturb(event.x, event.y, radius, strength);
    if (event.kind === 'drag' || event.kind === 'fast_swipe') {
      const dx = event.dx ?? 0;
      const dy = event.dy ?? 0;
      this.strokeRipple(event.x, event.y, dx, dy, radius, strength * 0.55);
    }
    this.projectFields();
  }

  setWaveSpeed(value: number): void { this.options.waveSpeed = value; }
  setRefractionStrength(value: number): void { this.options.refractionStrength = value; }
  setCausticIntensity(value: number): void { this.options.causticIntensity = value; }
  setDamping(value: number): void { this.options.damping = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.heightVariance < 0.00003 || stats.rippleEnergy < 0.00005 || stats.causticVariance < 0.00002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1500,
      reason: stagnant ? 'prism pool ripples flattened into a low-energy surface' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4500) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    for (let i = 0; i < 6; i++) {
      this.disturb(
        this.rng.range(0, this.options.width),
        this.rng.range(0, this.options.height),
        this.rng.range(26, 86),
        this.rng.range(-1.1, 1.35),
      );
    }
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): PrismPoolStats {
    const heightStats = this.heightField.stats();
    const causticStats = this.causticField.stats();
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      heightMean: heightStats.mean,
      heightVariance: heightStats.variance,
      causticMean: causticStats.mean,
      causticVariance: causticStats.variance,
      rippleEnergy: this.rippleEnergy,
    };
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.height.length / 48));
    for (let i = 0; i < this.height.length && sample.length < 48; i += stride) sample.push(Number(this.height[i].toFixed(4)));
    return sample;
  }

  flattenForTest(): void {
    this.height.fill(0);
    this.velocity.fill(0);
    this.heightField.fill(0.5);
    this.causticField.fill(0);
    this.normalField.fill(0.5);
    this.rippleEnergy = 0;
  }

  private step(dt: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const wave = this.options.waveSpeed;
    const damping = this.options.damping;
    let energy = 0;
    for (let y = 0; y < r; y++) {
      const ym = y === 0 ? 0 : y - 1;
      const yp = y === r - 1 ? r - 1 : y + 1;
      for (let x = 0; x < c; x++) {
        const xm = x === 0 ? 0 : x - 1;
        const xp = x === c - 1 ? c - 1 : x + 1;
        const i = y * c + x;
        const value = this.height[i];
        const lap = this.height[y * c + xm] + this.height[y * c + xp] + this.height[ym * c + x] + this.height[yp * c + x] - 4 * value;
        const diagonal = this.height[ym * c + xm] + this.height[ym * c + xp] + this.height[yp * c + xm] + this.height[yp * c + xp] - 4 * value;
        const accel = (lap * 0.34 + diagonal * 0.07) * wave;
        const velocity = (this.velocity[i] + accel * dt) * Math.max(0.55, 1 - damping * dt);
        const next = Math.max(-1.35, Math.min(1.35, value + velocity * dt));
        this.nextVelocity[i] = velocity;
        this.nextHeight[i] = next;
        energy += Math.abs(velocity) + Math.abs(lap) * 0.08;
      }
    }
    this.velocity.set(this.nextVelocity);
    this.height.set(this.nextHeight);
    this.rippleEnergy = energy / Math.max(1, this.height.length);
  }

  private disturb(px: number, py: number, radius: number, strength: number): void {
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
        const falloff = Math.cos(Math.sqrt(d2) / gr * Math.PI * 0.5);
        const i = y * c + x;
        this.height[i] = Math.max(-1.35, Math.min(1.35, this.height[i] + strength * falloff * 0.42));
        this.velocity[i] = Math.max(-1.5, Math.min(1.5, this.velocity[i] + strength * falloff * 0.18));
      }
    }
  }

  private strokeRipple(px: number, py: number, dx: number, dy: number, radius: number, strength: number): void {
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const steps = Math.max(2, Math.min(8, Math.ceil(length / 90)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disturb(px + dx * (t - 0.5), py + dy * (t - 0.5), radius * (0.42 + 0.2 * t), strength * (i % 2 === 0 ? 1 : -0.72));
    }
  }

  private projectFields(): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const prism = this.options.causticIntensity;
    for (let y = 0; y < r; y++) {
      const ym = y === 0 ? 0 : y - 1;
      const yp = y === r - 1 ? r - 1 : y + 1;
      for (let x = 0; x < c; x++) {
        const xm = x === 0 ? 0 : x - 1;
        const xp = x === c - 1 ? c - 1 : x + 1;
        const i = y * c + x;
        const value = this.height[i];
        const gx = this.height[y * c + xp] - this.height[y * c + xm];
        const gy = this.height[yp * c + x] - this.height[ym * c + x];
        const curvature = Math.abs(this.height[y * c + xm] + this.height[y * c + xp] + this.height[ym * c + x] + this.height[yp * c + x] - 4 * value);
        const shimmer = 0.5 + 0.5 * Math.sin((x * 0.21 + y * 0.17) + this.time * (1.4 + this.options.waveSpeed));
        const normal = Math.max(0, Math.min(1.35, Math.hypot(gx, gy) * this.options.refractionStrength));
        this.heightField.values[i] = Math.max(0, Math.min(1.25, value * 0.38 + 0.5 + normal * 0.16));
        this.normalField.values[i] = normal;
        this.causticField.values[i] = Math.max(0, Math.min(1.6, (curvature * 1.8 + normal * 0.7 + shimmer * 0.12) * prism));
      }
    }
  }
}
