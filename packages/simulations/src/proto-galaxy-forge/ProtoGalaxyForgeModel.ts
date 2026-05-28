import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';
import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';

export interface ProtoGalaxyForgeModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  particleCount: number;
  wellCount: number;
  gravityStrength: number;
  spinBias: number;
  fusionRate: number;
}

export interface ProtoGalaxyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  heat: number;
  age: number;
}

export interface ProtoGalaxyWell {
  x: number;
  y: number;
  mass: number;
  phase: number;
}

export interface ProtoGalaxyForgeStats {
  columns: number;
  rows: number;
  particleCount: number;
  wellCount: number;
  densityMean: number;
  densityVariance: number;
  heatMean: number;
  heatVariance: number;
  motionEnergy: number;
  boundedParticles: number;
}

export class ProtoGalaxyForgeModel {
  readonly densityField: ScalarField;
  readonly heatField: ScalarField;
  readonly gravityField: ScalarField;
  readonly particles: ProtoGalaxyParticle[] = [];
  readonly wells: ProtoGalaxyWell[] = [];
  private rng: SeededRng;
  private time = 0;
  private motionEnergy = 0;
  private stagnantMs = 0;

  constructor(private readonly options: ProtoGalaxyForgeModelOptions) {
    this.densityField = new ScalarField(options.columns, options.rows);
    this.heatField = new ScalarField(options.columns, options.rows);
    this.gravityField = new ScalarField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.motionEnergy = 0;
    this.stagnantMs = 0;
    this.particles.length = 0;
    this.wells.length = 0;
    for (let i = 0; i < Math.max(1, Math.floor(this.options.wellCount)); i++) this.wells.push(this.makeWell(i));
    for (let i = 0; i < Math.max(8, Math.floor(this.options.particleCount)); i++) this.particles.push(this.makeParticle());
    this.projectFields();
  }

  update(dt: number): void {
    const scaled = Math.max(0.05, Math.min(0.8, dt * 60));
    this.time += dt;
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (let i = 0; i < this.wells.length; i++) {
      const well = this.wells[i];
      const orbit = 0.18 + i * 0.037;
      well.phase += dt * orbit * (this.options.spinBias >= 0 ? 1 : -1);
      const drift = Math.sin(this.time * 0.17 + i) * 0.22;
      well.x += (cx + Math.cos(well.phase) * this.options.width * (0.12 + drift * 0.05) - well.x) * 0.004 * scaled;
      well.y += (cy + Math.sin(well.phase * 0.83) * this.options.height * (0.10 + drift * 0.04) - well.y) * 0.004 * scaled;
    }

    let energy = 0;
    for (const particle of this.particles) {
      let ax = 0;
      let ay = 0;
      for (const well of this.wells) {
        const dx = well.x - particle.x;
        const dy = well.y - particle.y;
        const d2 = Math.max(90, dx * dx + dy * dy);
        const invD = 1 / Math.sqrt(d2);
        const force = (well.mass * this.options.gravityStrength) / d2;
        ax += dx * invD * force;
        ay += dy * invD * force;
        const tangent = force * this.options.spinBias * 0.55;
        ax += -dy * invD * tangent;
        ay += dx * invD * tangent;
        if (d2 < 2600) particle.heat = Math.min(2.4, particle.heat + this.options.fusionRate * 0.018 * scaled);
      }
      particle.vx = (particle.vx + ax * scaled) * 0.992;
      particle.vy = (particle.vy + ay * scaled) * 0.992;
      particle.x += particle.vx * scaled;
      particle.y += particle.vy * scaled;
      particle.age += dt;
      particle.heat = Math.max(0.08, particle.heat * (1 - 0.0045 * scaled) + Math.hypot(particle.vx, particle.vy) * 0.002);
      this.wrapParticle(particle);
      energy += Math.hypot(particle.vx, particle.vy);
    }
    this.motionEnergy = energy / Math.max(1, this.particles.length);
    this.projectFields();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'hold') this.seedWell(event.x, event.y, 1.2);
    else if (event.kind === 'drag' || event.kind === 'fast_swipe') this.applyShear(event.x, event.y, event.dx ?? 0, event.dy ?? 0, event.kind === 'fast_swipe' ? 2.2 : 1.1);
    else this.nova(event.x, event.y, 110, 1.45);
    this.projectFields();
  }

  setGravityStrength(value: number): void { this.options.gravityStrength = value; }
  setSpinBias(value: number): void { this.options.spinBias = value; }
  setFusionRate(value: number): void { this.options.fusionRate = value; }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.motionEnergy < 0.01 || stats.densityVariance < 0.00008 || stats.heatVariance < 0.00005;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1600,
      reason: stagnant ? 'proto galaxy forge lost orbital motion or nebula contrast' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 5000) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    this.nova(cx + this.rng.range(-80, 80), cy + this.rng.range(-80, 80), 180, 2.2);
    for (const well of this.wells) {
      well.mass = Math.min(3.4, well.mass + this.rng.range(0.12, 0.38));
    }
    this.stagnantMs = 0;
    this.projectFields();
  }

  stats(): ProtoGalaxyForgeStats {
    const density = this.densityField.stats();
    const heat = this.heatField.stats();
    return {
      columns: this.options.columns,
      rows: this.options.rows,
      particleCount: this.particles.length,
      wellCount: this.wells.length,
      densityMean: density.mean,
      densityVariance: density.variance,
      heatMean: heat.mean,
      heatVariance: heat.variance,
      motionEnergy: this.motionEnergy,
      boundedParticles: this.particles.filter((p) => p.x >= 0 && p.x <= this.options.width && p.y >= 0 && p.y <= this.options.height).length,
    };
  }

  get renderParticles(): readonly SimParticle[] {
    return this.particles.map((particle) => ({
      position: { x: particle.x, y: particle.y },
      velocity: { x: particle.vx, y: particle.vy },
      size: Math.max(1.1, Math.min(4.8, 1.2 + particle.mass * 0.9 + particle.heat * 0.45)),
      color: particle.heat > 1.3 ? 0xfff2a8 : particle.heat > 0.65 ? 0xff68d8 : 0x7ed8ff,
      alpha: Math.max(0.25, Math.min(0.95, 0.26 + particle.heat * 0.28)),
    }));
  }

  snapshot(): number[] {
    const sample: number[] = [];
    const stride = Math.max(1, Math.floor(this.densityField.values.length / 72));
    for (let i = 0; i < this.densityField.values.length && sample.length < 72; i += stride) {
      sample.push(Number((this.densityField.values[i] + this.heatField.values[i] * 0.7 + this.gravityField.values[i] * 0.3).toFixed(4)));
    }
    return sample;
  }

  flattenForTest(): void {
    for (const particle of this.particles) { particle.vx = 0; particle.vy = 0; particle.heat = 0.05; }
    this.motionEnergy = 0;
    this.densityField.values.fill(0);
    this.heatField.values.fill(0);
    this.gravityField.values.fill(0);
  }

  private makeWell(index: number): ProtoGalaxyWell {
    const angle = (index / Math.max(1, this.options.wellCount)) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
    const radius = this.rng.range(20, Math.min(this.options.width, this.options.height) * 0.26);
    return {
      x: this.options.width * 0.5 + Math.cos(angle) * radius,
      y: this.options.height * 0.5 + Math.sin(angle) * radius,
      mass: this.rng.range(1.2, 2.8),
      phase: angle,
    };
  }

  private makeParticle(): ProtoGalaxyParticle {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(this.rng.next()) * Math.min(this.options.width, this.options.height) * 0.44;
    const speed = this.rng.range(0.12, 0.9);
    const spin = this.options.spinBias >= 0 ? 1 : -1;
    return {
      x: this.options.width * 0.5 + Math.cos(angle) * radius,
      y: this.options.height * 0.5 + Math.sin(angle) * radius,
      vx: -Math.sin(angle) * speed * spin + this.rng.range(-0.18, 0.18),
      vy: Math.cos(angle) * speed * spin + this.rng.range(-0.18, 0.18),
      mass: this.rng.range(0.35, 1.4),
      heat: this.rng.range(0.12, 0.9),
      age: this.rng.range(0, 20),
    };
  }

  private wrapParticle(particle: ProtoGalaxyParticle): void {
    const margin = 16;
    if (particle.x < -margin) particle.x = this.options.width + margin;
    if (particle.x > this.options.width + margin) particle.x = -margin;
    if (particle.y < -margin) particle.y = this.options.height + margin;
    if (particle.y > this.options.height + margin) particle.y = -margin;
    particle.x = Math.max(0, Math.min(this.options.width, particle.x));
    particle.y = Math.max(0, Math.min(this.options.height, particle.y));
  }

  private seedWell(x: number, y: number, massBoost: number): void {
    let nearest = this.wells[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const well of this.wells) {
      const distance = Math.hypot(well.x - x, well.y - y);
      if (distance < nearestDistance) { nearest = well; nearestDistance = distance; }
    }
    if (!nearest) return;
    nearest.x = x;
    nearest.y = y;
    nearest.mass = Math.min(4.2, nearest.mass + massBoost);
  }

  private nova(x: number, y: number, radius: number, force: number): void {
    for (const particle of this.particles) {
      const dx = particle.x - x;
      const dy = particle.y - y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 0.001) continue;
      const falloff = Math.cos((d / radius) * Math.PI * 0.5);
      particle.vx += (dx / d) * force * falloff;
      particle.vy += (dy / d) * force * falloff;
      particle.heat = Math.min(2.4, particle.heat + force * 0.22 * falloff);
    }
  }

  private applyShear(x: number, y: number, dx: number, dy: number, force: number): void {
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / length;
    const ny = dy / length;
    for (const particle of this.particles) {
      const d = Math.hypot(particle.x - x, particle.y - y);
      if (d > 190) continue;
      const falloff = Math.cos((d / 190) * Math.PI * 0.5);
      particle.vx += nx * force * falloff;
      particle.vy += ny * force * falloff;
      particle.heat = Math.min(2.4, particle.heat + force * 0.08 * falloff);
    }
  }

  private projectFields(): void {
    this.densityField.values.fill(0);
    this.heatField.values.fill(0);
    this.gravityField.values.fill(0);
    const c = this.options.columns;
    const r = this.options.rows;
    const sx = (c - 1) / Math.max(1, this.options.width);
    const sy = (r - 1) / Math.max(1, this.options.height);
    for (const particle of this.particles) {
      const gx = Math.max(0, Math.min(c - 1, Math.round(particle.x * sx)));
      const gy = Math.max(0, Math.min(r - 1, Math.round(particle.y * sy)));
      const index = gy * c + gx;
      this.densityField.values[index] = Math.min(1.7, this.densityField.values[index] + particle.mass * 0.16);
      this.heatField.values[index] = Math.min(2.2, this.heatField.values[index] + particle.heat * 0.18);
    }
    for (let y = 0; y < r; y++) {
      const py = (y / Math.max(1, r - 1)) * this.options.height;
      for (let x = 0; x < c; x++) {
        const px = (x / Math.max(1, c - 1)) * this.options.width;
        let gravity = 0;
        for (const well of this.wells) {
          const dx = px - well.x;
          const dy = py - well.y;
          gravity += well.mass / (1 + (dx * dx + dy * dy) * 0.0016);
        }
        const index = y * c + x;
        this.gravityField.values[index] = Math.min(1.8, gravity * 0.18);
        this.densityField.values[index] = Math.min(1.8, this.densityField.values[index] + this.gravityField.values[index] * 0.14);
        this.heatField.values[index] = Math.min(2.2, this.heatField.values[index] + this.gravityField.values[index] * this.options.fusionRate * 0.055);
      }
    }
  }
}
