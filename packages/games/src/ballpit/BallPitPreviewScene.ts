/**
 * components/games/ballpit/BallPitPreviewScene.ts
 *
 * Low-overhead preview scene for the home tile.
 * Max 30 balls, no audio, DemoAI-driven, ≤30 fps cap.
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

const MAX_PREVIEW_BALLS = 30;
const MIN_RADIUS = 8;
const MAX_RADIUS = 20;
const DRAIN_Y_BUFFER = 60;
const AUTO_SPAWN_INTERVAL = 0.4; // seconds

interface BallEntry {
  handle: BodyHandle;
  sprite: Sprite;
}

export class BallPitPreviewScene extends Scene {
  readonly name = 'BallPitPreview';

  private balls: BallEntry[] = [];
  private wallHandles: BodyHandle[] = [];
  private ctx_!: GameContext;
  private autoSpawnTimer = 0;

  onEnter(ctx: GameContext, _input: Input) {
    this.ctx_ = ctx;
    const { width, height, systems } = ctx;
    const { world } = systems;

    this.wallHandles = [
      createEdgeWall(world, { x1: 0, y1: 0, x2: width, y2: 0 }),
      createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height }),
      createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height }),
    ];
  }

  onExit() {
    const { world } = this.ctx_.systems;
    for (const entry of this.balls) {
      destroyBody(world, entry.handle);
      entry.sprite.destroy();
    }
    this.balls = [];
    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = [];
  }

  update(dt: number) {
    const { width, height, systems } = this.ctx_;

    // Auto-spawn ball from a random top position
    this.autoSpawnTimer += dt;
    if (this.autoSpawnTimer >= AUTO_SPAWN_INTERVAL && this.balls.length < MAX_PREVIEW_BALLS) {
      this.autoSpawnTimer = 0;
      const x = MIN_RADIUS + Math.random() * (width - MIN_RADIUS * 2);
      this.spawnBall(x, -10);
    }

    // Drain fallen balls
    const drainY = height + DRAIN_Y_BUFFER;
    const alive: BallEntry[] = [];
    const dead: BallEntry[] = [];
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      if (pos.y * 100 > drainY) dead.push(entry);
      else alive.push(entry);
    }
    this.balls = alive;
    for (const entry of dead) {
      destroyBody(systems.world, entry.handle);
      entry.sprite.destroy();
    }
  }

  render(_alpha: number) {
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      entry.sprite.x = pos.x * 100;
      entry.sprite.y = pos.y * 100;
      entry.sprite.rotation = entry.handle.body.getAngle();
    }
    this.ctx_.systems.particles.update(1 / 30);
  }

  private spawnBall(x: number, y: number) {
    const { world, sprites, pixi } = this.ctx_.systems;
    const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
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
        id: `preview-ball-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kind: 'ball',
        isSensor: false,
      },
    });

    const sprite = sprites.makeCircleSprite(radius, color);
    pixi.app.stage.addChild(sprite);
    this.balls.push({ handle, sprite });
  }
}
