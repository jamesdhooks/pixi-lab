import { SeededRng, TrailField } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface OrbitalShrapnelModelOptions {
  seed: number;
  width: number;
  height: number;
  particleCount: number;
  trailColumns: number;
  trailRows: number;
  planetRadius: number;
  gravity: number;
  drag: number;
  trailFade?: number;
}

export interface OrbitalShrapnelStats {
  particleCount: number;
  meanRadius: number;
  radialVariance: number;
  meanSpeed: number;
  kineticEnergy: number;
  trailMax: number;
  trailVariance: number;
  gravityWellCount: number;
  shockwaveCount: number;
}

interface DebrisParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  heat: number;
  spin: number;
}

interface GravityWell {
  x: number;
  y: number;
  strength: number;
  ttl: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  strength: number;
  ttl: number;
}

export class OrbitalShrapnelModel {
  readonly trailField: TrailField;
  private readonly particles: DebrisParticle[] = [];
  private readonly wells: GravityWell[] = [];
  private readonly shockwaves: Shockwave[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;

  constructor(private readonly options: OrbitalShrapnelModelOptions) {
    this.trailField = new TrailField(options.trailColumns, options.trailRows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.particles.length = 0;
    this.wells.length = 0;
    this.shockwaves.length = 0;
    this.trailField.fill(0);
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    const maxRadius = Math.max(this.options.planetRadius + 32, Math.min(this.options.width, this.options.height) * 0.48);
    for (let i = 0; i < this.options.particleCount; i++) {
      const radius = this.rng.range(this.options.planetRadius + 18, maxRadius);
      const angle = this.rng.range(0, Math.PI * 2);
      const tangent = this.orbitalSpeed(radius);
      const direction = this.rng.next() < 0.5 ? -1 : 1;
      this.particles.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.62,
        vx: -Math.sin(angle) * tangent * direction,
        vy: Math.cos(angle) * tangent * direction * 0.62,
        size: this.rng.range(1.1, 3.8),
        heat: this.rng.range(0.15, 0.95),
        spin: this.rng.range(-1, 1),
      });
    }
    this.depositTrails(1);
  }

  update(dt: number): void {
    this.time += dt;
    this.trailField.fade(Math.pow(this.options.trailFade ?? 0.955, Math.max(1, dt * 60)));
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (const p of this.particles) {
      const dx = p.x - cx;
      const dy = (p.y - cy) / 0.62;
      const radius = Math.max(this.options.planetRadius, Math.hypot(dx, dy));
      const force = -this.options.gravity / Math.max(1200, radius * radius * radius);
      p.vx += dx * force * dt * 60;
      p.vy += dy * force * 0.62 * dt * 60;
      for (const well of this.wells) this.applyPointForce(p, well.x, well.y, well.strength, dt);
      for (const shock of this.shockwaves) this.applyShockwave(p, shock, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - this.options.drag;
      p.vy *= 1 - this.options.drag;
      p.heat = Math.max(0.08, p.heat * (1 - 0.018 * dt));
      p.spin += 0.4 * dt;
      this.wrapParticle(p);
    }
    this.ageForces(dt);
    this.depositTrails(0.56);
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.addShrapnel(event.x, event.y);
    if (event.kind === 'drag') this.addShrapnel(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
    this.depositTrails(0.7);
  }

  addShrapnel(x: number, y: number, vx?: number, vy?: number): void {
    const orbital = this.velocityForOrbitAt(x, y);
    const speed = Math.hypot(vx ?? 0, vy ?? 0);
    const particle: DebrisParticle = {
      x,
      y,
      vx: speed > 4 ? (vx ?? 0) * 0.8 : orbital.vx,
      vy: speed > 4 ? (vy ?? 0) * 0.8 : orbital.vy,
      size: this.rng.range(1.1, 3.8),
      heat: this.rng.range(0.45, 1.25),
      spin: this.rng.range(-1, 1),
    };
    this.particles.push(particle);
    this.trimParticles();
    this.depositTrails(0.9);
  }

  influenceBody(x: number, y: number, vx: number, vy: number, dt: number): void {
    const radius = 150;
    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const falloff = Math.max(0, 1 - distance / radius);
      if (falloff <= 0) continue;
      const shove = 620 * falloff * falloff * dt;
      p.vx += (dx / distance) * shove + vx * 0.42 * falloff;
      p.vy += (dy / distance) * shove + vy * 0.42 * falloff;
      p.heat = Math.min(1.9, p.heat + 0.4 * falloff);
    }
    this.depositTrails(0.8);
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 0.45 || stats.radialVariance < 0.7 || stats.trailVariance < 0.000001;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'orbital debris collapsed into a low-energy uniform ring' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4200) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    this.addShockwave(cx, cy, 160, 1.2);
    for (const p of this.particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.max(1, Math.hypot(dx, dy));
      const radialKick = this.rng.range(-16, 26);
      p.x += (dx / len) * radialKick;
      p.y += (dy / len) * radialKick * 0.62;
      p.vx += (-dy / len) * this.rng.range(18, 48) + this.rng.range(-12, 12);
      p.vy += (dx / len) * this.rng.range(10, 32) + this.rng.range(-9, 9);
      p.heat = Math.min(1.6, p.heat + this.rng.range(0.2, 0.8));
    }
    this.stagnantMs = 0;
    this.depositTrails(1);
  }

  stats(): OrbitalShrapnelStats {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    let radiusSum = 0;
    let radiusSq = 0;
    let speed = 0;
    let kinetic = 0;
    for (const p of this.particles) {
      const r = Math.hypot(p.x - cx, (p.y - cy) / 0.62);
      const s = Math.hypot(p.vx, p.vy);
      radiusSum += r;
      radiusSq += r * r;
      speed += s;
      kinetic += s * s;
    }
    const count = Math.max(1, this.particles.length);
    const meanRadius = radiusSum / count;
    const trail = this.trailField.stats();
    return {
      particleCount: this.particles.length,
      meanRadius,
      radialVariance: radiusSq / count - meanRadius * meanRadius,
      meanSpeed: speed / count,
      kineticEnergy: kinetic / count,
      trailMax: trail.max,
      trailVariance: trail.variance,
      gravityWellCount: this.wells.length,
      shockwaveCount: this.shockwaves.length,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number; heat: number }> {
    return this.particles.slice(0, 32).map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), vx: Number(p.vx.toFixed(2)), vy: Number(p.vy.toFixed(2)), heat: Number(p.heat.toFixed(3)) }));
  }

  renderParticles(): SimParticle[] {
    return this.particles.map((p) => ({ position: { x: p.x, y: p.y }, velocity: { x: p.vx, y: p.vy }, size: p.size, color: 0xffffff, alpha: 0.42 + Math.min(0.48, p.heat * 0.36) }));
  }

  collapseForTest(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (let i = 0; i < this.particles.length; i++) {
      const angle = (i / Math.max(1, this.particles.length)) * Math.PI * 2;
      const radius = this.options.planetRadius + 55;
      const p = this.particles[i];
      p.x = cx + Math.cos(angle) * radius;
      p.y = cy + Math.sin(angle) * radius * 0.62;
      p.vx = 0;
      p.vy = 0;
      p.heat = 0.08;
    }
    this.trailField.fill(0);
  }

  private velocityForOrbitAt(x: number, y: number): { vx: number; vy: number } {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    const dx = x - cx;
    const dy = (y - cy) / 0.62;
    const radius = Math.max(this.options.planetRadius + 1, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const speed = this.orbitalSpeed(radius);
    return { vx: -Math.sin(angle) * speed, vy: Math.cos(angle) * speed * 0.62 };
  }

  private orbitalSpeed(radius: number): number {
    return Math.sqrt(this.options.gravity / Math.max(1, radius));
  }

  private trimParticles(): void {
    const maxParticles = Math.max(this.options.particleCount, Math.floor(this.options.particleCount * 1.6));
    while (this.particles.length > maxParticles) this.particles.shift();
  }

  private addShockwave(x: number, y: number, radius: number, strength: number): void {
    this.shockwaves.push({ x, y, radius, strength, ttl: 1.15 });
    this.trimForces();
  }

  private applyPointForce(p: DebrisParticle, x: number, y: number, strength: number, dt: number): void {
    const dx = x - p.x;
    const dy = y - p.y;
    const d2 = Math.max(900, dx * dx + dy * dy);
    const inv = 1 / Math.sqrt(d2);
    const accel = strength / d2;
    p.vx += dx * inv * accel * dt * 60;
    p.vy += dy * inv * accel * dt * 60;
    p.heat = Math.min(1.5, p.heat + 0.035 * dt);
  }

  private applyShockwave(p: DebrisParticle, shock: Shockwave, dt: number): void {
    const dx = p.x - shock.x;
    const dy = p.y - shock.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const band = Math.max(0, 1 - Math.abs(distance - shock.radius) / 85);
    p.vx += (dx / distance) * shock.strength * 46 * band * dt;
    p.vy += (dy / distance) * shock.strength * 46 * band * dt;
    p.heat = Math.min(1.8, p.heat + band * 0.18 * dt);
  }

  private ageForces(dt: number): void {
    for (const well of this.wells) well.ttl -= dt;
    for (const shock of this.shockwaves) {
      shock.ttl -= dt;
      shock.radius += 140 * dt;
      shock.strength *= Math.max(0, 1 - 0.55 * dt);
    }
    for (let i = this.wells.length - 1; i >= 0; i--) if (this.wells[i].ttl <= 0) this.wells.splice(i, 1);
    for (let i = this.shockwaves.length - 1; i >= 0; i--) if (this.shockwaves[i].ttl <= 0) this.shockwaves.splice(i, 1);
  }

  private trimForces(): void {
    while (this.wells.length > 5) this.wells.shift();
    while (this.shockwaves.length > 6) this.shockwaves.shift();
  }

  private wrapParticle(p: DebrisParticle): void {
    const margin = 44;
    if (p.x < -margin) p.x = this.options.width + margin;
    if (p.x > this.options.width + margin) p.x = -margin;
    if (p.y < -margin) p.y = this.options.height + margin;
    if (p.y > this.options.height + margin) p.y = -margin;
  }

  private depositTrails(amount: number): void {
    const sx = (this.options.trailColumns - 1) / Math.max(1, this.options.width);
    const sy = (this.options.trailRows - 1) / Math.max(1, this.options.height);
    for (const p of this.particles) {
      const x = Math.round(p.x * sx);
      const y = Math.round(p.y * sy);
      const current = this.trailField.get(x, y);
      this.trailField.set(x, y, Math.min(1, current + (0.05 + p.heat * 0.06) * amount));
    }
  }
}
