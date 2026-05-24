/**
 * packages/core/src/render/Particles.ts
 *
 * Fake particle system using Pixi ParticleContainer.
 * Particles have no physics — they're purely visual.
 * Suitable for: trails, splashes, confetti, background chaos, tiny balls.
 */
import { ParticleContainer, Sprite, type Application } from 'pixi.js';
import type { SpriteFactory } from './Sprites';

export interface ParticleConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds
  maxLife: number;
  radius: number;
  color: number;
  alpha: number;
  gravity: number; // px/s² downward
  drag: number; // velocity multiplier per second (e.g. 0.95)
}

export class ParticleSystem {
  readonly container: ParticleContainer;
  private particles: Array<{ cfg: ParticleConfig; sprite: Sprite }> = [];
  private spriteFactory: SpriteFactory;

  constructor(app: Application, spriteFactory: SpriteFactory, _maxCount = 2000) {
    this.spriteFactory = spriteFactory;
    this.container = new ParticleContainer({
      dynamicProperties: { position: true, alpha: true },
    });
    app.stage.addChild(this.container);
  }

  emit(cfg: Omit<ParticleConfig, 'life'>) {
    const sprite = this.spriteFactory.makeCircleSprite(cfg.radius, cfg.color);
    sprite.x = cfg.x;
    sprite.y = cfg.y;
    sprite.alpha = cfg.alpha;
    this.container.addChild(sprite);
    this.particles.push({
      cfg: { ...cfg, life: 0 },
      sprite,
    });
  }

  /** Burst: emit N particles at a point with randomised velocities */
  burst(opts: {
    x: number;
    y: number;
    count: number;
    speed: number;
    radius?: number;
    color?: number;
    gravity?: number;
    drag?: number;
  }) {
    for (let i = 0; i < opts.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = opts.speed * (0.5 + Math.random() * 0.5);
      this.emit({
        x: opts.x,
        y: opts.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        maxLife: 0.4 + Math.random() * 0.4,
        radius: opts.radius ?? 3,
        color: opts.color ?? 0xffffff,
        alpha: 1,
        gravity: opts.gravity ?? 200,
        drag: opts.drag ?? 0.92,
      });
    }
  }

  update(dt: number) {
    const toRemove: number[] = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const { cfg, sprite } = p;

      cfg.life += dt;
      const t = cfg.life / cfg.maxLife;

      if (t >= 1) {
        toRemove.push(i);
        continue;
      }

      cfg.vy += cfg.gravity * dt;
      cfg.vx *= Math.pow(cfg.drag, dt * 60);
      cfg.vy *= Math.pow(cfg.drag, dt * 60);

      sprite.x += cfg.vx * dt;
      sprite.y += cfg.vy * dt;
      sprite.alpha = cfg.alpha * (1 - t);
    }

    // Remove expired (reverse so indices stay valid)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const { sprite } = this.particles[idx];
      this.container.removeChild(sprite);
      sprite.destroy();
      this.particles.splice(idx, 1);
    }
  }

  get count() {
    return this.particles.length;
  }

  clear() {
    for (const { sprite } of this.particles) {
      this.container.removeChild(sprite);
      sprite.destroy();
    }
    this.particles = [];
  }

  destroy() {
    this.clear();
    this.container.destroy();
  }
}
