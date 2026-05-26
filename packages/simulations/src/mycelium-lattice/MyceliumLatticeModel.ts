import { SeededRng, TriangularGrid } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, StagnationReport } from '@hooksjam/pixi-lab-core';

/** EMPTY cell — no organism present. */
const EMPTY = 0;
/** TIP cell — actively growing front. */
const TIP = 1;
/** BODY cell — established filament, no longer growing. */
const BODY = 2;

/**
 * Strain hue step: 1/6 of the palette cycle.  With 6 strains this distributes
 * each strain evenly across the 6 accessible active-cell palette slots so that
 * every strain maps to a visually distinct colour regardless of palette choice.
 */
const STRAIN_STEP = 1.0 / 6.0;

/** Cardinal directions: right (0), down (1), left (2), up (3). */
const DC = [1, 0, -1, 0] as const;
const DR = [0, 1, 0, -1] as const;

export interface MyceliumLatticeModelOptions {
  seed: number;
  width: number;
  height: number;
  /** Grid column count — maps to the `resolution` settings key. */
  columns: number;
  rows: number;
  strainCount: number;
  initialSpores: number;
  maxTips: number;
  growthProbability: number;
  branchChance: number;
  /** Hue palette step per generation (1–40). */
  generationHueStep: number;
  /** Probability multiplier for forward-direction growth (default 1.0). */
  forwardBias: number;
  /** Probability multiplier for side-direction growth (default 0.42). */
  sideBias: number;
}

export interface MyceliumLatticeStats {
  livingCells: number;
  tipCount: number;
}

export class MyceliumLatticeModel {
  readonly grid: TriangularGrid;
  private rng: SeededRng;

  /** Per-cell typed arrays (index = row * columns + column). */
  private readonly state: Uint8Array;
  private readonly gen: Uint16Array;
  private readonly strain: Uint8Array;
  private readonly heading: Uint8Array;
  private readonly moisture: Float32Array;

  private tips: number[] = [];
  private stagnantMs = 0;

  constructor(private readonly options: MyceliumLatticeModelOptions) {
    const n = options.columns * options.rows;
    this.grid = new TriangularGrid(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.state = new Uint8Array(n);
    this.gen = new Uint16Array(n);
    this.strain = new Uint8Array(n);
    this.heading = new Uint8Array(n);
    this.moisture = new Float32Array(n);
    this.initMoisture();
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.tips = [];
    this.state.fill(EMPTY);
    this.gen.fill(0);
    this.strain.fill(0);
    this.heading.fill(0);
    for (let i = 0; i < this.grid.cells.length; i++) {
      this.grid.cells[i].active = false;
      this.grid.cells[i].value = 0;
    }
    for (let i = 0; i < this.options.initialSpores; i++) {
      const c = this.rng.int(2, this.options.columns - 3);
      const r = this.rng.int(2, this.options.rows - 3);
      this.seedAt(c, r, i % Math.max(1, this.options.strainCount), 0);
    }
    this.projectGrid();
  }

  update(dt: number): void {
    // Run approximately 48 simulation ticks per real second, capped to avoid
    // runaway catchup on low-fps frames.
    const steps = Math.max(1, Math.min(4, Math.round(dt * 48)));
    for (let s = 0; s < steps; s++) {
      this.stepSimulation();
    }
    this.projectGrid();
  }

  handleGesture(event: GestureEvent): void {
    this.seedColonyAt(event.x, event.y);
  }

  seedColonyAt(x: number, y: number): void {
    const col = this.toCol(x);
    const row = this.toRow(y);
    const radius = Math.max(2, Math.floor(this.options.columns / 22));
    const s = this.rng.int(0, this.options.strainCount - 1);
    for (let i = 0; i < 8; i++) {
      const dc = this.rng.int(-radius, radius);
      const dr = this.rng.int(-radius, radius);
      const nc = Math.max(0, Math.min(this.options.columns - 1, col + dc));
      const nr = Math.max(0, Math.min(this.options.rows - 1, row + dr));
      this.seedAt(nc, nr, s, 0);
    }
    this.projectGrid();
  }

  detectStagnation(dt: number): StagnationReport {
    const living = this.countLiving();
    const total = this.options.columns * this.options.rows;
    const fullCoverage = living >= total * 0.92;
    // Tips that are stuck (all neighbours occupied) still remain in the array but
    // can never grow — treat a non-growing full-coverage state as stagnant.
    const stagnant = fullCoverage || (this.tips.length === 0 && living > 0);
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 2000,
      severity: stagnant ? Math.min(1, this.stagnantMs / 5000) : 0,
      reason: stagnant ? (fullCoverage ? 'grid fully covered' : 'growth tips exhausted') : undefined,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const c = this.rng.int(2, this.options.columns - 3);
    const r = this.rng.int(2, this.options.rows - 3);
    const s = this.rng.int(0, this.options.strainCount - 1);
    for (let i = 0; i < 5; i++) {
      const dc = this.rng.int(-3, 3);
      const dr = this.rng.int(-3, 3);
      this.seedAt(
        Math.max(0, Math.min(this.options.columns - 1, c + dc)),
        Math.max(0, Math.min(this.options.rows - 1, r + dr)),
        s, 0,
      );
    }
    this.stagnantMs = 0;
    this.projectGrid();
  }

  stats(): MyceliumLatticeStats {
    return { livingCells: this.countLiving(), tipCount: this.tips.length };
  }

  // Live setters — called from the scene each tick on slider change.
  setGrowthProbability(v: number): void { this.options.growthProbability = v; }
  setBranchChance(v: number): void      { this.options.branchChance = v; }
  setGenerationHueStep(v: number): void { this.options.generationHueStep = v; }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private initMoisture(): void {
    const { columns, rows } = this.options;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = c / Math.max(1, columns - 1);
        const y = r / Math.max(1, rows - 1);
        const m = 0.50
          + 0.25 * Math.sin(x * 17.0 + y * 4.5)
          + 0.20 * Math.sin(x * 5.0 - y * 13.0)
          + 0.12 * Math.sin((x + y) * 21.0)
          + 0.08 * this.rng.next();
        this.moisture[r * columns + c] = Math.max(0, Math.min(1, m));
      }
    }
  }

  private seedAt(c: number, r: number, strainId: number, genOffset: number): void {
    const i = r * this.options.columns + c;
    if (i < 0 || i >= this.state.length) return;
    if (this.state[i] !== EMPTY) return;
    this.state[i] = TIP;
    this.gen[i] = genOffset;
    this.strain[i] = strainId;
    this.heading[i] = this.rng.int(0, 3);
    this.grid.cells[i].active = true;
    this.tips.push(i);
  }

  private stepSimulation(): void {
    // Cap tip count to avoid unbounded growth on high-probability runs.
    if (this.tips.length > this.options.maxTips) {
      this.tips.splice(0, this.tips.length - this.options.maxTips);
    }
    // Shuffle tips to avoid directional scan artifacts.
    for (let i = this.tips.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      const tmp = this.tips[i];
      this.tips[i] = this.tips[j];
      this.tips[j] = tmp;
    }
    const newTips: number[] = [];
    for (const ci of this.tips) {
      if (this.state[ci] === TIP) {
        this.advanceTip(ci, newTips);
      }
    }
    this.tips = newTips;
  }

  private advanceTip(ci: number, newTips: number[]): void {
    const { columns, rows, growthProbability, branchChance, forwardBias, sideBias } = this.options;
    const col = ci % columns;
    const row = Math.floor(ci / columns);
    const h = this.heading[ci];

    // Three growth slots: [forward, side-left, side-right].
    // Each slot stores [dir, probabilityBias].
    const sDir: [number, number, number] = [h, (h + 1) % 4, (h + 3) % 4];
    const sBias: [number, number, number] = [forwardBias, sideBias, sideBias];

    // Prefer forward; occasionally lead with a side slot.
    const rPref = this.rng.next();
    const preferred = rPref < 0.64 ? 0 : rPref < 0.82 ? 1 : 2;
    const slotOrder: [number, number, number] = [preferred, (preferred + 1) % 3, (preferred + 2) % 3];

    let grew = false;
    for (const s of slotOrder) {
      const dir = sDir[s];
      const nc = col + DC[dir];
      const nr = row + DR[dir];
      if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
      const ni = nr * columns + nc;
      if (this.state[ni] !== EMPTY) continue;

      const moistureBonus = 0.35 + this.moisture[ni] * 0.95;
      const chance = Math.min(1, growthProbability * sBias[s] * moistureBonus);
      if (this.rng.next() >= chance) continue;

      // Convert current tip to body; neighbour becomes the new tip.
      this.state[ci] = BODY;
      this.state[ni] = TIP;
      this.gen[ni] = this.gen[ci] + 1;
      this.strain[ni] = this.strain[ci];
      this.grid.cells[ni].active = true;

      // Child heading: mostly continues in `dir`, sometimes turns 90°.
      const rH = this.rng.next();
      this.heading[ni] = rH < 0.65 ? dir : rH < 0.825 ? (dir + 1) % 4 : (dir + 3) % 4;
      newTips.push(ni);

      // Optional branch from an adjacent slot.
      if (this.rng.next() < branchChance) {
        const bSlot = (s + 1 + (this.rng.next() < 0.5 ? 0 : 1)) % 3;
        const bDir = sDir[bSlot];
        const bnc = col + DC[bDir];
        const bnr = row + DR[bDir];
        if (bnc >= 0 && bnr >= 0 && bnc < columns && bnr < rows) {
          const bni = bnr * columns + bnc;
          if (this.state[bni] === EMPTY) {
            this.state[bni] = TIP;
            this.gen[bni] = this.gen[ci] + 1;
            this.strain[bni] = this.strain[ci];
            this.heading[bni] = this.rng.int(0, 3);
            this.grid.cells[bni].active = true;
            newTips.push(bni);
          }
        }
      }

      grew = true;
      break;
    }

    // Tip stays alive to retry next tick (low-probability slow growth).
    if (!grew) newTips.push(ci);
  }

  /**
   * Encode strain + generation + moisture into a value in [0.36, 1.0] so that
   * the `MeshLatticeRenderer` palette lookup produces visually distinct colours.
   *
   * With STRAIN_STEP = 1/6 and 6 strains the 6 strains map to 6 evenly-spaced
   * slots in the active-cell region of any 10-entry palette.  The generation hue
   * step makes older growth slowly drift toward the next palette colour, giving
   * an organic colour-shift effect over time.
   */
  private projectGrid(): void {
    const genStep = this.options.generationHueStep / 360.0;
    for (let i = 0; i < this.grid.cells.length; i++) {
      const cell = this.grid.cells[i];
      if (this.state[i] === EMPTY) {
        cell.active = false;
        cell.value = 0;
        continue;
      }
      cell.active = true;
      const t = ((this.strain[i] * STRAIN_STEP + this.gen[i] * genStep + this.moisture[i] * 0.08) % 1 + 1) % 1;
      // TIP cells get a small brightness boost to make the growing front visible.
      const tipBoost = this.state[i] === TIP ? 0.025 : 0;
      cell.value = Math.max(0.36, Math.min(1.0, 0.36 + t * 0.60 + tipBoost));
    }
  }

  private countLiving(): number {
    let n = 0;
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] !== EMPTY) n++;
    }
    return n;
  }

  private toCol(x: number): number {
    return Math.max(0, Math.min(this.options.columns - 1, Math.floor((x / Math.max(1, this.options.width)) * this.options.columns)));
  }

  private toRow(y: number): number {
    return Math.max(0, Math.min(this.options.rows - 1, Math.floor((y / Math.max(1, this.options.height)) * this.options.rows)));
  }
}
