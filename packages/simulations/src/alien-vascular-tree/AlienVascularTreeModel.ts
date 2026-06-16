import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';
import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';

export interface AlienVascularTreeModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  branchBudget: number;
  growthRate: number;
  nutrientFlow: number;
  pruneRate: number;
}

interface VascularNode {
  x: number;
  y: number;
  parent: number;
  age: number;
  nutrient: number;
  thickness: number;
  active: boolean;
}

export interface AlienVascularTreeStats {
  columns: number;
  rows: number;
  branchCount: number;
  activeTips: number;
  meanNutrient: number;
  nutrientVariance: number;
  growthEnergy: number;
}

export class AlienVascularTreeModel {
  readonly nutrientField: ScalarField;
  readonly pulseField: ScalarField;
  readonly particles: SimParticle[] = [];
  private readonly nodes: VascularNode[] = [];
  private rng: SeededRng;
  private time = 0;
  private growthAccumulator = 0;
  private growthEnergy = 0;
  private lightX: number;
  private lightY: number;
  private stagnantMs = 0;

  constructor(private readonly options: AlienVascularTreeModelOptions) {
    this.nutrientField = new ScalarField(options.columns, options.rows);
    this.pulseField = new ScalarField(options.columns, options.rows);
    this.lightX = options.width * 0.5;
    this.lightY = options.height * 0.24;
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.nodes.length = 0;
    this.particles.length = 0;
    this.time = 0;
    this.growthAccumulator = 0;
    this.growthEnergy = 0;
    this.stagnantMs = 0;
    this.lightX = this.options.width * (0.45 + this.rng.range(-0.08, 0.08));
    this.lightY = this.options.height * (0.18 + this.rng.range(-0.04, 0.05));
    const rootCount = 3;
    for (let i = 0; i < rootCount; i++) {
      this.nodes.push({
        x: this.options.width * (0.3 + i * 0.2 + this.rng.range(-0.04, 0.04)),
        y: this.options.height * (0.78 + this.rng.range(-0.03, 0.04)),
        parent: -1,
        age: 0,
        nutrient: 1,
        thickness: 5.2,
        active: true,
      });
    }
    this.projectFields();
  }

  update(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += dt;
    this.growthAccumulator += dt * this.options.growthRate * 5.4;
    let grown = 0;
    while (this.growthAccumulator >= 1 && this.nodes.length < this.options.branchBudget) {
      this.growthAccumulator -= 1;
      if (this.growTip()) grown++;
      else break;
    }
    this.flowNutrients(safeDt);
    this.pruneWeakTips(safeDt);
    this.growthEnergy = this.growthEnergy * 0.86 + grown * 0.14;
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'drag' || event.kind === 'fast_swipe') {
      this.lightX = Math.max(0, Math.min(this.options.width, event.x + (event.dx ?? 0) * 0.5));
      this.lightY = Math.max(0, Math.min(this.options.height, event.y + (event.dy ?? 0) * 0.5));
      this.injectNutrient(this.lightX, this.lightY, 86, 1.0);
    } else if (event.kind === 'hold') {
      this.injectNutrient(event.x, event.y, 72, 1.35);
    } else {
      this.injectNutrient(event.x, event.y, 54, 0.8);
    }
    this.projectFields();
  }

  setGrowthRate(value: number): void { this.options.growthRate = value; }
  setNutrientFlow(value: number): void { this.options.nutrientFlow = value; }
  setPruneRate(value: number): void { this.options.pruneRate = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.activeTips < 2 || stats.nutrientVariance < 0.00025 || stats.growthEnergy < 0.025;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1800,
      reason: stagnant ? 'alien vascular tree lost active tips or nutrient contrast' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 5200) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (i < 3 || this.rng.next() < 0.22) node.active = true;
      node.nutrient = Math.min(1.8, node.nutrient + this.rng.range(0.18, 0.62));
    }
    for (let i = 0; i < 5 && this.nodes.length < this.options.branchBudget; i++) this.growTip(true);
    this.injectNutrient(this.options.width * this.rng.range(0.2, 0.8), this.options.height * this.rng.range(0.18, 0.72), 120, 1.1);
    this.growthEnergy = 1;
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): AlienVascularTreeStats {
    const nutrient = this.nutrientField.stats();
    let activeTips = 0;
    let sum = 0;
    for (const node of this.nodes) {
      if (node.active) activeTips++;
      sum += node.nutrient;
    }
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      branchCount: Math.max(0, this.nodes.length - 3),
      activeTips,
      meanNutrient: this.nodes.length > 0 ? sum / this.nodes.length : 0,
      nutrientVariance: nutrient.variance,
      growthEnergy: this.growthEnergy,
    };
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.nodes.length / 42));
    for (let i = 0; i < this.nodes.length && sample.length < 42; i += stride) {
      const node = this.nodes[i];
      sample.push(Number((node.x / this.options.width + node.y / this.options.height + node.nutrient * 0.17 + node.thickness * 0.03).toFixed(4)));
    }
    return sample;
  }

  starveForTest(): void {
    for (const node of this.nodes) { node.nutrient = 0.01; node.active = false; }
    this.growthEnergy = 0;
    this.projectFields();
  }

  private growTip(force = false): boolean {
    const tipIndices = this.nodes.map((node, index) => ({ node, index })).filter((entry) => entry.node.active);
    if (tipIndices.length === 0) return false;
    let best = tipIndices[Math.floor(this.rng.range(0, tipIndices.length))];
    for (const entry of tipIndices) {
      const score = entry.node.nutrient + this.lightScore(entry.node.x, entry.node.y) + this.rng.range(0, 0.35);
      const bestScore = best.node.nutrient + this.lightScore(best.node.x, best.node.y);
      if (score > bestScore) best = entry;
    }
    const parent = best.node;
    const angleToLight = Math.atan2(this.lightY - parent.y, this.lightX - parent.x);
    const upwardBias = -Math.PI / 2 + this.rng.range(-0.55, 0.55);
    const angle = angleToLight * 0.58 + upwardBias * 0.42 + this.rng.range(-0.58, 0.58);
    const length = this.rng.range(18, 42) * (force ? 1.2 : 1);
    const x = Math.max(8, Math.min(this.options.width - 8, parent.x + Math.cos(angle) * length));
    const y = Math.max(8, Math.min(this.options.height - 8, parent.y + Math.sin(angle) * length));
    const nutrient = Math.max(0.06, parent.nutrient * this.rng.range(0.62, 0.9));
    const thickness = Math.max(1.1, parent.thickness * this.rng.range(0.78, 0.94));
    this.nodes.push({ x, y, parent: best.index, age: 0, nutrient, thickness, active: true });
    parent.nutrient *= 0.72;
    parent.thickness = Math.max(parent.thickness, thickness + 0.28);
    if (!force && this.rng.next() < 0.55 + this.options.pruneRate * 0.25) parent.active = false;
    return true;
  }

  private flowNutrients(dt: number): void {
    for (const node of this.nodes) {
      node.age += dt;
      node.nutrient = Math.max(0, node.nutrient - this.options.pruneRate * dt * 0.035);
    }
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (node.parent < 0) {
        node.nutrient = Math.min(1.8, node.nutrient + dt * this.options.nutrientFlow * 0.22);
        continue;
      }
      const parent = this.nodes[node.parent];
      const pulse = (0.5 + 0.5 * Math.sin(this.time * 5 + i * 0.37)) * this.options.nutrientFlow * dt * 0.18;
      const transfer = Math.min(parent.nutrient * 0.24, pulse);
      parent.nutrient -= transfer;
      node.nutrient = Math.min(1.8, node.nutrient + transfer + this.lightScore(node.x, node.y) * dt * 0.08);
    }
  }

  private pruneWeakTips(dt: number): void {
    for (const node of this.nodes) {
      if (node.active && node.nutrient < 0.035 && node.age > 1.2 && this.rng.next() < this.options.pruneRate * dt * 0.8) node.active = false;
      if (!node.active && node.nutrient > 0.42 && this.rng.next() < 0.2) node.active = true;
    }
  }

  private injectNutrient(px: number, py: number, radius: number, amount: number): void {
    for (const node of this.nodes) {
      const d = Math.hypot(node.x - px, node.y - py);
      if (d > radius) continue;
      const falloff = Math.cos((d / radius) * Math.PI * 0.5);
      node.nutrient = Math.min(1.9, node.nutrient + amount * falloff);
      if (falloff > 0.35) node.active = true;
    }
    this.growthEnergy = Math.max(this.growthEnergy, amount * 0.4);
  }

  private lightScore(x: number, y: number): number {
    const distance = Math.hypot(x - this.lightX, y - this.lightY) / Math.max(this.options.width, this.options.height);
    return Math.max(0, 1 - distance * 1.8) * 0.72;
  }

  private projectFields(): void {
    this.nutrientField.values.fill(0);
    this.pulseField.values.fill(0);
    this.particles.length = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      this.splat(this.nutrientField.values, node.x, node.y, 2 + node.thickness * 1.8, node.nutrient * 0.62);
      this.splat(this.pulseField.values, node.x, node.y, 1.5 + node.thickness, (0.5 + 0.5 * Math.sin(this.time * 5 + i * 0.41)) * node.nutrient);
      if (node.parent >= 0) {
        const parent = this.nodes[node.parent];
        this.particles.push({
          position: { x: node.x, y: node.y },
          velocity: { x: node.x - parent.x, y: node.y - parent.y },
          size: node.thickness * (0.9 + node.nutrient * 0.35),
          color: 0xffffff,
          alpha: Math.max(0.16, Math.min(0.92, 0.24 + node.nutrient * 0.5)),
        });
      }
    }
  }

  private splat(target: Float32Array, px: number, py: number, radiusCells: number, amount: number): void {
    const c = this.options.columns;
    const r = this.options.rows;
    const gx = (px / Math.max(1, this.options.width)) * (c - 1);
    const gy = (py / Math.max(1, this.options.height)) * (r - 1);
    const minX = Math.max(0, Math.floor(gx - radiusCells));
    const maxX = Math.min(c - 1, Math.ceil(gx + radiusCells));
    const minY = Math.max(0, Math.floor(gy - radiusCells));
    const maxY = Math.min(r - 1, Math.ceil(gy + radiusCells));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - gx, y - gy);
        if (d > radiusCells) continue;
        const index = y * c + x;
        target[index] = Math.min(1.8, target[index] + amount * Math.cos((d / Math.max(1, radiusCells)) * Math.PI * 0.5));
      }
    }
  }
}
