/**
 * components/games/ballpit/BallPitScene.ts
 *
 * Main Ball Pit gameplay scene.
 *
 * Mechanics:
 *  - Tap spawns a ball at the tap position (up to maxBalls real physics bodies)
 *  - Overflow spawns a fake particle burst instead of a physics body
 *  - Balls that fall below (height + 60px) are "drained" → +5 points
 *  - Score increases by 1 per ball spawned, +5 per drain
 *  - Drag creates a gentle attractor force pulling nearby balls toward the finger
 *  - 4 static boundary walls enclose the scene (left/right/top, bottom is OPEN for drain)
 *
 * Emits game events:
 *  - score_update { value: number }
 */
import type { GameContext } from '@hooksjam/pixi-lab-core';
import type { Input } from '@hooksjam/pixi-lab-core';
import {
  Scene,
  createCircleBody,
  createEdgeWall,
  destroyBody,
  styleRegistry,
} from '@hooksjam/pixi-lab-core';
import type { BodyHandle } from '@hooksjam/pixi-lab-core';
import type { Sprite } from 'pixi.js';
import * as planck from 'planck';

const MIN_RADIUS = 10;
const MAX_RADIUS = 28;
const DRAIN_Y_BUFFER = 60; // px below canvas bottom to trigger drain

interface BallEntry {
  handle: BodyHandle;
  sprite: Sprite;
}

export class BallPitScene extends Scene {
  readonly name = 'BallPit';

  private balls: BallEntry[] = [];
  private score = 0;
  private ctx_!: GameContext;
  private input_!: Input;
  private wallHandles: BodyHandle[] = [];

  onEnter(ctx: GameContext, input: Input) {
    this.ctx_ = ctx;
    this.input_ = input;
    this.score = 0;

    const { width, height, systems } = ctx;
    const { world } = systems;

    // 3 walls only (left, right, top) — bottom is open so balls drain out
    this.wallHandles = [
      createEdgeWall(world, { x1: 0, y1: 0, x2: width, y2: 0 }),
      createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height }),
      createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height }),
    ];
  }

  onExit() {
    const { world, sprites } = this.ctx_.systems;
    for (const entry of this.balls) {
      destroyBody(world, entry.handle);
      entry.sprite.destroy();
    }
    this.balls = [];

    for (const w of this.wallHandles) {
      destroyBody(world, w);
    }
    this.wallHandles = [];

    // Remove all ball sprites from stage
    void sprites; // sprites is handled through sprite.destroy() above
  }

  update(_dt: number) {
    const snap = this.input_.snapshot;
    const { width } = this.ctx_;

    // Process new taps — spawn balls
    for (const [, ptr] of snap.pointers) {
      if (snap.justDown.has(ptr.id) && ptr.source === 'human') {
        this.spawnBall(ptr.x, ptr.y);
      }
    }

    // Drag attractor
    for (const [, ptr] of snap.pointers) {
      if (!snap.justDown.has(ptr.id) && !snap.justUp.has(ptr.id)) {
        this.applyAttractor(ptr.x, ptr.y, 100, 400);
      }
    }

    // Drain balls that fell below the canvas
    const drainY = this.ctx_.height + DRAIN_Y_BUFFER;
    const drained: BallEntry[] = [];
    const active: BallEntry[] = [];
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      if (pos.y * 100 > drainY) {
        // M_TO_PX = 100
        drained.push(entry);
      } else {
        active.push(entry);
      }
    }
    this.balls = active;
    for (const entry of drained) {
      this.drainBall(entry);
    }

    void width;
  }

  render(_alpha: number) {
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      entry.sprite.x = pos.x * 100; // M_TO_PX
      entry.sprite.y = pos.y * 100;
      entry.sprite.rotation = entry.handle.body.getAngle();
    }

    this.ctx_.systems.particles.update(1 / 60);
  }

  resize(width: number, height: number) {
    // Recreate 3 walls on resize
    const { world } = this.ctx_.systems;
    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = [
      createEdgeWall(world, { x1: 0, y1: 0, x2: width, y2: 0 }),
      createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height }),
      createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height }),
    ];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private spawnBall(x: number, y: number) {
    const { world, sprites, particles, audio, settings } = this.ctx_.systems;
    const maxBalls = (settings.get('maxBalls') as number) ?? 200;
    const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
    const paletteName = (settings.get('style') as string) ?? 'rainbow';
    const palette = styleRegistry.getPalette(paletteName);
    const color = styleRegistry.randomBallColor(palette);

    if (this.balls.length >= maxBalls) {
      // Overflow — emit particle burst instead
      particles.burst({ x, y, count: 8, speed: 80, radius: radius * 0.6, color });
      return;
    }

    const bounciness = (settings.get('bounciness') as number) ?? 0.6;
    const handle = createCircleBody(world, {
      x,
      y,
      radius,
      restitution: bounciness,
      density: 1,
      friction: 0.3,
      userData: {
        id: `ball-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kind: 'ball',
        isSensor: false,
      },
    });

    const sprite = sprites.makeCircleSprite(radius, color);
    this.ctx_.systems.pixi.app.stage.addChild(sprite);
    this.balls.push({ handle, sprite });

    // Audible pop
    if (settings.get('audio') !== false) {
      audio.playTone('pop');
    }

    this.score += 1;
    this.ctx_.emit({ kind: 'score_update', value: this.score });
  }

  private drainBall(entry: BallEntry) {
    const { world, particles, audio, settings } = this.ctx_.systems;
    destroyBody(world, entry.handle);

    const pos = entry.handle.body.getPosition();
    particles.burst({
      x: pos.x * 100,
      y: pos.y * 100,
      count: 5,
      speed: 60,
      radius: 6,
      color: 0xffffff,
    });
    entry.sprite.destroy();

    if (settings.get('audio') !== false) {
      audio.playTone('drain');
    }

    this.score += 5;
    this.ctx_.emit({ kind: 'score_update', value: this.score });
  }

  private applyAttractor(x: number, y: number, radius: number, strength: number) {
    const PX_TO_M = 0.01;
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      const bx = pos.x * 100;
      const by = pos.y * 100;
      const dx = x - bx;
      const dy = y - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius || dist < 1) continue;
      const force = (strength / dist) * PX_TO_M;
      entry.handle.body.applyForce(
        planck.Vec2(dx * force, dy * force),
        entry.handle.body.getWorldCenter(),
        true,
      );
    }
  }
}
