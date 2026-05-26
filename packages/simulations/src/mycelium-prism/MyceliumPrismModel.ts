import { ScalarField, SeededRng, TriangularGrid } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';

type GridPoint = { column: number; row: number };

export interface MyceliumPrismModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  strainCount: number;
  initialColonies: number;
  growthRate: number;
  nutrientDiffusion: number;
}

export interface MyceliumStats {
  activeCells: number;
  frontierCells: number;
  meanNutrient: number;
  meanEnergy: number;
  veinPulse: number;
}

interface MyceliumCellState {
  strain: number;
  nutrient: number;
  energy: number;
  age: number;
  frontier: boolean;
}

export class MyceliumPrismModel {
  readonly grid: TriangularGrid;
  readonly field: ScalarField;
  private readonly cells: MyceliumCellState[];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;
  private lastActiveCells = 0;

  constructor(private readonly options: MyceliumPrismModelOptions) {
    this.grid = new TriangularGrid(options.columns, options.rows);
    this.field = new ScalarField(options.columns, options.rows);
    this.cells = Array.from({ length: options.columns * options.rows }, () => ({
      strain: -1,
      nutrient: 0,
      energy: 0,
      age: 0,
      frontier: false,
    }));
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.lastActiveCells = 0;
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      cell.strain = -1;
      cell.nutrient = this.rng.range(0.22, 0.72);
      cell.energy = 0;
      cell.age = 0;
      cell.frontier = false;
      this.grid.cells[i].active = false;
      this.grid.cells[i].value = 0;
      this.field.values[i] = 0;
    }
    const colonies = Math.max(1, Math.floor(this.options.initialColonies));
    for (let i = 0; i < colonies; i++) {
      const column = Math.floor(this.rng.range(2, Math.max(3, this.options.columns - 2)));
      const row = Math.floor(this.rng.range(2, Math.max(3, this.options.rows - 2)));
      this.seedColony(column, row, i % Math.max(1, this.options.strainCount), 0.9);
    }
    this.projectField();
    this.lastActiveCells = this.stats().activeCells;
  }

  update(dt: number): void {
    this.time += dt;
    const steps = Math.max(1, Math.ceil(dt * 30));
    for (let s = 0; s < steps; s++) {
      this.diffuseNutrients();
      this.growFrontier(dt / steps);
      this.ageActiveCells(dt / steps);
    }
    this.projectField();
  }

  handleGesture(event: GestureEvent): void {
    const { column, row } = this.toCell(event.x, event.y);
    switch (event.kind) {
      case 'tap':
        this.seedColony(column, row, Math.floor(this.rng.range(0, Math.max(1, this.options.strainCount))), 1.1);
        break;
      case 'drag':
        this.smearNutrients(column, row, 2, 0.18 + Math.min(0.35, Math.hypot(event.dx ?? 0, event.dy ?? 0) / 360));
        break;
      case 'hold':
        this.smearNutrients(column, row, 3, 0.42);
        break;
      case 'fast_swipe':
        this.pulseVeins(column, row, 0.28);
        break;
      default:
        break;
    }
    this.projectField();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const noFrontier = stats.frontierCells === 0;
    const noEnergy = stats.meanEnergy < 0.018;
    const notGrowing = stats.activeCells <= this.lastActiveCells;
    const stagnant = noFrontier || (noEnergy && notGrowing);
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    this.lastActiveCells = stats.activeCells;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'frontier exhausted or nutrient energy depleted' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4000) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const target = this.randomActiveOrCenter();
    this.smearNutrients(target.column, target.row, 3, 0.7);
    this.seedColony(target.column, target.row, Math.floor(this.rng.range(0, Math.max(1, this.options.strainCount))), 0.85);
    this.stagnantMs = 0;
    this.projectField();
  }

  // Live-settable parameters — called from the scene each tick when a slider value changes.
  setGrowthRate(v: number): void { this.options.growthRate = v; }
  setNutrientDiffusion(v: number): void { this.options.nutrientDiffusion = v; }

  stats(): MyceliumStats {
    let activeCells = 0;
    let frontierCells = 0;
    let nutrientTotal = 0;
    let energyTotal = 0;
    for (const cell of this.cells) {
      if (cell.strain >= 0) activeCells++;
      if (cell.frontier) frontierCells++;
      nutrientTotal += cell.nutrient;
      energyTotal += cell.energy;
    }
    return {
      activeCells,
      frontierCells,
      meanNutrient: nutrientTotal / Math.max(1, this.cells.length),
      meanEnergy: energyTotal / Math.max(1, this.cells.length),
      veinPulse: (Math.sin(this.time * 3.1) + 1) * 0.5,
    };
  }

  snapshot(): Array<{ strain: number; nutrient: number; energy: number; frontier: boolean }> {
    return this.cells.map((cell) => ({
      strain: cell.strain,
      nutrient: Number(cell.nutrient.toFixed(4)),
      energy: Number(cell.energy.toFixed(4)),
      frontier: cell.frontier,
    }));
  }

  drainEnergyForTest(): void {
    for (const cell of this.cells) {
      cell.nutrient = 0;
      cell.energy = 0;
      cell.frontier = false;
    }
    this.projectField();
  }

  private seedColony(column: number, row: number, strain: number, energy: number): void {
    for (const neighbor of this.neighbors(column, row, 1)) {
      const i = this.index(neighbor.column, neighbor.row);
      const cell = this.cells[i];
      cell.strain = strain;
      cell.energy = Math.max(cell.energy, energy * (neighbor.column === column && neighbor.row === row ? 1 : 0.62));
      cell.nutrient = Math.min(1.6, cell.nutrient + 0.35);
      cell.frontier = true;
      cell.age = 0;
      this.grid.cells[i].active = true;
    }
  }

  private growFrontier(dt: number): void {
    const claims: Array<{ index: number; strain: number; energy: number }> = [];
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      if (!cell.frontier || cell.energy <= 0.03) continue;
      const column = i % this.options.columns;
      const row = Math.floor(i / this.options.columns);
      for (const n of this.adjacent(column, row)) {
        const ni = this.index(n.column, n.row);
        const neighbor = this.cells[ni];
        if (neighbor.strain >= 0 || neighbor.nutrient <= 0.05) continue;
        const chance = (this.options.growthRate * cell.energy * neighbor.nutrient * dt) + 0.018;
        if (this.rng.next() < chance) {
          claims.push({ index: ni, strain: cell.strain, energy: Math.min(1, cell.energy * 0.76 + neighbor.nutrient * 0.42) });
        }
      }
      cell.energy *= 0.988;
      cell.frontier = this.adjacent(column, row).some((n) => this.cells[this.index(n.column, n.row)].strain < 0);
    }
    for (const claim of claims.slice(0, 24)) {
      const cell = this.cells[claim.index];
      if (cell.strain >= 0) continue;
      cell.strain = claim.strain;
      cell.energy = claim.energy;
      cell.nutrient = Math.max(0, cell.nutrient - 0.18);
      cell.frontier = true;
      cell.age = 0;
      this.grid.cells[claim.index].active = true;
    }
  }

  private diffuseNutrients(): void {
    const next = this.cells.map((cell) => cell.nutrient);
    for (let i = 0; i < this.cells.length; i++) {
      const column = i % this.options.columns;
      const row = Math.floor(i / this.options.columns);
      let sum = 0;
      let count = 0;
      for (const n of this.adjacent(column, row)) {
        sum += this.cells[this.index(n.column, n.row)].nutrient;
        count++;
      }
      if (count > 0) {
        next[i] += (sum / count - this.cells[i].nutrient) * this.options.nutrientDiffusion;
      }
    }
    for (let i = 0; i < this.cells.length; i++) this.cells[i].nutrient = Math.max(0, Math.min(1.8, next[i]));
  }

  private ageActiveCells(dt: number): void {
    for (const cell of this.cells) {
      if (cell.strain < 0) continue;
      cell.age += dt;
      cell.energy = Math.max(0, cell.energy + cell.nutrient * 0.012 - 0.004);
      cell.nutrient = Math.max(0, cell.nutrient - 0.01 * dt);
    }
  }

  private projectField(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      const strainPhase = cell.strain < 0 ? 0 : (cell.strain + 1) / Math.max(1, this.options.strainCount);
      const pulse = cell.strain < 0 ? 0 : 0.15 * Math.sin(this.time * 4 + cell.age * 2 + strainPhase * Math.PI * 2);
      const value = cell.strain < 0 ? cell.nutrient * 0.16 : Math.min(1.4, 0.35 + cell.energy + cell.nutrient * 0.25 + pulse);
      this.grid.cells[i].value = value;
      this.field.values[i] = value;
    }
  }

  private smearNutrients(column: number, row: number, radius: number, amount: number): void {
    for (const n of this.neighbors(column, row, radius)) {
      const d = Math.hypot(n.column - column, n.row - row);
      const falloff = Math.max(0, 1 - d / Math.max(1, radius + 0.5));
      const cell = this.cells[this.index(n.column, n.row)];
      cell.nutrient = Math.min(1.8, cell.nutrient + amount * falloff);
      if (cell.strain >= 0) {
        cell.energy = Math.min(1.6, cell.energy + amount * falloff * 0.3);
        cell.frontier = true;
      }
    }
  }

  private pulseVeins(column: number, row: number, amount: number): void {
    for (const n of this.neighbors(column, row, 4)) {
      const cell = this.cells[this.index(n.column, n.row)];
      if (cell.strain >= 0) cell.energy = Math.min(1.8, cell.energy + amount);
    }
  }

  private randomActiveOrCenter(): { column: number; row: number } {
    const active = this.grid.activeCells();
    if (active.length === 0) return { column: Math.floor(this.options.columns / 2), row: Math.floor(this.options.rows / 2) };
    const picked = active[Math.floor(this.rng.range(0, active.length))];
    return { column: picked.column, row: picked.row };
  }

  private toCell(x: number, y: number): { column: number; row: number } {
    return {
      column: Math.max(0, Math.min(this.options.columns - 1, Math.floor((x / Math.max(1, this.options.width)) * this.options.columns))),
      row: Math.max(0, Math.min(this.options.rows - 1, Math.floor((y / Math.max(1, this.options.height)) * this.options.rows))),
    };
  }

  private neighbors(column: number, row: number, radius: number): GridPoint[] {
    const out: GridPoint[] = [];
    for (let y = row - radius; y <= row + radius; y++) {
      for (let x = column - radius; x <= column + radius; x++) {
        if (x < 0 || y < 0 || x >= this.options.columns || y >= this.options.rows) continue;
        out.push({ column: x, row: y });
      }
    }
    return out;
  }

  private adjacent(column: number, row: number): Array<{ column: number; row: number }> {
    const parity = (column + row) % 2 === 0 ? -1 : 1;
    const candidates = [
      { column: column - 1, row },
      { column: column + 1, row },
      { column, row: row - 1 },
      { column, row: row + 1 },
      { column: column + parity, row: row - 1 },
      { column: column + parity, row: row + 1 },
    ];
    return candidates.filter((n) => n.column >= 0 && n.row >= 0 && n.column < this.options.columns && n.row < this.options.rows);
  }

  private index(column: number, row: number): number {
    return row * this.options.columns + column;
  }
}
