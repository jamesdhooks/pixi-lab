import { ScalarField, SeededRng, VectorField } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface CosmicInkOceanModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  particleCount: number;
  turbulence: number;
  flowSpeed: number;
  inkDiffusion: number;
  vortexStrength: number;
}

export interface CosmicInkOceanStats {
  particleCount: number;
  meanSpeed: number;
  kineticEnergy: number;
  inkMean: number;
  inkVariance: number;
  inkMax: number;
  vectorEnergy: number;
  vortexCount: number;
}

interface InkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  dye: number;
  phase: number;
}

interface Vortex {
  x: number;
  y: number;
  strength: number;
  radius: number;
  ttl: number;
}

export class CosmicInkOceanModel {
  readonly inkField: ScalarField;
  readonly velocityField: VectorField;
  private readonly particles: InkParticle[] = [];
  private readonly vortices: Vortex[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;

  constructor(private readonly options: CosmicInkOceanModelOptions) {
    this.inkField = new ScalarField(options.columns, options.rows);
    this.velocityField = new VectorField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.particles.length = 0;
    this.vortices.length = 0;
    this.inkField.fill(0);
    this.velocityField.fill({ x: 0, y: 0 });
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    const radius = Math.min(this.options.width, this.options.height) * 0.38;
    for (let i = 0; i < this.options.particleCount; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const r = radius * Math.sqrt(this.rng.next());
      const tangent = angle + Math.PI * 0.5 + this.rng.range(-0.75, 0.75);
      const speed = this.rng.range(12, 74) * this.options.flowSpeed;
      this.particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r * 0.72,
        vx: Math.cos(tangent) * speed,
        vy: Math.sin(tangent) * speed,
        size: this.rng.range(1.2, 3.8),
        dye: this.rng.range(0.35, 1),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
    this.addVortex(cx, cy, 1.2, radius * 0.9, 4);
    this.rebuildVelocityField();
    this.depositInk(1);
  }

  update(dt: number): void {
    const frameScale = Math.max(0.25, Math.min(2.5, dt * 60));
    this.time += dt;
    this.fadeInk(frameScale);
    this.rebuildVelocityField();
    for (const p of this.particles) {
      const nx = p.x / Math.max(1, this.options.width);
      const ny = p.y / Math.max(1, this.options.height);
      const flow = this.sampleVelocity(nx, ny);
      p.vx += flow.x * this.options.flowSpeed * 18 * frameScale;
      p.vy += flow.y * this.options.flowSpeed * 18 * frameScale;
      const cx = this.options.width * 0.5;
      const cy = this.options.height * 0.5;
      p.vx += (cx - p.x) * 0.0008 * frameScale;
      p.vy += (cy - p.y) * 0.0008 * frameScale;
      const speed = Math.hypot(p.vx, p.vy);
      const maxSpeed = 160 * Math.max(0.4, this.options.flowSpeed);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        p.vx *= scale;
        p.vy *= scale;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 0.018 * frameScale;
      p.vy *= 1 - 0.018 * frameScale;
      p.phase += dt * (0.8 + this.options.turbulence * 0.55);
      p.dye = Math.max(0.18, p.dye * (1 - 0.006 * frameScale) + Math.min(0.18, speed / 1500));
      this.wrapParticle(p);
    }
    this.ageVortices(dt);
    this.depositInk(0.58);
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.addVortex(event.x, event.y, 1.6, 170, 3.2);
    if (event.kind === 'hold') this.addVortex(event.x, event.y, -1.25, 210, 3.6);
    if (event.kind === 'drag' || event.kind === 'fast_swipe') this.shear(event.x, event.y, event.dx ?? 0, event.dy ?? 0, event.kind === 'fast_swipe' ? 260 : 180);
    this.trimVortices();
    this.depositInk(0.95);
  }

  setTurbulence(value: number): void {
    this.options.turbulence = value;
  }

  setFlowSpeed(value: number): void {
    this.options.flowSpeed = value;
  }

  setInkDiffusion(value: number): void {
    this.options.inkDiffusion = value;
  }

  setVortexStrength(value: number): void {
    this.options.vortexStrength = value;
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 2 || stats.inkVariance < 0.000002 || stats.vectorEnergy < 0.00002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'cosmic ink flow lost visible turbulence or particle motion' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4200) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    this.addVortex(cx, cy, this.rng.range(-2.2, 2.2), Math.min(this.options.width, this.options.height) * 0.42, 4.2);
    for (const p of this.particles) {
      const angle = this.rng.range(0, Math.PI * 2);
      const kick = this.rng.range(32, 112);
      p.vx += Math.cos(angle) * kick;
      p.vy += Math.sin(angle) * kick;
      p.dye = Math.min(1.6, p.dye + this.rng.range(0.2, 0.8));
    }
    this.stagnantMs = 0;
    this.depositInk(1);
  }

  stats(): CosmicInkOceanStats {
    let speed = 0;
    let kinetic = 0;
    for (const p of this.particles) {
      const s = Math.hypot(p.vx, p.vy);
      speed += s;
      kinetic += s * s;
    }
    let vectorEnergy = 0;
    for (let i = 0; i < this.velocityField.values.length; i += 2) {
      const x = this.velocityField.values[i];
      const y = this.velocityField.values[i + 1];
      vectorEnergy += x * x + y * y;
    }
    const count = Math.max(1, this.particles.length);
    const ink = this.inkField.stats();
    return {
      particleCount: this.particles.length,
      meanSpeed: speed / count,
      kineticEnergy: kinetic / count,
      inkMean: ink.mean,
      inkVariance: ink.variance,
      inkMax: ink.max,
      vectorEnergy: vectorEnergy / Math.max(1, this.velocityField.values.length / 2),
      vortexCount: this.vortices.length,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number; dye: number }> {
    return this.particles.slice(0, 32).map((p) => ({
      x: Number(p.x.toFixed(2)),
      y: Number(p.y.toFixed(2)),
      vx: Number(p.vx.toFixed(2)),
      vy: Number(p.vy.toFixed(2)),
      dye: Number(p.dye.toFixed(3)),
    }));
  }

  renderParticles(): SimParticle[] {
    return this.particles.map((p) => ({
      position: { x: p.x, y: p.y },
      velocity: { x: p.vx, y: p.vy },
      size: p.size,
      color: 0xffffff,
      alpha: 0.24 + Math.min(0.64, p.dye * 0.42),
    }));
  }

  collapseForTest(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (const p of this.particles) {
      p.x = cx;
      p.y = cy;
      p.vx = 0;
      p.vy = 0;
      p.dye = 0.05;
    }
    this.vortices.length = 0;
    this.inkField.fill(0);
    this.velocityField.fill({ x: 0, y: 0 });
  }

  private rebuildVelocityField(): void {
    const columns = this.options.columns;
    const rows = this.options.rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const nx = x / Math.max(1, columns - 1);
        const ny = y / Math.max(1, rows - 1);
        const a = this.noiseAngle(nx, ny);
        let vx = Math.cos(a) * 0.42;
        let vy = Math.sin(a) * 0.42;
        const px = nx * this.options.width;
        const py = ny * this.options.height;
        for (const vortex of this.vortices) {
          const dx = px - vortex.x;
          const dy = py - vortex.y;
          const d2 = dx * dx + dy * dy;
          const r2 = vortex.radius * vortex.radius;
          if (d2 >= r2) continue;
          const falloff = (1 - d2 / r2) * vortex.strength * this.options.vortexStrength;
          const inv = 1 / Math.max(18, Math.sqrt(d2));
          vx += -dy * inv * falloff;
          vy += dx * inv * falloff;
        }
        const mag = Math.hypot(vx, vy);
        const scale = mag > 1 ? 1 / mag : 1;
        this.velocityField.set(x, y, { x: vx * scale, y: vy * scale });
      }
    }
  }

  private noiseAngle(nx: number, ny: number): number {
    const t = this.time * 0.12 * this.options.flowSpeed;
    const k = this.options.turbulence;
    const a = Math.sin((nx * 3.1 + t) * Math.PI * k) + Math.cos((ny * 4.7 - t * 0.7) * Math.PI * (0.7 + k * 0.35));
    const b = Math.sin((nx + ny) * Math.PI * (2.2 + k) - t * 1.7);
    return (a + b) * Math.PI;
  }

  private sampleVelocity(nx: number, ny: number): { x: number; y: number } {
    return this.velocityField.get(nx * (this.options.columns - 1), ny * (this.options.rows - 1));
  }

  private fadeInk(frameScale: number): void {
    const fade = Math.pow(this.options.inkDiffusion, frameScale);
    for (let i = 0; i < this.inkField.values.length; i++) this.inkField.values[i] *= fade;
  }

  private depositInk(strength: number): void {
    const sx = (this.options.columns - 1) / Math.max(1, this.options.width);
    const sy = (this.options.rows - 1) / Math.max(1, this.options.height);
    for (const p of this.particles) {
      const x = Math.round(p.x * sx);
      const y = Math.round(p.y * sy);
      const value = Math.min(1.8, this.inkField.get(x, y) + p.dye * strength * 0.09);
      this.inkField.set(x, y, value);
    }
  }

  private addVortex(x: number, y: number, strength: number, radius: number, ttl: number): void {
    this.vortices.push({ x, y, strength, radius, ttl });
    this.trimVortices();
  }

  private shear(x: number, y: number, dx: number, dy: number, radius: number): void {
    for (const p of this.particles) {
      const px = p.x - x;
      const py = p.y - y;
      const d2 = px * px + py * py;
      if (d2 > radius * radius) continue;
      const falloff = 1 - d2 / (radius * radius);
      p.vx += dx * 0.04 * falloff;
      p.vy += dy * 0.04 * falloff;
      p.dye = Math.min(1.8, p.dye + falloff * 0.35);
    }
    this.addVortex(x, y, Math.max(-2, Math.min(2, (dx - dy) * 0.006)), radius * 0.8, 2.4);
  }

  private ageVortices(dt: number): void {
    for (let i = this.vortices.length - 1; i >= 0; i--) {
      const vortex = this.vortices[i];
      vortex.ttl -= dt;
      vortex.strength *= 1 - Math.min(0.08, dt * 0.3);
      if (vortex.ttl <= 0) this.vortices.splice(i, 1);
    }
  }

  private trimVortices(): void {
    while (this.vortices.length > 10) this.vortices.shift();
  }

  private wrapParticle(p: InkParticle): void {
    if (p.x < 0) p.x += this.options.width;
    if (p.x > this.options.width) p.x -= this.options.width;
    if (p.y < 0) p.y += this.options.height;
    if (p.y > this.options.height) p.y -= this.options.height;
  }
}
