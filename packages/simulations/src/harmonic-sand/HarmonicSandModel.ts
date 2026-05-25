import { ScalarField, SeededRng, SimParticleSystem } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, RenderQuality, StagnationReport, Vec2 } from '@hooksjam/pixi-lab-core';

export interface HarmonicEmitter {
  position: Vec2;
  frequency: number;
  phase: number;
  amplitude: number;
}

export interface HarmonicSandModelOptions {
  seed: number;
  width: number;
  height: number;
  quality: RenderQuality;
  particleCount: number;
  emitterCount: number;
  baseFrequency: number;
}

const QUALITY_FIELDS: Record<RenderQuality, { columns: number; rows: number; particles: number }> = {
  basic: { columns: 96, rows: 54, particles: 5000 },
  enhanced: { columns: 128, rows: 72, particles: 20000 },
  ultra: { columns: 160, rows: 90, particles: 20000 },
};

export class HarmonicSandModel {
  readonly emitters: HarmonicEmitter[] = [];
  readonly field: ScalarField;
  readonly particles: SimParticleSystem;
  private readonly rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;
  private quality: RenderQuality;

  constructor(private readonly options: HarmonicSandModelOptions) {
    this.quality = options.quality;
    const dimensions = QUALITY_FIELDS[options.quality];
    this.field = new ScalarField(dimensions.columns, dimensions.rows);
    this.particles = new SimParticleSystem(options.seed, dimensions.particles);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.emitters.length = 0;
    const resetRng = new SeededRng(seed);
    const count = Math.max(1, Math.floor(this.options.emitterCount));
    for (let i = 0; i < count; i++) {
      this.emitters.push({
        position: {
          x: resetRng.range(this.options.width * 0.15, this.options.width * 0.85),
          y: resetRng.range(this.options.height * 0.15, this.options.height * 0.85),
        },
        frequency: this.options.baseFrequency + resetRng.range(-0.45, 0.45),
        phase: resetRng.range(0, Math.PI * 2),
        amplitude: resetRng.range(0.75, 1.2),
      });
    }
    const dimensions = QUALITY_FIELDS[this.quality];
    this.particles.setMaxCount(dimensions.particles);
    this.particles.fill(
      Math.min(this.options.particleCount, dimensions.particles),
      this.options.width,
      this.options.height,
      0xffd36e,
      this.quality === 'basic' ? 1.25 : 1,
    );
    this.time = 0;
    this.stagnantMs = 0;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    const dimensions = QUALITY_FIELDS[quality];
    this.particles.setMaxCount(dimensions.particles);
  }

  update(dt: number): void {
    this.time += dt;
    this.updateField();
    this.updateParticles(dt);
  }

  handleGesture(event: GestureEvent): void {
    switch (event.kind) {
      case 'tap':
        this.addEmitter(event.x, event.y);
        break;
      case 'drag':
        this.moveNearestEmitter(event.x, event.y);
        break;
      case 'hold':
        this.amplifyAt(event.x, event.y, 1 + (event.strength ?? 0.3));
        break;
      case 'fast_swipe':
        this.injectShock(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
        break;
      default:
        break;
    }
  }

  detectStagnation(dt: number): StagnationReport {
    const fieldStats = this.field.stats();
    const particleVariance = this.particles.positionVariance(this.options.width, this.options.height);
    const stagnant = fieldStats.variance < 0.002 || particleVariance < 0.002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs > 2500,
      reason: stagnant ? 'low field or particle variance' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 6000) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    for (const emitter of this.emitters) {
      emitter.phase += this.rng.range(0.35, 1.2);
      emitter.position.x = Math.max(0, Math.min(this.options.width, emitter.position.x + this.rng.range(-40, 40)));
      emitter.position.y = Math.max(0, Math.min(this.options.height, emitter.position.y + this.rng.range(-40, 40)));
      emitter.amplitude = Math.min(1.7, emitter.amplitude + 0.2);
    }
    if (this.emitters.length < 6) {
      this.addEmitter(this.rng.range(0, this.options.width), this.rng.range(0, this.options.height));
    }
    this.stagnantMs = 0;
  }

  private updateField(): void {
    for (let y = 0; y < this.field.rows; y++) {
      for (let x = 0; x < this.field.columns; x++) {
        const px = (x / Math.max(1, this.field.columns - 1)) * this.options.width;
        const py = (y / Math.max(1, this.field.rows - 1)) * this.options.height;
        let value = 0;
        for (const emitter of this.emitters) {
          const dx = px - emitter.position.x;
          const dy = py - emitter.position.y;
          const radius = Math.max(1, Math.hypot(dx, dy));
          value += Math.sin(radius * 0.035 * emitter.frequency - this.time * emitter.frequency + emitter.phase) * emitter.amplitude;
        }
        this.field.set(x, y, value / Math.max(1, this.emitters.length));
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles.particles) {
      const nx = particle.position.x / this.options.width;
      const ny = particle.position.y / this.options.height;
      const value = Math.abs(this.field.sampleNormalized(nx, ny));
      const gradient = this.field.gradientNormalized(nx, ny);
      particle.velocity.x += -gradient.x * 42 * dt;
      particle.velocity.y += -gradient.y * 42 * dt;
      particle.velocity.x *= Math.pow(0.92, dt * 60);
      particle.velocity.y *= Math.pow(0.92, dt * 60);
      particle.position.x += particle.velocity.x * dt * (0.5 + value);
      particle.position.y += particle.velocity.y * dt * (0.5 + value);
      particle.position.x = (particle.position.x + this.options.width) % this.options.width;
      particle.position.y = (particle.position.y + this.options.height) % this.options.height;
      particle.alpha = 0.42 + Math.min(0.58, value * 0.58);
    }
  }

  private addEmitter(x: number, y: number): void {
    if (this.emitters.length >= 6) {
      this.moveNearestEmitter(x, y);
      return;
    }
    this.emitters.push({
      position: { x, y },
      frequency: this.options.baseFrequency + this.rng.range(-0.8, 0.8),
      phase: this.rng.range(0, Math.PI * 2),
      amplitude: 1.1,
    });
  }

  private moveNearestEmitter(x: number, y: number): void {
    let nearest = this.emitters[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const emitter of this.emitters) {
      const distance = Math.hypot(emitter.position.x - x, emitter.position.y - y);
      if (distance < nearestDistance) {
        nearest = emitter;
        nearestDistance = distance;
      }
    }
    nearest.position.x += (x - nearest.position.x) * 0.25;
    nearest.position.y += (y - nearest.position.y) * 0.25;
  }

  private amplifyAt(x: number, y: number, amount: number): void {
    this.moveNearestEmitter(x, y);
    for (const emitter of this.emitters) {
      const distance = Math.hypot(emitter.position.x - x, emitter.position.y - y);
      if (distance < 120) {
        emitter.amplitude = Math.min(1.8, emitter.amplitude + amount * 0.04);
      }
    }
  }

  private injectShock(x: number, y: number, dx: number, dy: number): void {
    const length = Math.max(1, Math.hypot(dx, dy));
    for (const particle of this.particles.particles) {
      const distance = Math.hypot(particle.position.x - x, particle.position.y - y);
      if (distance > 160) continue;
      const falloff = 1 - distance / 160;
      particle.velocity.x += (dx / length) * 180 * falloff;
      particle.velocity.y += (dy / length) * 180 * falloff;
    }
  }
}
