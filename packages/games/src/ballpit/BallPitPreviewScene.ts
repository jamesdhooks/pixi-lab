/**
 * components/games/ballpit/BallPitPreviewScene.ts
 *
 * Parameterised auto-running scene used for both the preview tile and the
 * full-screen screensaver. Balls rain in from the open top until the pit
 * fills, then the bottom drops, balls drain, and the cycle restarts.
 *
 * role 'preview'    — restrained settings (fewer, smaller balls, slower spawn)
 * role 'screensaver' — higher settings (more balls, faster spawn, wider size range)
 */
import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import {
  Scene,
  createEdgeWall,
  createCircleBody,
  destroyBody,
  styleRegistry,
} from '@hooksjam/pixi-lab-core';
import type { BodyHandle } from '@hooksjam/pixi-lab-core';
import type { Sprite } from 'pixi.js';

/** Per-role constants */
const ROLE_CONFIG = {
  preview: {
    minRadius: 6,
    maxRadius: 14,
    initialBalls: 6,
    spawnInterval: 0.28,
    maxBalls: 32,
    drainDuration: 2.2,
  },
  screensaver: {
    minRadius: 6,
    maxRadius: 20,
    initialBalls: 12,
    spawnInterval: 0.15,
    maxBalls: 80,
    drainDuration: 2.5,
  },
} as const;

type AutoSceneRole = keyof typeof ROLE_CONFIG;
type PreviewPhase = 'streaming' | 'draining';

interface BallEntry {
  handle: BodyHandle;
  sprite: Sprite;
}

export class BallPitAutoScene extends Scene {
  readonly name = 'BallPitAuto';

  private readonly cfg: (typeof ROLE_CONFIG)[AutoSceneRole];
  private balls: BallEntry[] = [];
  private wallHandles: BodyHandle[] = [];
  private bottomWall: BodyHandle | null = null;
  private ctx_!: GameContext;
  private phase: PreviewPhase = 'streaming';
  private phaseTimer = 0;
  private spawnTimer = 0;

  constructor(role: AutoSceneRole = 'preview') {
    super();
    this.cfg = ROLE_CONFIG[role];
  }

  onEnter(ctx: GameContext, _input: Input) {
    this.ctx_ = ctx;
    this.phase = 'streaming';
    this.phaseTimer = 0;
    this.spawnTimer = 0;
    const { width, height, systems } = ctx;
    const { world } = systems;

    // Three walls — LEFT, RIGHT, BOTTOM. No top wall: balls rain in freely.
    this.bottomWall = createEdgeWall(world, { x1: 0, y1: height, x2: width, y2: height });
    this.wallHandles = [
      createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height }),
      createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height }),
      this.bottomWall,
    ];

    // Seed the pit with a few balls already inside so it looks populated immediately.
    const { minRadius, maxRadius, initialBalls } = this.cfg;
    for (let i = 0; i < initialBalls; i++) {
      const x = minRadius * 2 + Math.random() * (width - minRadius * 4);
      const y = height * (0.3 + Math.random() * 0.55);
      this.spawnBall(x, y, minRadius, maxRadius);
    }
  }

  onExit() {
    const { world } = this.ctx_.systems;
    for (const entry of this.balls) {
      destroyBody(world, entry.handle);
      entry.sprite.parent?.removeChild(entry.sprite);
      entry.sprite.destroy();
    }
    this.balls = [];
    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = [];
    this.bottomWall = null;
  }

  update(dt: number) {
    this.phaseTimer += dt;
    const { world } = this.ctx_.systems;
    const { width, height } = this.ctx_;
    const { minRadius, maxRadius, spawnInterval, maxBalls, drainDuration } = this.cfg;

    if (this.phase === 'streaming') {
      // Continuously spawn balls from just above the canvas (no top wall to block them).
      this.spawnTimer += dt;
      if (this.spawnTimer >= spawnInterval) {
        this.spawnTimer = 0;
        const x = minRadius + Math.random() * (width - minRadius * 2);
        this.spawnBall(x, -(minRadius + 2), minRadius, maxRadius);
      }

      // Once the pit is full, drop the bottom wall and start draining.
      if (this.balls.length >= maxBalls) {
        if (this.bottomWall) {
          destroyBody(world, this.bottomWall);
          this.wallHandles = this.wallHandles.filter(w => w !== this.bottomWall);
          this.bottomWall = null;
        }
        this.phase = 'draining';
        this.phaseTimer = 0;
      }
    }

    if (this.phase === 'draining') {
      // Remove balls that have fallen below the canvas.
      const drainY = height + 80;
      const remaining: BallEntry[] = [];
      for (const entry of this.balls) {
        const pos = entry.handle.body.getPosition();
        if (pos.y * 100 > drainY) {
          destroyBody(world, entry.handle);
          entry.sprite.parent?.removeChild(entry.sprite);
          entry.sprite.destroy();
        } else {
          remaining.push(entry);
        }
      }
      this.balls = remaining;

      if (this.balls.length === 0 || this.phaseTimer > drainDuration) {
        // Force-remove any stragglers.
        for (const entry of this.balls) {
          destroyBody(world, entry.handle);
          entry.sprite.parent?.removeChild(entry.sprite);
          entry.sprite.destroy();
        }
        this.balls = [];

        // Restore bottom wall and restart streaming.
        this.bottomWall = createEdgeWall(world, { x1: 0, y1: height, x2: width, y2: height });
        this.wallHandles.push(this.bottomWall);

        // Re-seed a few balls inside so the pit isn't empty on restart.
        const { initialBalls } = this.cfg;
        for (let i = 0; i < initialBalls; i++) {
          const x = minRadius * 2 + Math.random() * (width - minRadius * 4);
          const y = height * (0.3 + Math.random() * 0.55);
          this.spawnBall(x, y, minRadius, maxRadius);
        }

        this.phase = 'streaming';
        this.phaseTimer = 0;
        this.spawnTimer = 0;
      }
    }
  }

  resize(newWidth: number, newHeight: number) {
    if (!this.ctx_) return;
    const { world } = this.ctx_.systems;

    // Destroy all existing walls and recreate at the new dimensions.
    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = [];
    this.bottomWall = null;

    const sideLeft = createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: newHeight });
    const sideRight = createEdgeWall(world, { x1: newWidth, y1: 0, x2: newWidth, y2: newHeight });

    if (this.phase === 'streaming') {
      this.bottomWall = createEdgeWall(world, { x1: 0, y1: newHeight, x2: newWidth, y2: newHeight });
      this.wallHandles = [sideLeft, sideRight, this.bottomWall];
    } else {
      this.wallHandles = [sideLeft, sideRight];
    }
  }

  render(_alpha: number) {
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      entry.sprite.x = pos.x * 100;
      entry.sprite.y = pos.y * 100;
    }
    this.ctx_.systems.particles.update(1 / 30);
  }

  private spawnBall(x: number, y: number, minR: number, maxR: number) {
    const { world, sprites, pixi } = this.ctx_.systems;
    const radius = minR + Math.random() * (maxR - minR);
    const palette = styleRegistry.getPalette('rainbow');
    const color = styleRegistry.randomBallColor(palette);

    const handle = createCircleBody(world, {
      x,
      y,
      radius,
      restitution: 0.6,
      density: 1,
      friction: 0.3,
      userData: {
        id: `auto-ball-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kind: 'ball',
        isSensor: false,
      },
    });

    const sprite = sprites.makeCircleSprite(radius, color);
    sprite.x = x;
    sprite.y = y;
    pixi.app.stage.addChild(sprite);
    this.balls.push({ handle, sprite });
  }
}

/** @deprecated Use BallPitAutoScene instead. */
export { BallPitAutoScene as BallPitPreviewScene };

