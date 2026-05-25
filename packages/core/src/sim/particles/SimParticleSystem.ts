import type { Vec2 } from '../../types';
import { SeededRng } from '../../utils/SeededRng';

export interface SimParticle {
  position: Vec2;
  velocity: Vec2;
  size: number;
  color: number;
  alpha: number;
}

export class SimParticleSystem {
  readonly particles: SimParticle[] = [];
  private readonly rng: SeededRng;

  constructor(
    seed: number,
    private maxCount: number,
  ) {
    this.rng = new SeededRng(seed);
  }

  setMaxCount(maxCount: number): void {
    this.maxCount = Math.max(0, Math.floor(maxCount));
    if (this.particles.length > this.maxCount) {
      this.particles.length = this.maxCount;
    }
  }

  fill(count: number, width: number, height: number, color: number, size = 1.5): void {
    this.particles.length = 0;
    const target = Math.min(this.maxCount, Math.max(0, Math.floor(count)));
    for (let i = 0; i < target; i++) {
      this.particles.push({
        position: { x: this.rng.range(0, width), y: this.rng.range(0, height) },
        velocity: { x: this.rng.range(-8, 8), y: this.rng.range(-8, 8) },
        size,
        color,
        alpha: 0.85,
      });
    }
  }

  positionVariance(width: number, height: number): number {
    if (this.particles.length === 0) return 0;
    let sumX = 0;
    let sumY = 0;
    for (const particle of this.particles) {
      sumX += particle.position.x / width;
      sumY += particle.position.y / height;
    }
    const meanX = sumX / this.particles.length;
    const meanY = sumY / this.particles.length;
    let variance = 0;
    for (const particle of this.particles) {
      const dx = particle.position.x / width - meanX;
      const dy = particle.position.y / height - meanY;
      variance += dx * dx + dy * dy;
    }
    return variance / this.particles.length;
  }
}
