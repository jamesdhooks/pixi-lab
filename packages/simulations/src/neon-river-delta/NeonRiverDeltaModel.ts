import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';
import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';

export interface NeonRiverDeltaModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  rainfall: number;
  erosionRate: number;
  sedimentGlow: number;
  flowSpeed: number;
}

export interface NeonRiverDeltaStats {
  columns: number;
  rows: number;
  terrainMean: number;
  terrainVariance: number;
  waterMean: number;
  waterVariance: number;
  sedimentMean: number;
  sedimentVariance: number;
  flowEnergy: number;
}

export class NeonRiverDeltaModel {
  readonly terrainField: ScalarField;
  readonly waterField: ScalarField;
  readonly sedimentField: ScalarField;
  readonly flowField: ScalarField;
  private readonly terrain: Float32Array;
  private readonly water: Float32Array;
  private readonly sediment: Float32Array;
  private readonly nextWater: Float32Array;
  private readonly nextSediment: Float32Array;
  private rng: SeededRng;
  private time = 0;
  private flowEnergy = 0;
  private stagnantMs = 0;

  constructor(private readonly options: NeonRiverDeltaModelOptions) {
    const size = options.columns * options.rows;
    this.terrainField = new ScalarField(options.columns, options.rows);
    this.waterField = new ScalarField(options.columns, options.rows);
    this.sedimentField = new ScalarField(options.columns, options.rows);
    this.flowField = new ScalarField(options.columns, options.rows);
    this.terrain = new Float32Array(size);
    this.water = new Float32Array(size);
    this.sediment = new Float32Array(size);
    this.nextWater = new Float32Array(size);
    this.nextSediment = new Float32Array(size);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.flowEnergy = 0;
    this.stagnantMs = 0;
    this.water.fill(0);
    this.sediment.fill(0);
    const c = this.options.columns;
    const r = this.options.rows;
    for (let y = 0; y < r; y++) {
      const downstream = y / Math.max(1, r - 1);
      for (let x = 0; x < c; x++) {
        const nx = x / Math.max(1, c - 1);
        const ridge = 0.28 * Math.sin(nx * Math.PI * 4.2 + this.rng.range(-0.2, 0.2));
        const braid = 0.16 * Math.sin((nx * 8.0 + downstream * 5.5) * Math.PI + this.rng.range(-0.15, 0.15));
        const deltaFan = Math.max(0, 1 - Math.abs(nx - 0.5) * (2.1 + downstream * 1.2));
        const noise = this.rng.range(-0.08, 0.08);
        const base = 0.88 - downstream * 0.62 + ridge + braid - deltaFan * downstream * 0.32 + noise;
        this.terrain[y * c + x] = Math.max(0.03, Math.min(1.25, base));
      }
    }
    for (let x = Math.floor(c * 0.42); x <= Math.ceil(c * 0.58); x++) this.carveChannel(x, 0, 2.7, 0.32);
    this.seedRain(true);
    this.projectFields();
  }

  update(dt: number): void {
    const steps = Math.max(1, Math.min(4, Math.ceil(dt * 80)));
    const subDt = Math.max(0.05, Math.min(0.5, (dt * 60) / steps));
    for (let i = 0; i < steps; i++) this.step(subDt);
    this.time += dt;
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'hold') this.raiseLevee(event.x, event.y, 78, 0.08);
    else if (event.kind === 'fast_swipe') this.rakeChannel(event.x, event.y, event.dx ?? 0, event.dy ?? 0, 0.22);
    else if (event.kind === 'drag') this.rakeChannel(event.x, event.y, event.dx ?? 0, event.dy ?? 0, 0.13);
    else this.addWater(event.x, event.y, 54, 0.82);
    this.projectFields();
  }

  setRainfall(value: number): void { this.options.rainfall = value; }
  setErosionRate(value: number): void { this.options.erosionRate = value; }
  setSedimentGlow(value: number): void { this.options.sedimentGlow = value; }
  setFlowSpeed(value: number): void { this.options.flowSpeed = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.flowEnergy < 0.00045 || stats.waterVariance < 0.00018 || stats.sedimentVariance < 0.00005;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1600,
      reason: stagnant ? 'neon river delta flow collapsed into low-variance channels' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4800) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    this.seedRain(false);
    const c = this.options.columns;
    for (let i = 0; i < 5; i++) this.carveChannel(Math.floor(this.rng.range(c * 0.18, c * 0.82)), Math.floor(this.rng.range(0, this.options.rows * 0.32)), this.rng.range(1.8, 4.2), this.rng.range(0.12, 0.28));
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): NeonRiverDeltaStats {
    const terrain = this.terrainField.stats();
    const water = this.waterField.stats();
    const sediment = this.sedimentField.stats();
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      terrainMean: terrain.mean,
      terrainVariance: terrain.variance,
      waterMean: water.mean,
      waterVariance: water.variance,
      sedimentMean: sediment.mean,
      sedimentVariance: sediment.variance,
      flowEnergy: this.flowEnergy,
    };
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.terrain.length / 54));
    for (let i = 0; i < this.terrain.length && sample.length < 54; i += stride) sample.push(Number((this.terrain[i] + this.water[i] * 0.5 + this.sediment[i] * 0.25).toFixed(4)));
    return sample;
  }

  flattenForTest(): void {
    this.terrain.fill(0.5);
    this.water.fill(0);
    this.sediment.fill(0);
    this.flowEnergy = 0;
    this.projectFields();
  }

  private step(dt: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    this.nextWater.fill(0);
    this.nextSediment.fill(0);
    this.seedRain(false, dt);
    let energy = 0;
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        const i = y * c + x;
        const currentSurface = this.terrain[i] + this.water[i];
        let best = i;
        let bestDrop = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = Math.max(0, Math.min(c - 1, x + ox));
            const ny = Math.max(0, Math.min(r - 1, y + oy));
            const ni = ny * c + nx;
            const drop = currentSurface - (this.terrain[ni] + this.water[ni]) + (ny > y ? 0.015 : -0.004);
            if (drop > bestDrop) { bestDrop = drop; best = ni; }
          }
        }
        const flow = Math.min(this.water[i] * 0.82, Math.max(0, bestDrop) * 0.34 * this.options.flowSpeed * dt);
        const retained = Math.max(0, this.water[i] - flow) * 0.994;
        this.nextWater[i] += retained;
        this.nextSediment[i] += this.sediment[i] * (retained / Math.max(0.0001, this.water[i]));
        if (best !== i && flow > 0) {
          this.nextWater[best] += flow;
          this.nextSediment[best] += this.sediment[i] * (flow / Math.max(0.0001, this.water[i])) + flow * this.options.erosionRate * bestDrop * 0.22;
          const erode = Math.min(0.006, flow * bestDrop * this.options.erosionRate * 0.026);
          this.terrain[i] = Math.max(0, this.terrain[i] - erode);
          this.terrain[best] = Math.min(1.35, this.terrain[best] + erode * 0.33);
          energy += flow * (1 + bestDrop * 8);
        }
      }
    }
    for (let i = 0; i < this.water.length; i++) {
      this.water[i] = Math.min(1.6, this.nextWater[i]);
      this.sediment[i] = Math.min(1.8, this.nextSediment[i] * 0.992);
    }
    this.flowEnergy = energy / Math.max(1, this.water.length);
  }

  private seedRain(initial: boolean, dt = 1): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const drops = initial ? Math.max(20, Math.floor(c * r / 110)) : Math.max(1, Math.floor(this.options.rainfall * c * dt * 0.18));
    for (let i = 0; i < drops; i++) {
      const x = Math.floor(this.rng.range(c * 0.08, c * 0.92));
      const y = initial ? Math.floor(this.rng.range(0, r * 0.75)) : Math.floor(this.rng.range(0, r * 0.34));
      const index = y * c + x;
      this.water[index] = Math.min(1.5, this.water[index] + this.rng.range(0.06, initial ? 0.34 : 0.12) * this.options.rainfall);
    }
  }

  private addWater(px: number, py: number, radius: number, amount: number): void {
    this.paint(px, py, radius, (i, falloff) => { this.water[i] = Math.min(1.6, this.water[i] + amount * falloff); });
  }

  private raiseLevee(px: number, py: number, radius: number, amount: number): void {
    this.paint(px, py, radius, (i, falloff) => { this.terrain[i] = Math.min(1.35, this.terrain[i] + amount * falloff); this.water[i] *= 0.88; });
  }

  private rakeChannel(px: number, py: number, dx: number, dy: number, amount: number): void {
    const length = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.min(10, Math.ceil(length / 80)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.paint(px + dx * (t - 0.5), py + dy * (t - 0.5), 44, (index, falloff) => {
        this.terrain[index] = Math.max(0, this.terrain[index] - amount * falloff);
        this.water[index] = Math.min(1.6, this.water[index] + amount * 1.8 * falloff);
        this.sediment[index] = Math.min(1.8, this.sediment[index] + amount * 0.9 * falloff);
      });
    }
  }

  private carveChannel(x: number, y: number, radius: number, depth: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    let cx = x;
    for (let cy = y; cy < r; cy++) {
      cx += Math.round(this.rng.range(-1.4, 1.4));
      cx = Math.max(1, Math.min(c - 2, cx));
      const minX = Math.max(0, Math.floor(cx - radius));
      const maxX = Math.min(c - 1, Math.ceil(cx + radius));
      for (let px = minX; px <= maxX; px++) {
        const falloff = Math.max(0, 1 - Math.abs(px - cx) / Math.max(1, radius));
        const i = cy * c + px;
        this.terrain[i] = Math.max(0, this.terrain[i] - depth * falloff * (0.4 + cy / Math.max(1, r)));
        this.water[i] = Math.min(1.4, this.water[i] + 0.05 * falloff);
      }
      radius = Math.min(radius + 0.015, 6.5);
    }
  }

  private paint(px: number, py: number, radius: number, apply: (index: number, falloff: number) => void): void {
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
        const d = Math.hypot(x - gx, y - gy);
        if (d > gr) continue;
        apply(y * c + x, Math.cos((d / gr) * Math.PI * 0.5));
      }
    }
  }

  private projectFields(): void {
    const c = this.options.columns;
    const r = this.options.rows;
    for (let y = 0; y < r; y++) {
      const ym = y === 0 ? 0 : y - 1;
      const yp = y === r - 1 ? r - 1 : y + 1;
      for (let x = 0; x < c; x++) {
        const xm = x === 0 ? 0 : x - 1;
        const xp = x === c - 1 ? c - 1 : x + 1;
        const i = y * c + x;
        const slope = Math.hypot(this.terrain[y * c + xp] - this.terrain[y * c + xm], this.terrain[yp * c + x] - this.terrain[ym * c + x]);
        const shimmer = 0.5 + 0.5 * Math.sin(this.time * 1.7 + x * 0.19 + y * 0.13);
        this.terrainField.values[i] = Math.max(0, Math.min(1.35, this.terrain[i]));
        this.waterField.values[i] = Math.max(0, Math.min(1.45, this.water[i] * 1.2 + slope * 0.65 + shimmer * 0.06));
        this.sedimentField.values[i] = Math.max(0, Math.min(1.7, this.sediment[i] * this.options.sedimentGlow + this.water[i] * slope * 1.6));
        this.flowField.values[i] = Math.max(0, Math.min(1.4, slope * 2.4 + this.water[i] * 0.24));
      }
    }
  }
}
