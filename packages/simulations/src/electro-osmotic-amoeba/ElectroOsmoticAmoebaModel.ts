import { DensityField, ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface ElectroOsmoticAmoebaModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  cellCount: number;
  particleBudget: number;
  voltage: number;
  osmoticPressure: number;
  membraneElasticity: number;
  ionDiffusion: number;
  fieldRadius: number;
}

export interface ElectroOsmoticAmoebaStats {
  particleCount: number;
  cellCount: number;
  meanCharge: number;
  meanSpeed: number;
  densityMax: number;
  potentialVariance: number;
  fieldVariance: number;
}

interface IonParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  charge: number;
  radius: number;
  cellId: number;
}

export class ElectroOsmoticAmoebaModel {
  readonly densityField: DensityField;
  readonly potentialField: ScalarField;
  private readonly particles: IonParticle[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;
  private nextCellId = 1;

  constructor(private readonly options: ElectroOsmoticAmoebaModelOptions) {
    this.densityField = new DensityField(options.columns, options.rows);
    this.potentialField = new ScalarField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.nextCellId = 1;
    this.particles.length = 0;
    const cells = Math.max(1, Math.floor(this.options.cellCount));
    const ionsPerCell = Math.max(3, Math.floor(this.options.particleBudget / cells));
    for (let i = 0; i < cells; i++) {
      this.spawnCell(this.rng.range(0.18, 0.82) * this.options.width, this.rng.range(0.2, 0.82) * this.options.height, ionsPerCell);
    }
    this.trimToBudget();
    this.projectFields();
  }

  update(dt: number): void {
    this.time += dt;
    this.diffusePotential(dt);
    const centers = this.groupCenters();
    for (const p of this.particles) {
      const center = centers.get(p.cellId) ?? { x: p.x, y: p.y, charge: p.charge, count: 1 };
      const dx = center.x - p.x;
      const dy = center.y - p.y;
      const chargeSign = p.charge >= 0 ? 1 : -1;
      const pump = this.options.voltage * chargeSign;
      const membraneWave = Math.sin(this.time * 1.8 + p.cellId * 0.73 + p.y * 0.015);
      p.vx += dx * this.options.membraneElasticity * dt;
      p.vy += dy * this.options.membraneElasticity * dt;
      p.vx += pump * (28 + Math.abs(center.charge) * 10) * dt;
      p.vy += (membraneWave * 18 - this.options.osmoticPressure * p.charge * 16) * dt;
      p.vx += Math.cos(this.time * 1.1 + p.y * 0.02) * this.options.ionDiffusion * 24 * dt;
      p.vy += Math.sin(this.time * 1.35 + p.x * 0.018) * this.options.ionDiffusion * 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.988;
      p.vy *= 0.988;
      p.charge = Math.max(-1.8, Math.min(1.8, p.charge + Math.sin(this.time + p.x * 0.01) * this.options.voltage * 0.012));
      this.bounce(p);
    }
    this.exchangeCharge();
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.spawnCell(event.x, event.y, 5);
    if (event.kind === 'drag') this.electroDrag(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
    if (event.kind === 'hold') this.chargePlume(event.x, event.y, 0.9);
    if (event.kind === 'fast_swipe') this.fissionNear(event.x, event.y, event.dx ?? 120, event.dy ?? 0);
    this.trimToBudget();
    this.projectFields();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 0.9 || stats.potentialVariance < 0.0008 || stats.cellCount <= 1;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'ion flow collapsed or membrane voltage equalized' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4500) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const largest = this.largestCellId();
    if (largest !== undefined) this.splitCell(largest, this.rng.range(-160, 160), this.rng.range(-80, 80));
    this.chargePlume(this.options.width * this.rng.range(0.2, 0.8), this.options.height * this.rng.range(0.22, 0.78), 1.1);
    for (const p of this.particles) {
      p.vx += this.rng.range(-35, 35);
      p.vy += this.rng.range(-28, 28);
      p.charge += this.rng.range(-0.35, 0.35);
    }
    this.stagnantMs = 0;
    this.trimToBudget();
    this.projectFields();
  }

  setVoltage(v: number): void { this.options.voltage = v; }
  setOsmoticPressure(v: number): void { this.options.osmoticPressure = v; }
  setMembraneElasticity(v: number): void { this.options.membraneElasticity = v; }
  setIonDiffusion(v: number): void { this.options.ionDiffusion = v; }

  stats(): ElectroOsmoticAmoebaStats {
    let charge = 0;
    let speed = 0;
    for (const p of this.particles) {
      charge += Math.abs(p.charge);
      speed += Math.hypot(p.vx, p.vy);
    }
    const densityStats = this.densityField.stats();
    const potentialStats = this.potentialField.stats();
    return {
      particleCount: this.particles.length,
      cellCount: this.groupSizes().size,
      meanCharge: charge / Math.max(1, this.particles.length),
      meanSpeed: speed / Math.max(1, this.particles.length),
      densityMax: densityStats.max,
      potentialVariance: potentialStats.variance,
      fieldVariance: densityStats.variance + potentialStats.variance,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number; charge: number; cellId: number }> {
    return this.particles.map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), vx: Number(p.vx.toFixed(2)), vy: Number(p.vy.toFixed(2)), charge: Number(p.charge.toFixed(3)), cellId: p.cellId }));
  }

  particleSnapshot(): Array<{ x: number; y: number }> {
    return this.particles.map((p) => ({ x: p.x, y: p.y }));
  }

  renderParticles(): SimParticle[] {
    return this.particles.map((p) => ({
      position: { x: p.x, y: p.y },
      velocity: { x: p.vx, y: p.vy },
      size: p.radius,
      color: p.charge >= 0 ? 0xff6fd8 : 0x45f6ff,
      alpha: 0.48 + Math.min(0.42, Math.abs(p.charge) * 0.2),
    }));
  }

  freezeForTest(): void {
    if (this.particles.length > 0) {
      const id = this.particles[0].cellId;
      for (const p of this.particles) {
        p.cellId = id;
        p.vx = 0;
        p.vy = 0;
        p.charge = 0;
      }
    }
    this.projectFields();
  }

  mergeAllForTest(): void {
    const id = this.particles[0]?.cellId ?? 1;
    for (const p of this.particles) p.cellId = id;
  }

  private spawnCell(x: number, y: number, count: number): void {
    const cellId = this.nextCellId++;
    for (let i = 0; i < count && this.particles.length < this.options.particleBudget; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(0, 22);
      const charge = (i % 2 === 0 ? 1 : -1) * this.rng.range(0.35, 1.15);
      this.particles.push({
        x: Math.max(0, Math.min(this.options.width, x + Math.cos(angle) * dist)),
        y: Math.max(0, Math.min(this.options.height, y + Math.sin(angle) * dist)),
        vx: this.rng.range(-18, 18),
        vy: this.rng.range(-18, 18),
        charge,
        radius: this.rng.range(5, 11),
        cellId,
      });
    }
  }

  private electroDrag(x: number, y: number, dx: number, dy: number): void {
    for (const p of this.particles) {
      const falloff = this.radialFalloff(p, x, y, 170);
      p.vx += dx * 2.1 * falloff;
      p.vy += dy * 2.1 * falloff;
      p.charge = Math.max(-1.8, Math.min(1.8, p.charge + (dx >= 0 ? 0.12 : -0.12) * falloff));
    }
  }

  private chargePlume(x: number, y: number, amount: number): void {
    for (const p of this.particles) {
      const falloff = this.radialFalloff(p, x, y, 190);
      p.charge = Math.max(-1.8, Math.min(1.8, p.charge + amount * falloff * (p.x < x ? -1 : 1)));
      p.vx += (p.x < x ? -38 : 38) * falloff;
      p.vy -= 18 * falloff;
    }
    this.paintPotential(x, y, amount);
  }

  private fissionNear(x: number, y: number, dx: number, dy: number): void {
    const id = this.nearestCellId(x, y) ?? this.largestCellId();
    if (id !== undefined) this.splitCell(id, dx, dy);
  }

  private splitCell(cellId: number, dx: number, dy: number): void {
    const newId = this.nextCellId++;
    let flip = false;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / length;
    const ny = dy / length;
    for (const p of this.particles) {
      if (p.cellId !== cellId) continue;
      flip = !flip;
      if (!flip) continue;
      p.cellId = newId;
      p.vx += nx * 82;
      p.vy += ny * 82;
      p.charge *= -1;
    }
  }

  private exchangeCharge(): void {
    const centers = this.groupCenters();
    for (const p of this.particles) {
      const center = centers.get(p.cellId);
      if (!center) continue;
      p.charge += (center.charge - p.charge) * 0.006;
    }
  }

  private projectFields(): void {
    this.densityField.fill(0);
    this.potentialField.fill(0);
    for (const p of this.particles) {
      const gx = Math.floor((p.x / Math.max(1, this.options.width)) * (this.options.columns - 1));
      const gy = Math.floor((p.y / Math.max(1, this.options.height)) * (this.options.rows - 1));
      const radius = Math.max(1, Math.round(this.options.fieldRadius));
      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const dist = Math.hypot(ox, oy);
          if (dist > radius) continue;
          const falloff = 1 - dist / (radius + 0.001);
          const x = gx + ox;
          const y = gy + oy;
          this.densityField.set(x, y, Math.min(1.8, this.densityField.get(x, y) + falloff * 0.42));
          this.potentialField.set(x, y, Math.max(-1.4, Math.min(1.4, this.potentialField.get(x, y) + p.charge * falloff * 0.26)));
        }
      }
    }
  }

  private diffusePotential(dt: number): void {
    const copy = new Float32Array(this.potentialField.values);
    const columns = this.potentialField.columns;
    const rows = this.potentialField.rows;
    const mix = Math.min(0.35, this.options.ionDiffusion * dt);
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < columns - 1; x++) {
        const i = y * columns + x;
        const avg = (copy[i - 1] + copy[i + 1] + copy[i - columns] + copy[i + columns]) * 0.25;
        this.potentialField.values[i] = copy[i] + (avg - copy[i]) * mix;
      }
    }
  }

  private groupCenters(): Map<number, { x: number; y: number; charge: number; count: number }> {
    const groups = new Map<number, { x: number; y: number; charge: number; count: number }>();
    for (const p of this.particles) {
      const group = groups.get(p.cellId) ?? { x: 0, y: 0, charge: 0, count: 0 };
      group.x += p.x;
      group.y += p.y;
      group.charge += p.charge;
      group.count += 1;
      groups.set(p.cellId, group);
    }
    for (const group of Array.from(groups.values())) {
      group.x /= group.count;
      group.y /= group.count;
      group.charge /= group.count;
    }
    return groups;
  }

  private groupSizes(): Map<number, number> {
    const sizes = new Map<number, number>();
    for (const p of this.particles) sizes.set(p.cellId, (sizes.get(p.cellId) ?? 0) + 1);
    return sizes;
  }

  private largestCellId(): number | undefined {
    let best: number | undefined;
    let size = -1;
    for (const [id, count] of Array.from(this.groupSizes())) if (count > size) { best = id; size = count; }
    return best;
  }

  private nearestCellId(x: number, y: number): number | undefined {
    let best: number | undefined;
    let dist = Number.POSITIVE_INFINITY;
    for (const [id, center] of Array.from(this.groupCenters())) {
      const d = Math.hypot(center.x - x, center.y - y);
      if (d < dist) { best = id; dist = d; }
    }
    return best;
  }

  private trimToBudget(): void {
    while (this.particles.length > this.options.particleBudget) this.particles.pop();
  }

  private radialFalloff(p: IonParticle, x: number, y: number, radius: number): number {
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist >= radius) return 0;
    return 1 - dist / radius;
  }

  private paintPotential(x: number, y: number, amount: number): void {
    const gx = Math.floor((x / Math.max(1, this.options.width)) * (this.options.columns - 1));
    const gy = Math.floor((y / Math.max(1, this.options.height)) * (this.options.rows - 1));
    for (let oy = -5; oy <= 5; oy++) for (let ox = -5; ox <= 5; ox++) {
      const falloff = Math.max(0, 1 - Math.hypot(ox, oy) / 5);
      this.potentialField.set(gx + ox, gy + oy, this.potentialField.get(gx + ox, gy + oy) + amount * falloff);
    }
  }

  private bounce(p: IonParticle): void {
    if (p.x < 0 || p.x > this.options.width) {
      p.x = Math.max(0, Math.min(this.options.width, p.x));
      p.vx *= -0.72;
    }
    if (p.y < 0 || p.y > this.options.height) {
      p.y = Math.max(0, Math.min(this.options.height, p.y));
      p.vy *= -0.72;
    }
  }
}
