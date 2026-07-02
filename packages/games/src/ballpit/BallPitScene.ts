/**
 * components/games/ballpit/BallPitScene.ts
 *
 * Main Ball Pit gameplay scene.
 *
 * Mechanics:
 *  - Single tap spawns one ball at the tap position (up to maxBalls real physics bodies)
 *  - Stream mode emits a continuous fountain while a pointer is held
 *  - Explosion mode creates a radial burst from each tap
 *  - Overflow spawns a fake particle burst instead of a physics body
 *  - Drag creates a gentle attractor force pulling nearby balls toward the finger
 *  - 4 static boundary walls enclose the scene so balls stay on-screen
 */
import type { GameContext } from '@hooksjam/pixi-lab-core';
import type { Input } from '@hooksjam/pixi-lab-core';
import {
  Scene,
  createBoundaryWalls,
  createCircleBody,
  destroyBody,
  styleRegistry,
} from '@hooksjam/pixi-lab-core';
import type { BodyHandle } from '@hooksjam/pixi-lab-core';
import type { Sprite } from 'pixi.js';
import * as planck from 'planck';

const MIN_RADIUS = 10;
const MAX_RADIUS = 28;
const DRAIN_Y_BUFFER = 60; // px below canvas bottom to trigger drain
type BallPitInputMode = 'single' | 'stream' | 'explosion';

interface BallEntry {
  handle: BodyHandle;
  sprite: Sprite;
}

export class BallPitScene extends Scene {
  readonly name = 'BallPit';

  private balls: BallEntry[] = [];
  private mode: BallPitInputMode = 'single';
  private streamAccumulatorMs = 0;
  private ctx_!: GameContext;
  private input_!: Input;
  private wallHandles: BodyHandle[] = [];

  onEnter(ctx: GameContext, input: Input) {
    this.ctx_ = ctx;
    this.input_ = input;
    this.mode = 'single';
    this.streamAccumulatorMs = 0;

    const { width, height, systems } = ctx;
    const { world } = systems;

    // Closed bounds: the game is a pit, not a drain. Keep balls visible and playable.
    this.wallHandles = createBoundaryWalls(world, width, height, { restitution: 0.78, friction: 0.08 });
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

  update(dt: number) {
    const snap = this.input_.snapshot;
    const { width } = this.ctx_;

    // Process human input according to the selected interaction mode.
    this.streamAccumulatorMs += dt * 1000;
    for (const [, ptr] of snap.pointers) {
      if (ptr.source !== 'human') continue;
      if (snap.justDown.has(ptr.id)) {
        if (this.mode === 'explosion') this.spawnExplosion(ptr.x, ptr.y);
        else this.spawnBall(ptr.x, ptr.y);
      }
      if (this.mode === 'stream' && !snap.justUp.has(ptr.id) && this.streamAccumulatorMs >= 42) {
        this.spawnBall(ptr.x, ptr.y);
      }
    }
    if (this.streamAccumulatorMs >= 42) this.streamAccumulatorMs = 0;

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

  setMode(id: string): void {
    if (id === 'single' || id === 'stream' || id === 'explosion') {
      this.mode = id;
      this.streamAccumulatorMs = 0;
    }
  }

  resize(width: number, height: number) {
    // Recreate closed bounds on resize.
    const { world } = this.ctx_.systems;
    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = createBoundaryWalls(world, width, height, { restitution: 0.78, friction: 0.08 });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private spawnBall(x: number, y: number, velocity?: { x: number; y: number }) {
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
    if (velocity) {
      handle.body.setLinearVelocity(planck.Vec2(velocity.x * 0.01, velocity.y * 0.01));
    }
    this.balls.push({ handle, sprite });

    // Audible pop
    if (settings.get('audio') !== false) {
      audio.playTone('pop');
    }

  }

  private spawnExplosion(x: number, y: number) {
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.18;
      const speed = 220 + Math.random() * 260;
      const radius = Math.random() * 34;
      this.spawnBall(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      );
    }
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
