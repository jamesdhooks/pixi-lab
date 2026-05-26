import { ScalarField, SeededRng, TrailField, TriangularGrid } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface CrystalPlasmaModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  maxCrystals: number;
  stressDecay: number;
}

export interface CrystalPlasmaStats {
  crystalCount: number;
  chargedCrystalCount: number;
  totalStress: number;
  stressMax: number;
  stressVariance: number;
  fractureMax: number;
  fractureVariance: number;
}

interface CrystalNode {
  column: number;
  row: number;
  energy: number;
  age: number;
}

export class CrystalPlasmaModel {
  readonly grid: TriangularGrid;
  readonly stressField: ScalarField;
  readonly fractureField: TrailField;
  private readonly crystals: CrystalNode[] = [];
  private rng: SeededRng;
  private stagnantMs = 0;

  constructor(private readonly options: CrystalPlasmaModelOptions) {
    this.grid = new TriangularGrid(options.columns, options.rows);
    this.stressField = new ScalarField(options.columns, options.rows);
    this.fractureField = new TrailField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.stagnantMs = 0;
    this.crystals.length = 0;
    this.stressField.fill(0);
    this.fractureField.fill(0);
    for (const cell of this.grid.cells) {
      cell.active = false;
      cell.value = 0;
    }
    for (let i = 0; i < 5; i++) this.seedCrystal(this.rng.range(0.18, 0.82) * this.options.width, this.rng.range(0.16, 0.84) * this.options.height, this.rng.range(0.55, 0.95));
  }

  update(dt: number): void {
    const steps = Math.max(1, dt * 60);
    const stressFade = Math.pow(this.options.stressDecay, steps);
    for (let i = 0; i < this.stressField.values.length; i++) this.stressField.values[i] *= stressFade;
    this.fractureField.fade(Math.pow(0.972, steps));

    for (const crystal of this.crystals) {
      crystal.age += dt;
      crystal.energy = Math.max(0.04, crystal.energy * (1 - 0.05 * dt));
      const stress = this.stressField.get(crystal.column, crystal.row);
      this.stressField.set(crystal.column, crystal.row, Math.min(1.8, stress + crystal.energy * 0.02));
      this.fractureField.set(crystal.column, crystal.row, Math.min(1, this.fractureField.get(crystal.column, crystal.row) + crystal.energy * 0.002));
      const cell = this.grid.get(crystal.column, crystal.row);
      if (cell) cell.value = Math.min(1, cell.value * 0.996 + crystal.energy * 0.01);
      if (this.crystals.length < this.options.maxCrystals && this.rng.next() < dt * (0.55 + crystal.energy * 0.5)) this.growFrom(crystal);
      if (this.rng.next() < dt * Math.max(0, stress - 0.62) * 0.75) this.fractureAt(crystal.column, crystal.row, stress * 0.55);
    }

    if (this.rng.next() < dt * 0.35) this.chargeRegion(this.rng.range(0, this.options.width), this.rng.range(0, this.options.height), this.rng.range(0.16, 0.34));
    while (this.crystals.length > this.options.maxCrystals) this.crystals.shift();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.seedCrystal(event.x, event.y, 1.05);
    if (event.kind === 'hold') {
      this.chargeRegion(event.x, event.y, 1.25);
      for (let i = 0; i < 3; i++) this.seedCrystal(event.x + this.rng.range(-18, 18), event.y + this.rng.range(-18, 18), 0.85);
    }
    if (event.kind === 'drag') this.chargeLine(event.x - (event.dx ?? 0), event.y - (event.dy ?? 0), event.x, event.y, 0.48);
    if (event.kind === 'fast_swipe') {
      const dx = event.dx ?? 140;
      const dy = event.dy ?? 0;
      this.chargeLine(event.x - dx, event.y - dy, event.x + dx * 0.25, event.y + dy * 0.25, 0.92);
      this.fractureLine(event.x - dx, event.y - dy, event.x + dx * 0.25, event.y + dy * 0.25, 0.9);
    }
    while (this.crystals.length > this.options.maxCrystals) this.crystals.shift();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.crystalCount === 0 || stats.totalStress < 0.18 || stats.stressVariance < 0.000004;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return { stagnant: this.stagnantMs >= 1200, reason: stagnant ? 'crystal lattice lost stress variation or active growth' : undefined, severity: stagnant ? Math.min(1, this.stagnantMs / 3600) : 0, observedForMs: this.stagnantMs };
  }

  stabilize(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    this.chargeRegion(cx, cy, 1.5);
    for (let i = 0; i < 6; i++) this.seedCrystal(cx + Math.cos(i) * 34, cy + Math.sin(i) * 24, 0.9);
    this.stagnantMs = 0;
  }

  stats(): CrystalPlasmaStats {
    const stress = this.stressField.stats();
    const fracture = this.fractureField.stats();
    let totalStress = 0;
    for (let i = 0; i < this.stressField.values.length; i++) totalStress += this.stressField.values[i];
    return { crystalCount: this.crystals.length, chargedCrystalCount: this.crystals.filter((c) => c.energy > 0.22).length, totalStress, stressMax: stress.max, stressVariance: stress.variance, fractureMax: fracture.max, fractureVariance: fracture.variance };
  }

  snapshot(): Array<{ column: number; row: number; energy: number; stressMax: number }> {
    const stressMax = Number(this.stressField.stats().max.toFixed(3));
    return this.crystals.slice(0, 18).map((c) => ({ column: c.column, row: c.row, energy: Number(c.energy.toFixed(3)), stressMax }));
  }

  renderParticles(): SimParticle[] {
    return this.crystals.map((c) => ({ position: this.cellToWorld(c.column, c.row), velocity: { x: 0, y: 0 }, size: 2 + c.energy * 5, color: 0xffffff, alpha: 0.28 + Math.min(0.6, c.energy * 0.55) }));
  }

  drainForTest(): void {
    this.crystals.length = 0;
    this.stressField.fill(0);
    this.fractureField.fill(0);
    for (const cell of this.grid.cells) {
      cell.active = false;
      cell.value = 0;
    }
    this.stagnantMs = 0;
  }

  private seedCrystal(x: number, y: number, energy: number): void {
    const { column, row } = this.worldToCell(x, y);
    const cell = this.grid.get(column, row);
    if (!cell) return;
    cell.active = true;
    cell.value = Math.min(1, cell.value + energy * 0.55);
    if (!this.crystals.some((c) => c.column === column && c.row === row)) this.crystals.push({ column, row, energy, age: 0 });
    this.chargeRegion(x, y, energy * 0.55);
  }

  private growFrom(crystal: CrystalNode): void {
    const candidates = this.neighbors(crystal.column, crystal.row).filter(({ column, row }) => this.grid.get(column, row) && !this.grid.get(column, row)?.active);
    if (candidates.length === 0) return;
    const choice = candidates[Math.floor(this.rng.range(0, candidates.length))];
    const cell = this.grid.get(choice.column, choice.row);
    if (!cell) return;
    cell.active = true;
    cell.value = crystal.energy * 0.55;
    this.crystals.push({ column: choice.column, row: choice.row, energy: crystal.energy * this.rng.range(0.58, 0.88), age: 0 });
    this.stressField.set(choice.column, choice.row, Math.min(1.8, this.stressField.get(choice.column, choice.row) + crystal.energy * 0.22));
    if (this.rng.next() < 0.18) this.fractureAt(choice.column, choice.row, crystal.energy * 0.3);
  }

  private neighbors(column: number, row: number): Array<{ column: number; row: number }> {
    const diagonal = (column + row) % 2 === 0 ? -1 : 1;
    return [
      { column: column - 1, row },
      { column: column + 1, row },
      { column, row: row - 1 },
      { column, row: row + 1 },
      { column: column - 1, row: row + diagonal },
      { column: column + 1, row: row + diagonal },
    ];
  }

  private chargeRegion(x: number, y: number, amount: number): void {
    const { column, row } = this.worldToCell(x, y);
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const d = Math.hypot(ox, oy);
      this.stressField.set(column + ox, row + oy, Math.min(1.8, this.stressField.get(column + ox, row + oy) + amount * Math.max(0, 1 - d / 2.8)));
    }
  }

  private chargeLine(x0: number, y0: number, x1: number, y1: number, amount: number): void {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      this.chargeRegion(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, amount);
    }
  }

  private fractureLine(x0: number, y0: number, x1: number, y1: number, amount: number): void {
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const { column, row } = this.worldToCell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      this.fractureAt(column, row, amount);
    }
  }

  private fractureAt(column: number, row: number, amount: number): void {
    this.fractureField.set(column, row, Math.min(1, this.fractureField.get(column, row) + amount));
    this.stressField.set(column, row, Math.max(0, this.stressField.get(column, row) - amount * 0.16));
  }

  private worldToCell(x: number, y: number): { column: number; row: number } {
    return { column: Math.max(0, Math.min(this.options.columns - 1, Math.round((x / Math.max(1, this.options.width)) * (this.options.columns - 1)))), row: Math.max(0, Math.min(this.options.rows - 1, Math.round((y / Math.max(1, this.options.height)) * (this.options.rows - 1)))) };
  }

  private cellToWorld(column: number, row: number): { x: number; y: number } {
    return { x: ((column + 0.5) / this.options.columns) * this.options.width, y: ((row + 0.5) / this.options.rows) * this.options.height };
  }
}
