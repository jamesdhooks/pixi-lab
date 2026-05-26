import { ScalarField, SeededRng, TrailField } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface PlasmaBranchModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  maxBranches: number;
  chargeDecay: number;
  branchEnergy?: number;
}

export interface PlasmaBranchStats {
  branchCount: number;
  activeBranchCount: number;
  totalCharge: number;
  chargeMax: number;
  chargeVariance: number;
  scarMax: number;
  scarVariance: number;
}

interface BranchTip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
}

export class PlasmaBranchModel {
  readonly chargeField: ScalarField;
  readonly scarField: TrailField;
  private readonly branches: BranchTip[] = [];
  private rng: SeededRng;
  private stagnantMs = 0;

  constructor(private readonly options: PlasmaBranchModelOptions) {
    this.chargeField = new ScalarField(options.columns, options.rows);
    this.scarField = new TrailField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.stagnantMs = 0;
    this.branches.length = 0;
    this.chargeField.fill(0);
    this.scarField.fill(0);
    for (let i = 0; i < 4; i++) this.injectCharge(this.rng.range(0.15, 0.85) * this.options.width, this.rng.range(0.18, 0.82) * this.options.height, this.rng.range(0.65, 1.05));
    this.spawnBranch(this.options.width * 0.5, this.options.height * 0.5, this.rng.range(0, Math.PI * 2), this.branchEnergy() * 0.9);
  }

  update(dt: number): void {
    const fade = Math.pow(this.options.chargeDecay, Math.max(1, dt * 60));
    for (let i = 0; i < this.chargeField.values.length; i++) this.chargeField.values[i] *= fade;
    this.scarField.fade(Math.pow(0.965, Math.max(1, dt * 60)));

    if (this.rng.next() < dt * 0.7) this.injectCharge(this.rng.range(0, this.options.width), this.rng.range(0, this.options.height), this.rng.range(0.22, 0.48));

    for (const branch of this.branches) {
      const nx = branch.x / Math.max(1, this.options.width);
      const ny = branch.y / Math.max(1, this.options.height);
      const gradient = this.chargeField.gradientNormalized(nx, ny);
      const jitter = this.rng.range(-0.55, 0.55);
      branch.vx += gradient.x * 160 * dt + Math.cos(branch.age * 4.3 + jitter) * 18 * dt;
      branch.vy += gradient.y * 160 * dt + Math.sin(branch.age * 3.7 - jitter) * 18 * dt;
      const speed = Math.max(12, Math.hypot(branch.vx, branch.vy));
      branch.vx = (branch.vx / speed) * Math.min(210, speed);
      branch.vy = (branch.vy / speed) * Math.min(210, speed);
      branch.x += branch.vx * dt;
      branch.y += branch.vy * dt;
      branch.age += dt;
      branch.energy *= Math.max(0, 1 - 0.34 * dt);
      this.keepInBounds(branch);
      this.deposit(branch.x, branch.y, branch.energy);
      if (branch.energy > 0.22 && this.branches.length < this.options.maxBranches && this.rng.next() < dt * 1.35) {
        this.spawnBranch(branch.x, branch.y, Math.atan2(branch.vy, branch.vx) + this.rng.range(-0.95, 0.95), branch.energy * this.rng.range(0.42, 0.72));
        branch.energy *= 0.78;
      }
    }
    for (let i = this.branches.length - 1; i >= 0; i--) if (this.branches[i].energy < 0.04 || this.branches[i].age > 4.8) this.branches.splice(i, 1);
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') {
      this.injectCharge(event.x, event.y, 1.1);
      this.spawnBranch(event.x, event.y, this.rng.range(0, Math.PI * 2), this.branchEnergy());
    }
    if (event.kind === 'hold') {
      this.injectCharge(event.x, event.y, 1.6);
      for (let i = 0; i < 2; i++) this.spawnBranch(event.x, event.y, this.rng.range(0, Math.PI * 2), this.branchEnergy() * 0.8);
    }
    if (event.kind === 'drag') this.injectLine(event.x - (event.dx ?? 0), event.y - (event.dy ?? 0), event.x, event.y, 0.55);
    if (event.kind === 'fast_swipe') {
      const dx = event.dx ?? 120;
      const dy = event.dy ?? 0;
      this.injectLine(event.x - dx, event.y - dy, event.x + dx * 0.25, event.y + dy * 0.25, 0.92);
      this.spawnBranch(event.x, event.y, Math.atan2(dy, dx), this.branchEnergy() * 1.3);
    }
    while (this.branches.length > this.options.maxBranches) this.branches.shift();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.activeBranchCount === 0 || stats.totalCharge < 0.2 || stats.chargeVariance < 0.000005;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return { stagnant: this.stagnantMs >= 1200, reason: stagnant ? 'plasma field lost charge or active discharge branches' : undefined, severity: stagnant ? Math.min(1, this.stagnantMs / 3600) : 0, observedForMs: this.stagnantMs };
  }

  stabilize(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    this.injectCharge(cx, cy, 1.4);
    for (let i = 0; i < 5; i++) this.spawnBranch(cx, cy, (i / 5) * Math.PI * 2 + this.rng.range(-0.2, 0.2), this.branchEnergy() * 0.85);
    this.stagnantMs = 0;
  }

  stats(): PlasmaBranchStats {
    const charge = this.chargeField.stats();
    const scar = this.scarField.stats();
    let totalCharge = 0;
    for (let i = 0; i < this.chargeField.values.length; i++) totalCharge += this.chargeField.values[i];
    return { branchCount: this.branches.length, activeBranchCount: this.branches.filter((b) => b.energy > 0.12).length, totalCharge, chargeMax: charge.max, chargeVariance: charge.variance, scarMax: scar.max, scarVariance: scar.variance };
  }

  snapshot(): Array<{ x: number; y: number; energy: number; chargeMax: number }> {
    return this.branches.slice(0, 16).map((b) => ({ x: Number(b.x.toFixed(2)), y: Number(b.y.toFixed(2)), energy: Number(b.energy.toFixed(3)), chargeMax: Number(this.chargeField.stats().max.toFixed(3)) }));
  }

  renderParticles(): SimParticle[] {
    return this.branches.map((b) => ({ position: { x: b.x, y: b.y }, velocity: { x: b.vx, y: b.vy }, size: 2 + b.energy * 5, color: 0xffffff, alpha: 0.32 + Math.min(0.6, b.energy * 0.55) }));
  }

  drainForTest(): void {
    this.branches.length = 0;
    this.chargeField.fill(0);
    this.scarField.fill(0);
    this.stagnantMs = 0;
  }

  private branchEnergy(): number {
    return this.options.branchEnergy ?? 0.95;
  }

  private injectLine(x0: number, y0: number, x1: number, y1: number, amount: number): void {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      this.injectCharge(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, amount);
    }
  }

  private injectCharge(x: number, y: number, amount: number): void {
    const gx = Math.round((x / Math.max(1, this.options.width)) * (this.options.columns - 1));
    const gy = Math.round((y / Math.max(1, this.options.height)) * (this.options.rows - 1));
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const d = Math.hypot(ox, oy);
      const current = this.chargeField.get(gx + ox, gy + oy);
      this.chargeField.set(gx + ox, gy + oy, Math.min(1.8, current + amount * Math.max(0, 1 - d / 2.8)));
    }
  }

  private spawnBranch(x: number, y: number, angle: number, energy: number): void {
    this.branches.push({ x, y, vx: Math.cos(angle) * 78, vy: Math.sin(angle) * 78, energy, age: 0 });
  }

  private deposit(x: number, y: number, amount: number): void {
    const gx = Math.round((x / Math.max(1, this.options.width)) * (this.options.columns - 1));
    const gy = Math.round((y / Math.max(1, this.options.height)) * (this.options.rows - 1));
    this.scarField.set(gx, gy, Math.min(1, this.scarField.get(gx, gy) + amount * 0.16));
    this.chargeField.set(gx, gy, Math.max(0, this.chargeField.get(gx, gy) - amount * 0.035));
  }

  private keepInBounds(branch: BranchTip): void {
    if (branch.x < 0 || branch.x > this.options.width) branch.vx *= -0.8;
    if (branch.y < 0 || branch.y > this.options.height) branch.vy *= -0.8;
    branch.x = Math.max(0, Math.min(this.options.width, branch.x));
    branch.y = Math.max(0, Math.min(this.options.height, branch.y));
  }
}
