import { DensityField, ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface AmoebaLampModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  blobCount: number;
  particleBudget: number;
  densityRadius: number;
  heatDiffusion: number;
  surfaceTension: number;
  buoyancy: number;
}

export interface AmoebaLampStats {
  particleCount: number;
  blobCount: number;
  meanHeat: number;
  meanSpeed: number;
  densityMax: number;
  largestBlobSize: number;
  fieldVariance: number;
}

interface BlobParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heat: number;
  radius: number;
  blobId: number;
}

export class AmoebaLampModel {
  readonly densityField: DensityField;
  readonly heatField: ScalarField;
  private readonly particles: BlobParticle[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;
  private nextBlobId = 1;

  constructor(private readonly options: AmoebaLampModelOptions) {
    this.densityField = new DensityField(options.columns, options.rows);
    this.heatField = new ScalarField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.nextBlobId = 1;
    this.particles.length = 0;
    const count = Math.max(1, Math.min(this.options.particleBudget, Math.floor(this.options.blobCount)));
    for (let i = 0; i < count; i++) this.spawnBlob(this.rng.range(0.18, 0.82) * this.options.width, this.rng.range(0.18, 0.82) * this.options.height, 3 + this.rng.int(0, 3));
    this.trimToBudget();
    this.projectFields();
  }

  update(dt: number): void {
    this.time += dt;
    this.diffuseHeat(dt);
    this.mergeNearParticles();
    const groups = this.groupCenters();
    for (const p of this.particles) {
      const center = groups.get(p.blobId) ?? { x: p.x, y: p.y, count: 1 };
      const dx = center.x - p.x;
      const dy = center.y - p.y;
      p.vx += dx * this.options.surfaceTension * dt;
      p.vy += dy * this.options.surfaceTension * dt;
      p.vy -= (0.18 + p.heat) * this.options.buoyancy * dt;
      p.vx += Math.sin(this.time * 1.7 + p.y * 0.021 + p.blobId) * 8 * dt;
      p.vy += Math.cos(this.time * 1.3 + p.x * 0.017) * 5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.992;
      p.vy *= 0.992;
      p.heat = Math.max(0, p.heat * (1 - 0.055 * dt));
      this.bounce(p);
    }
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.spawnBlob(event.x, event.y, 4);
    if (event.kind === 'drag') this.stir(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
    if (event.kind === 'hold') this.injectHeat(event.x, event.y, 0.75);
    if (event.kind === 'fast_swipe') this.splitNear(event.x, event.y, event.dx ?? 80, event.dy ?? 0);
    this.trimToBudget();
    this.projectFields();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 1.2 || stats.blobCount <= 1;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'blob motion collapsed or all particles merged into one organism' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4500) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const largest = this.largestBlobId();
    if (largest !== undefined) this.splitBlob(largest, this.rng.range(-130, 130), this.rng.range(-30, 30));
    this.injectHeat(this.options.width * this.rng.range(0.25, 0.75), this.options.height * this.rng.range(0.58, 0.92), 0.9);
    for (const p of this.particles) {
      p.vx += this.rng.range(-22, 22);
      p.vy += this.rng.range(-38, -8);
    }
    this.stagnantMs = 0;
    this.trimToBudget();
    this.projectFields();
  }

  // Live-settable parameters — called from the scene each tick when a slider value changes.
  setSurfaceTension(v: number): void { this.options.surfaceTension = v; }
  setBuoyancy(v: number): void { this.options.buoyancy = v; }
  setDensityRadius(v: number): void { this.options.densityRadius = v; }

  stats(): AmoebaLampStats {
    let heat = 0;
    let speed = 0;
    for (const p of this.particles) {
      heat += p.heat;
      speed += Math.hypot(p.vx, p.vy);
    }
    const fieldStats = this.densityField.stats();
    const groups = this.groupSizes();
    return {
      particleCount: this.particles.length,
      blobCount: groups.size,
      meanHeat: heat / Math.max(1, this.particles.length),
      meanSpeed: speed / Math.max(1, this.particles.length),
      densityMax: fieldStats.max,
      largestBlobSize: Math.max(0, ...Array.from(groups.values())),
      fieldVariance: fieldStats.variance,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number; heat: number; blobId: number }> {
    return this.particles.map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), vx: Number(p.vx.toFixed(2)), vy: Number(p.vy.toFixed(2)), heat: Number(p.heat.toFixed(3)), blobId: p.blobId }));
  }

  particleSnapshot(): Array<{ x: number; y: number }> {
    return this.particles.map((p) => ({ x: p.x, y: p.y }));
  }

  renderParticles(): SimParticle[] {
    return this.particles.map((p) => ({ position: { x: p.x, y: p.y }, velocity: { x: p.vx, y: p.vy }, size: p.radius, color: 0xffffff, alpha: 0.62 + Math.min(0.35, p.heat * 0.25) }));
  }

  freezeForTest(): void {
    if (this.particles.length > 0) {
      const id = this.particles[0].blobId;
      for (const p of this.particles) {
        p.blobId = id;
        p.vx = 0;
        p.vy = 0;
        p.heat = 0;
      }
    }
    this.projectFields();
  }

  mergeAllForTest(): void {
    const id = this.particles[0]?.blobId ?? 1;
    for (const p of this.particles) p.blobId = id;
  }

  private spawnBlob(x: number, y: number, count: number): void {
    const blobId = this.nextBlobId++;
    for (let i = 0; i < count && this.particles.length < this.options.particleBudget; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(0, 18);
      this.particles.push({
        x: Math.max(0, Math.min(this.options.width, x + Math.cos(angle) * dist)),
        y: Math.max(0, Math.min(this.options.height, y + Math.sin(angle) * dist)),
        vx: this.rng.range(-16, 16),
        vy: this.rng.range(-22, 14),
        heat: this.rng.range(0.15, 0.75),
        radius: this.rng.range(7, 13),
        blobId,
      });
    }
  }

  private stir(x: number, y: number, dx: number, dy: number): void {
    for (const p of this.particles) {
      const falloff = this.radialFalloff(p, x, y, 150);
      p.vx += dx * 2.2 * falloff;
      p.vy += dy * 2.2 * falloff;
    }
  }

  private injectHeat(x: number, y: number, amount: number): void {
    for (const p of this.particles) {
      const falloff = this.radialFalloff(p, x, y, 170);
      p.heat = Math.min(2, p.heat + amount * falloff);
      p.vy -= 35 * falloff;
    }
    this.paintHeat(x, y, amount);
  }

  private splitNear(x: number, y: number, dx: number, dy: number): void {
    const id = this.nearestBlobId(x, y) ?? this.largestBlobId();
    if (id !== undefined) this.splitBlob(id, dx, dy);
  }

  private splitBlob(blobId: number, dx: number, dy: number): void {
    const newId = this.nextBlobId++;
    let flip = false;
    for (const p of this.particles) {
      if (p.blobId !== blobId) continue;
      flip = !flip;
      if (!flip) continue;
      p.blobId = newId;
      const nx = dx === 0 && dy === 0 ? 1 : dx / Math.max(1, Math.hypot(dx, dy));
      const ny = dx === 0 && dy === 0 ? 0 : dy / Math.max(1, Math.hypot(dx, dy));
      p.vx += nx * 75;
      p.vy += ny * 75 - 18;
      p.heat = Math.min(2, p.heat + 0.22);
    }
  }

  private mergeNearParticles(): void {
    const centers = this.groupCenters();
    const entries = Array.from(centers.entries());
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [aId, a] = entries[i];
        const [bId, b] = entries[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 32) for (const p of this.particles) if (p.blobId === bId) p.blobId = aId;
      }
    }
  }

  private diffuseHeat(dt: number): void {
    for (const p of this.particles) p.heat = Math.max(0, p.heat - this.options.heatDiffusion * 0.035 * dt);
  }

  private projectFields(): void {
    this.densityField.fill(0);
    this.heatField.fill(0);
    const sx = (this.options.columns - 1) / Math.max(1, this.options.width);
    const sy = (this.options.rows - 1) / Math.max(1, this.options.height);
    for (const p of this.particles) {
      const cx = p.x * sx;
      const cy = p.y * sy;
      const radius = this.options.densityRadius;
      const minX = Math.max(0, Math.floor(cx - radius));
      const maxX = Math.min(this.options.columns - 1, Math.ceil(cx + radius));
      const minY = Math.max(0, Math.floor(cy - radius));
      const maxY = Math.min(this.options.rows - 1, Math.ceil(cy + radius));
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        const density = Math.max(0, 1 - d2 / (radius * radius));
        const i = y * this.options.columns + x;
        this.densityField.values[i] = Math.min(1.6, this.densityField.values[i] + density * 0.68);
        this.heatField.values[i] = Math.min(1.8, this.heatField.values[i] + density * p.heat);
      }
    }
  }

  private paintHeat(x: number, y: number, amount: number): void {
    const cx = Math.floor((x / Math.max(1, this.options.width)) * this.options.columns);
    const cy = Math.floor((y / Math.max(1, this.options.height)) * this.options.rows);
    for (let yy = cy - 3; yy <= cy + 3; yy++) for (let xx = cx - 3; xx <= cx + 3; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.options.columns || yy >= this.options.rows) continue;
      const d = Math.hypot(xx - cx, yy - cy);
      const i = yy * this.options.columns + xx;
      this.heatField.values[i] = Math.min(2, this.heatField.values[i] + amount * Math.max(0, 1 - d / 3.5));
    }
  }

  private groupCenters(): Map<number, { x: number; y: number; count: number }> {
    const groups = new Map<number, { x: number; y: number; count: number }>();
    for (const p of this.particles) {
      const g = groups.get(p.blobId) ?? { x: 0, y: 0, count: 0 };
      g.x += p.x;
      g.y += p.y;
      g.count++;
      groups.set(p.blobId, g);
    }
    for (const g of Array.from(groups.values())) {
      g.x /= Math.max(1, g.count);
      g.y /= Math.max(1, g.count);
    }
    return groups;
  }

  private groupSizes(): Map<number, number> {
    const groups = new Map<number, number>();
    for (const p of this.particles) groups.set(p.blobId, (groups.get(p.blobId) ?? 0) + 1);
    return groups;
  }

  private largestBlobId(): number | undefined {
    let best: number | undefined;
    let bestCount = -1;
    for (const [id, count] of Array.from(this.groupSizes().entries())) if (count > bestCount) { best = id; bestCount = count; }
    return best;
  }

  private nearestBlobId(x: number, y: number): number | undefined {
    let best: number | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [id, c] of Array.from(this.groupCenters().entries())) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestDistance) { best = id; bestDistance = d; }
    }
    return best;
  }

  private radialFalloff(p: BlobParticle, x: number, y: number, radius: number): number {
    return Math.max(0, 1 - Math.hypot(p.x - x, p.y - y) / radius);
  }

  private bounce(p: BlobParticle): void {
    if (p.x < 0 || p.x > this.options.width) { p.x = Math.max(0, Math.min(this.options.width, p.x)); p.vx *= -0.72; }
    if (p.y < 0 || p.y > this.options.height) { p.y = Math.max(0, Math.min(this.options.height, p.y)); p.vy *= -0.72; }
  }

  private trimToBudget(): void {
    if (this.particles.length > this.options.particleBudget) this.particles.length = this.options.particleBudget;
  }
}
