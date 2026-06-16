/**
 * components/games/ballpit/BallPitScene.ts
 *
 * Main Ball Pit gameplay scene.
 *
 * Mechanics:
 *  - Pointer UP spawns a ball at the release position
 *  - If the drag exceeds MIN_DRAG_FOR_VELOCITY px the ball inherits the throw velocity
 *  - Holding a finger still for HOLD_DELAY seconds triggers an explosion:
 *      a ring countdown graphic shrinks toward the hold point, then balls blast away
 *  - 4 static boundary walls enclose the scene
 *  - Score increases by 1 per ball spawned
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
  Graphics,
} from '@hooksjam/pixi-lab-core';
import type { BodyHandle } from '@hooksjam/pixi-lab-core';
import type { Sprite } from 'pixi.js';
import * as planck from 'planck';

const PX_TO_M = 0.01;

/** Pixel radius within which balls are flung by an explosion. */
const EXPLOSION_RADIUS = 180;
/** Minimum total drag distance for throw velocity to apply. */
const MIN_DRAG_FOR_VELOCITY = 20;
/** Outward impulse magnitude at the explosion centre (overridden by settings). */
const EXPLOSION_STRENGTH_DEFAULT = 50;
/** Pixel-per-second expansion rate for shockwave rings. */
const RING_SPEED = 310;
/** Seconds before a shockwave ring fully fades. */
const RING_DURATION = 0.55;

interface ShockwaveRing {
  x: number;
  y: number;
  r: number;
  color: number;
  /** Elapsed time. Negative values create a staggered start delay. */
  age: number;
}

type BallPitMode = 'single' | 'rapid' | 'explode' | 'demo';

interface BallEntry {
  handle: BodyHandle;
  sprite: Sprite;
  /** Integer pixel radius — stored so quality hot-swap can recreate the sprite. */
  radius: number;
  color: number;
}

interface PointerTrackData {
  startX: number;
  startY: number;
  prevX: number;
  prevY: number;
  lastX: number;
  lastY: number;
  /** Smoothed velocity in px/s. */
  vx: number;
  vy: number;
  /** Accumulator for rapid-spawn interval. */
  rapidTimer: number;
}

export class BallPitScene extends Scene {
  readonly name = 'BallPit';

  private balls: BallEntry[] = [];
  private score = 0;
  private ctx_!: GameContext;
  private input_!: Input;
  private wallHandles: BodyHandle[] = [];
  private bottomWall: BodyHandle | null = null;
  private pointerData = new Map<number, PointerTrackData>();
  private isResetting = false;
  private resetTimer = 0;
  private interactionMode: BallPitMode = 'single';
  private lastQuality = '';
  private currentPaletteName = 'rainbow';
  private demoTimer = 0;
  private ringGfx!: Graphics;
  private shockwaves: ShockwaveRing[] = [];
  private fpsEma = 60;
  private lowFpsTimer = 0;

  onEnter(ctx: GameContext, input: Input) {
    this.ctx_ = ctx;
    this.input_ = input;
    this.score = 0;
    this.isResetting = false;
    this.resetTimer = 0;
    this.shockwaves = [];
    this.currentPaletteName = (ctx.systems.settings.get('style') as string) ?? 'rainbow';
    this.fpsEma = 60;
    this.lowFpsTimer = 0;

    this.ringGfx = new Graphics();
    ctx.systems.pixi.app.stage.addChild(this.ringGfx);

    const { width, height, systems } = ctx;
    const { world } = systems;

    this.bottomWall = createEdgeWall(world, { x1: 0, y1: height, x2: width, y2: height });
    this.wallHandles = [
      createEdgeWall(world, { x1: 0, y1: 0, x2: width, y2: 0 }),
      createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height }),
      createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height }),
      this.bottomWall,
    ];
  }

  onExit() {
    const { world } = this.ctx_.systems;
    this.pointerData.clear();
    this.shockwaves = [];

    this.ringGfx.parent?.removeChild(this.ringGfx);
    this.ringGfx.destroy();

    for (const entry of this.balls) {
      destroyBody(world, entry.handle);
      entry.sprite.parent?.removeChild(entry.sprite);
      entry.sprite.destroy();
    }
    this.balls = [];

    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = [];
    this.bottomWall = null;
    this.isResetting = false;
  }

  update(dt: number) {
    const snap = this.input_.snapshot;
    const { world, settings } = this.ctx_.systems;

    // Apply gravity setting to the physics world each frame.
    const gravScale = (settings.get('gravity') as number | undefined) ?? 1.0;
    world.setGravity(0, 20 * gravScale);

    // FPS guard: if the EMA drops below 10 fps for 2 s, trigger a reset to
    // relieve physics/render load and keep the experience usable.
    if (!this.isResetting) {
      const instantFps = dt > 0 ? 1 / dt : 60;
      this.fpsEma = this.fpsEma * 0.85 + instantFps * 0.15;
      if (this.fpsEma < 25) {
        this.lowFpsTimer += dt;
        if (this.lowFpsTimer > 1.5) {
          this.lowFpsTimer = 0;
          this.fpsEma = 60;
          this.reset();
        }
      } else {
        this.lowFpsTimer = 0;
      }
    }

    // Hot-swap all ball sprites when quality setting changes
    if (this.ctx_.quality !== this.lastQuality) {
      this.swapAllSprites();
      this.lastQuality = this.ctx_.quality;
    }

    // ── Reset drain cycle ────────────────────────────────────────────────────
    if (this.isResetting) {
      this.resetTimer += dt;
      const drainY = this.ctx_.height + 100;
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

      if (this.balls.length === 0 || this.resetTimer > 2.5) {
        for (const entry of this.balls) {
          destroyBody(world, entry.handle);
          entry.sprite.parent?.removeChild(entry.sprite);
          entry.sprite.destroy();
        }
        this.balls = [];
        // Restore bottom wall
        const { width, height } = this.ctx_;
        this.bottomWall = createEdgeWall(world, { x1: 0, y1: height, x2: width, y2: height });
        this.wallHandles.push(this.bottomWall);
        this.isResetting = false;
        this.score = 0;
        this.ctx_.emit({ kind: 'score_update', value: 0 });
      }
      return; // Skip normal input during reset
    }
    // ── Demo mode: auto-spawn balls from random top positions ─────────────────
    if (this.interactionMode === 'demo') {
      this.demoTimer += dt;
      const demoInterval = 0.1;
      while (this.demoTimer >= demoInterval) {
        this.demoTimer -= demoInterval;
        const x = 30 + Math.random() * (this.ctx_.width - 60);
        this.spawnBall(x, 30, 0, 0);
      }
    }

    // ── Init tracking for newly-pressed pointers ─────────────────────────────
    for (const id of snap.justDown) {
      const ptr = snap.pointers.get(id);
      if (!ptr || ptr.source !== 'human') continue;
      this.pointerData.set(id, {
        startX: ptr.x,
        startY: ptr.y,
        prevX: ptr.x,
        prevY: ptr.y,
        lastX: ptr.x,
        lastY: ptr.y,
        vx: 0,
        vy: 0,
        rapidTimer: 0,
      });
      // Explode mode: fire immediately on tap
      if (this.interactionMode === 'explode') {
        this.triggerExplosion(ptr.x, ptr.y);
      }
      // Rapid mode: spawn one ball immediately on press
      if (this.interactionMode === 'rapid') {
        this.spawnBall(ptr.x, ptr.y, 0, 0);
      }
    }

    // ── Update tracked active pointers ────────────────────────────────────────
    for (const [id, data] of this.pointerData) {
      if (snap.justDown.has(id)) continue; // first-frame; skip velocity for this tick

      const ptr = snap.pointers.get(id);
      if (!ptr) continue; // will be processed by justUp below

      // Exponential-smoothed velocity (px/s)
      const rawVx = dt > 0 ? (ptr.x - data.prevX) / dt : 0;
      const rawVy = dt > 0 ? (ptr.y - data.prevY) / dt : 0;
      data.vx = data.vx * 0.55 + rawVx * 0.45;
      data.vy = data.vy * 0.55 + rawVy * 0.45;

      data.prevX = data.lastX;
      data.prevY = data.lastY;
      data.lastX = ptr.x;
      data.lastY = ptr.y;

      if (this.interactionMode === 'rapid') {
        // ─ Rapid: spray continuously at rapidSpeed balls/sec with cursor velocity ──
        const rapidSpeed = (settings.get('rapidSpeed') as number) ?? 10;
        const rapidInterval = 1 / Math.max(1, rapidSpeed);
        data.rapidTimer += dt;
        if (data.rapidTimer >= rapidInterval) {
          data.rapidTimer -= rapidInterval;
          this.spawnBall(ptr.x, ptr.y, data.vx, data.vy);
        }
      }
      // Explode: handled on justDown. Single: handled on justUp.
    }

    // ── Handle pointer releases ───────────────────────────────────────────────
    for (const id of snap.justUp) {
      const data = this.pointerData.get(id);
      if (!data) continue;

      if (this.interactionMode === 'single') {
        // Single: always spawn on release
        const dragDist = Math.sqrt(
          (data.lastX - data.startX) ** 2 + (data.lastY - data.startY) ** 2,
        );
        if (dragDist > MIN_DRAG_FOR_VELOCITY) {
          this.spawnBall(data.lastX, data.lastY, data.vx, data.vy);
        } else {
          this.spawnBall(data.lastX, data.lastY, 0, 0);
        }
      }
      // Explode: no ball spawned — the explosion itself IS the interaction
      // Rapid: no spawn on release

      this.pointerData.delete(id);
    }

    // ── Advance shockwave rings ───────────────────────────────────────────────
    for (const s of this.shockwaves) {
      s.age += dt;
      if (s.age > 0) s.r = s.age * RING_SPEED;
    }
    this.shockwaves = this.shockwaves.filter((s) => s.age < RING_DURATION);
  }

  shouldRender(): boolean {
    if (this.isResetting) return true;
    if (this.interactionMode === 'demo') return true;
    if (this.shockwaves.length > 0) return true;
    return false;
  }

  render(_alpha: number) {
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      entry.sprite.x = pos.x * 100;
      entry.sprite.y = pos.y * 100;
      // Balls are circles: rotation is irrelevant for shape, and for the
      // enhanced quality the sphere shading is baked into the texture so
      // rotating it would spin the specular highlight — do not rotate.
    }

    // Draw expanding shockwave rings.
    this.ringGfx.clear();
    for (const s of this.shockwaves) {
      if (s.age <= 0 || s.r <= 0) continue;
      const t = s.age / RING_DURATION;
      const alpha = Math.pow(1 - t, 1.5) * 0.85;
      const lw = 2.5 + (1 - t) * 1.5;
      this.ringGfx.circle(s.x, s.y, s.r);
      this.ringGfx.stroke({ color: s.color, width: lw, alpha });
    }
  }

  resize(width: number, height: number) {
    const { world } = this.ctx_.systems;
    for (const w of this.wallHandles) destroyBody(world, w);
    this.wallHandles = [];
    this.bottomWall = null;
    const topWall = createEdgeWall(world, { x1: 0, y1: 0, x2: width, y2: 0 });
    const sideLeft = createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height });
    const sideRight = createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height });
    if (!this.isResetting) {
      this.bottomWall = createEdgeWall(world, { x1: 0, y1: height, x2: width, y2: height });
      this.wallHandles = [topWall, sideLeft, sideRight, this.bottomWall];
    } else {
      this.wallHandles = [topWall, sideLeft, sideRight];
    }
  }

  /** Open the bottom wall and let all balls drain out, then reset score. */
  override reset() {
    if (this.isResetting) return;
    this.isResetting = true;
    this.resetTimer = 0;
    const { world } = this.ctx_.systems;
    if (this.bottomWall) {
      destroyBody(world, this.bottomWall);
      this.wallHandles = this.wallHandles.filter(w => w !== this.bottomWall);
      this.bottomWall = null;
    }
  }

  /** Switch the active interaction mode. */
  override setMode(id: string) {
    const next = id as BallPitMode;
    if (next === this.interactionMode) return;
    for (const [, data] of this.pointerData) {
      data.rapidTimer = 0;
    }
    this.interactionMode = next;
  }

  /** Recolor all balls immediately when the style picker changes. */
  override setStyle(id: string) {
    this.currentPaletteName = id;
    this.recolorAllBalls(id);
  }

  // ── Private helpers ────────────────────────────────────────────────

  /** Replace all existing ball sprites when quality mode changes. */
  private swapAllSprites() {
    const { sprites } = this.ctx_.systems;
    const stage = this.ctx_.systems.pixi.app.stage;
    const quality = this.ctx_.quality;
    for (const entry of this.balls) {
      const oldSprite = entry.sprite;
      const newSprite =
        quality === 'enhanced'
          ? sprites.makeEnhancedBallSprite(entry.radius, entry.color)
          : sprites.makeCircleSprite(entry.radius, entry.color);
      newSprite.x = oldSprite.x;
      newSprite.y = oldSprite.y;
      stage.addChild(newSprite);
      oldSprite.parent?.removeChild(oldSprite);
      oldSprite.destroy();
      entry.sprite = newSprite;
    }
  }

  /** Recolor all existing balls to a new palette when the style setting changes. */
  private recolorAllBalls(paletteName: string) {
    const { sprites } = this.ctx_.systems;
    const stage = this.ctx_.systems.pixi.app.stage;
    const quality = this.ctx_.quality;
    const palette = styleRegistry.getPalette(paletteName);
    for (const entry of this.balls) {
      const newColor = styleRegistry.randomBallColor(palette);
      entry.color = newColor;
      const oldSprite = entry.sprite;
      const newSprite =
        quality === 'enhanced'
          ? sprites.makeEnhancedBallSprite(entry.radius, newColor)
          : sprites.makeCircleSprite(entry.radius, newColor);
      newSprite.x = oldSprite.x;
      newSprite.y = oldSprite.y;
      stage.addChild(newSprite);
      oldSprite.parent?.removeChild(oldSprite);
      oldSprite.destroy();
      entry.sprite = newSprite;
    }
  }

  private spawnBall(x: number, y: number, vxPxS = 0, vyPxS = 0) {
    const { world, sprites, audio, settings } = this.ctx_.systems;
    const ballSize = (settings.get('ballSize') as number) ?? 19;
    const half = ballSize * 0.45;
    const radius = Math.max(4, Math.round(ballSize - half + Math.random() * half * 2));
    const palette = styleRegistry.getPalette(this.currentPaletteName);
    const color = styleRegistry.randomBallColor(palette);

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

    if (vxPxS !== 0 || vyPxS !== 0) {
      handle.body.setLinearVelocity(planck.Vec2(vxPxS * PX_TO_M, vyPxS * PX_TO_M));
    }

    const quality = this.ctx_.quality;
    const sprite =
      quality === 'enhanced'
        ? sprites.makeEnhancedBallSprite(radius, color)
        : sprites.makeCircleSprite(radius, color);

    this.ctx_.systems.pixi.app.stage.addChild(sprite);
    this.balls.push({ handle, sprite, radius, color });

    if (settings.get('audio') !== false) {
      audio.playTone('pop');
    }

    this.score += 1;
    this.ctx_.emit({ kind: 'score_update', value: this.score });
  }

  private triggerExplosion(cx: number, cy: number) {
    // Single shockwave ring.
    this.shockwaves.push({ x: cx, y: cy, r: 0, color: 0xffffff, age: 0 });

    const explodeStrength =
      (this.ctx_.systems.settings.get('explodeStrength') as number | undefined) ??
      EXPLOSION_STRENGTH_DEFAULT;

    // Physics impulse on nearby balls
    for (const entry of this.balls) {
      const pos = entry.handle.body.getPosition();
      const bx = pos.x * 100;
      const by = pos.y * 100;
      const dx = bx - cx;
      const dy = by - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > EXPLOSION_RADIUS || dist < 1) continue;

      const falloff = 1 - dist / EXPLOSION_RADIUS;
      const magnitude = explodeStrength * falloff;
      const nx = dx / dist;
      const ny = dy / dist;

      entry.handle.body.applyLinearImpulse(
        planck.Vec2(nx * magnitude, ny * magnitude),
        entry.handle.body.getWorldCenter(),
        true,
      );
    }
  }
}
