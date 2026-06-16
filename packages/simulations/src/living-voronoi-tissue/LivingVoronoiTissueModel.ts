import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';
import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';

export interface LivingVoronoiTissueModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  cellCount: number;
  migrationRate: number;
  membraneTension: number;
  signalStrength: number;
  divisionRate: number;
}

export interface LivingVoronoiTissueCell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  energy: number;
  lineage: number;
}

export interface LivingVoronoiTissueStats {
  columns: number;
  rows: number;
  cellCount: number;
  territoryMean: number;
  territoryVariance: number;
  boundaryMean: number;
  boundaryVariance: number;
  signalMean: number;
  signalVariance: number;
  motionEnergy: number;
}

export class LivingVoronoiTissueModel {
  readonly territoryField: ScalarField;
  readonly boundaryField: ScalarField;
  readonly signalField: ScalarField;
  readonly cells: LivingVoronoiTissueCell[] = [];
  private readonly owner: Int16Array;
  private readonly distance: Float32Array;
  private rng: SeededRng;
  private time = 0;
  private motionEnergy = 0;
  private stagnantMs = 0;

  constructor(private readonly options: LivingVoronoiTissueModelOptions) {
    const size = options.columns * options.rows;
    this.territoryField = new ScalarField(options.columns, options.rows);
    this.boundaryField = new ScalarField(options.columns, options.rows);
    this.signalField = new ScalarField(options.columns, options.rows);
    this.owner = new Int16Array(size);
    this.distance = new Float32Array(size);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.motionEnergy = 0;
    this.stagnantMs = 0;
    this.cells.length = 0;
    const count = Math.max(4, Math.floor(this.options.cellCount));
    for (let i = 0; i < count; i++) this.cells.push(this.makeCell(i));
    this.projectFields();
  }

  update(dt: number): void {
    const scaled = Math.max(0.05, Math.min(0.75, dt * 60));
    this.time += dt;
    let energy = 0;
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      const pulse = Math.sin(this.time * (0.8 + cell.phase * 0.4) + cell.phase * 6.283);
      const centerPullX = (cx - cell.x) / Math.max(1, this.options.width);
      const centerPullY = (cy - cell.y) / Math.max(1, this.options.height);
      cell.vx += (centerPullX * 0.018 + Math.cos(cell.phase * 9.7 + this.time) * 0.008 * this.options.signalStrength) * scaled;
      cell.vy += (centerPullY * 0.018 + Math.sin(cell.phase * 8.1 + this.time * 1.13) * 0.008 * this.options.signalStrength) * scaled;
      cell.radius = Math.max(7, cell.radius + pulse * 0.012 * this.options.membraneTension);
      cell.energy = Math.max(0.08, Math.min(1.8, cell.energy + pulse * 0.012 + this.options.divisionRate * 0.002));
    }
    for (let i = 0; i < this.cells.length; i++) {
      const a = this.cells[i];
      for (let j = i + 1; j < this.cells.length; j++) {
        const b = this.cells[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        const minD = (a.radius + b.radius) * 1.2;
        if (d2 > minD * minD || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = (minD - d) * 0.00085 * this.options.membraneTension * scaled;
        const nx = dx / d;
        const ny = dy / d;
        a.vx += nx * push;
        a.vy += ny * push;
        b.vx -= nx * push;
        b.vy -= ny * push;
      }
    }
    for (const cell of this.cells) {
      cell.vx *= 0.965;
      cell.vy *= 0.965;
      cell.x += cell.vx * this.options.migrationRate * scaled;
      cell.y += cell.vy * this.options.migrationRate * scaled;
      if (cell.x < cell.radius || cell.x > this.options.width - cell.radius) cell.vx *= -0.72;
      if (cell.y < cell.radius || cell.y > this.options.height - cell.radius) cell.vy *= -0.72;
      cell.x = Math.max(cell.radius, Math.min(this.options.width - cell.radius, cell.x));
      cell.y = Math.max(cell.radius, Math.min(this.options.height - cell.radius, cell.y));
      energy += Math.hypot(cell.vx, cell.vy);
    }
    this.motionEnergy = energy / Math.max(1, this.cells.length);
    if (this.options.divisionRate > 0 && this.cells.length < this.options.cellCount && this.rng.next() < this.options.divisionRate * 0.004 * scaled) {
      const parent = this.cells[Math.floor(this.rng.range(0, this.cells.length))];
      this.cells.push({ ...parent, x: Math.min(this.options.width - parent.radius, parent.x + this.rng.range(-22, 22)), y: Math.min(this.options.height - parent.radius, parent.y + this.rng.range(-22, 22)), phase: this.rng.next(), lineage: this.cells.length });
    }
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'hold') this.pressurePulse(event.x, event.y, 120, -1.2);
    else if (event.kind === 'fast_swipe') this.shear(event.x, event.y, event.dx ?? 0, event.dy ?? 0, 1.8);
    else if (event.kind === 'drag') this.shear(event.x, event.y, event.dx ?? 0, event.dy ?? 0, 0.9);
    else this.pressurePulse(event.x, event.y, 95, 1.25);
    this.projectFields();
  }

  setMigrationRate(value: number): void { this.options.migrationRate = value; }
  setMembraneTension(value: number): void { this.options.membraneTension = value; }
  setSignalStrength(value: number): void { this.options.signalStrength = value; }
  setDivisionRate(value: number): void { this.options.divisionRate = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.motionEnergy < 0.002 || stats.boundaryVariance < 0.0002 || stats.signalVariance < 0.00015;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1500,
      reason: stagnant ? 'living voronoi tissue lost membrane motion or signal contrast' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4600) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    for (let i = 0; i < Math.min(8, this.cells.length); i++) {
      const cell = this.cells[Math.floor(this.rng.range(0, this.cells.length))];
      const angle = this.rng.range(0, Math.PI * 2);
      cell.vx += Math.cos(angle) * this.rng.range(1.2, 3.4);
      cell.vy += Math.sin(angle) * this.rng.range(1.2, 3.4);
      cell.energy = Math.min(1.8, cell.energy + 0.45);
    }
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): LivingVoronoiTissueStats {
    const territory = this.territoryField.stats();
    const boundary = this.boundaryField.stats();
    const signal = this.signalField.stats();
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      cellCount: this.cells.length,
      territoryMean: territory.mean,
      territoryVariance: territory.variance,
      boundaryMean: boundary.mean,
      boundaryVariance: boundary.variance,
      signalMean: signal.mean,
      signalVariance: signal.variance,
      motionEnergy: this.motionEnergy,
    };
  }

  get particles(): readonly SimParticle[] {
    return this.cells.map((cell) => ({
      position: { x: cell.x, y: cell.y },
      velocity: { x: cell.vx, y: cell.vy },
      size: Math.max(2.5, cell.radius * (0.26 + cell.energy * 0.05)),
      color: cell.lineage % 3 === 0 ? 0x00e6ff : cell.lineage % 3 === 1 ? 0x9d5cff : 0xfff0a8,
      alpha: Math.max(0.34, Math.min(0.9, 0.28 + cell.energy * 0.34)),
    }));
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.territoryField.values.length / 60));
    for (let i = 0; i < this.territoryField.values.length && sample.length < 60; i += stride) {
      sample.push(Number((this.territoryField.values[i] + this.boundaryField.values[i] * 0.7 + this.signalField.values[i] * 0.35).toFixed(4)));
    }
    return sample;
  }

  flattenForTest(): void {
    for (const cell of this.cells) { cell.vx = 0; cell.vy = 0; cell.energy = 0.1; cell.phase = 0; }
    this.motionEnergy = 0;
    this.territoryField.values.fill(0.2);
    this.boundaryField.values.fill(0);
    this.signalField.values.fill(0);
  }

  private makeCell(lineage: number): LivingVoronoiTissueCell {
    const angle = this.rng.range(0, Math.PI * 2);
    const distance = Math.sqrt(this.rng.next()) * Math.min(this.options.width, this.options.height) * 0.42;
    return {
      x: this.options.width * 0.5 + Math.cos(angle) * distance,
      y: this.options.height * 0.5 + Math.sin(angle) * distance,
      vx: this.rng.range(-0.65, 0.65),
      vy: this.rng.range(-0.65, 0.65),
      radius: this.rng.range(10, 24),
      phase: this.rng.next(),
      energy: this.rng.range(0.35, 1.1),
      lineage,
    };
  }

  private pressurePulse(px: number, py: number, radius: number, force: number): void {
    for (const cell of this.cells) {
      const dx = cell.x - px;
      const dy = cell.y - py;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 0.001) continue;
      const falloff = Math.cos((d / radius) * Math.PI * 0.5);
      cell.vx += (dx / d) * force * falloff;
      cell.vy += (dy / d) * force * falloff;
      cell.energy = Math.min(1.8, cell.energy + Math.abs(force) * 0.16 * falloff);
    }
  }

  private shear(px: number, py: number, dx: number, dy: number, force: number): void {
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / length;
    const ny = dy / length;
    for (const cell of this.cells) {
      const d = Math.hypot(cell.x - px, cell.y - py);
      if (d > 180) continue;
      const falloff = Math.cos((d / 180) * Math.PI * 0.5);
      cell.vx += nx * force * falloff;
      cell.vy += ny * force * falloff;
      cell.energy = Math.min(1.8, cell.energy + force * 0.08 * falloff);
    }
  }

  private projectFields(): void {
    const c = this.options.columns;
    const r = this.options.rows;
    for (let y = 0; y < r; y++) {
      const py = (y / Math.max(1, r - 1)) * this.options.height;
      for (let x = 0; x < c; x++) {
        const px = (x / Math.max(1, c - 1)) * this.options.width;
        let first = Number.POSITIVE_INFINITY;
        let second = Number.POSITIVE_INFINITY;
        let ownerIndex = 0;
        for (let i = 0; i < this.cells.length; i++) {
          const cell = this.cells[i];
          const dx = px - cell.x;
          const dy = py - cell.y;
          const weighted = (dx * dx + dy * dy) / Math.max(20, cell.radius * cell.radius * (0.7 + cell.energy));
          if (weighted < first) { second = first; first = weighted; ownerIndex = i; }
          else if (weighted < second) second = weighted;
        }
        const index = y * c + x;
        this.owner[index] = ownerIndex;
        this.distance[index] = first;
        const cell = this.cells[ownerIndex];
        const membrane = Math.max(0, Math.min(1.6, (second - first) * 0.08 * this.options.membraneTension));
        const lineageHue = (cell.lineage % 17) / 16;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.1 + cell.phase * 6.283);
        this.territoryField.values[index] = Math.max(0, Math.min(1.3, lineageHue * 0.65 + cell.energy * 0.28 + pulse * 0.18));
        this.boundaryField.values[index] = Math.max(0, Math.min(1.5, membrane + pulse * 0.08));
        this.signalField.values[index] = Math.max(0, Math.min(1.6, (1 / (1 + first * 0.12)) * cell.energy * this.options.signalStrength + membrane * 0.35));
      }
    }
  }
}
