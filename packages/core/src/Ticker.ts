/**
 * packages/core/src/Ticker.ts
 *
 * Fixed-step physics accumulator + requestAnimationFrame render loop.
 * Physics always runs at PHYSICS_HZ regardless of render FPS.
 * No React, no Pixi, no planck imports — pure timing logic.
 */

export const PHYSICS_HZ = 60; // physics steps per second
const PHYSICS_DT = 1 / PHYSICS_HZ; // seconds per step
const MAX_CATCH_UP_STEPS = 5; // prevent spiral-of-death

export type TickCallback = (dt: number, physicsSteps: number) => void;
export type FixedStepCallback = (dt: number) => void;
export type RenderCallback = (alpha: number) => void;

export class Ticker {
  private rafId = 0;
  private lastTime: number | null = null;
  private accumulator = 0;
  private running = false;

  private readonly onFixedUpdate: FixedStepCallback;
  private readonly onUpdate: TickCallback;
  private readonly onRender: RenderCallback;
  /** Minimum milliseconds between processed frames (0 = uncapped). */
  private readonly minFrameMs: number;

  // FPS sampling
  private frameCount = 0;
  private fpsWindow = 0;
  fps = 0;

  constructor(opts: {
    onFixedUpdate: FixedStepCallback;
    onUpdate: TickCallback;
    onRender: RenderCallback;
    /**
     * Cap the tick rate. Frames arriving sooner than `1000/maxFps` ms since
     * the last processed frame are skipped. Useful for preview tiles that need
     * to share the JS thread without saturating it.
     */
    maxFps?: number;
  }) {
    this.onFixedUpdate = opts.onFixedUpdate;
    this.onUpdate = opts.onUpdate;
    this.onRender = opts.onRender;
    this.minFrameMs = opts.maxFps != null && opts.maxFps > 0 ? 1000 / opts.maxFps : 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.lastTime = null;
    this.accumulator = 0;
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    if (this.lastTime === null) {
      this.lastTime = now;
      return;
    }

    // FPS cap: skip this rAF if the minimum frame interval hasn't elapsed yet.
    // lastTime is only updated when we actually process a frame, so the elapsed
    // calculation for the next eligible frame remains correct.
    if (this.minFrameMs > 0 && now - this.lastTime < this.minFrameMs) return;

    const elapsed = Math.min((now - this.lastTime) / 1000, 0.25); // cap at 250 ms
    this.lastTime = now;

    this.accumulator += elapsed;

    let steps = 0;
    while (this.accumulator >= PHYSICS_DT && steps < MAX_CATCH_UP_STEPS) {
      this.onFixedUpdate(PHYSICS_DT);
      this.accumulator -= PHYSICS_DT;
      steps++;
    }

    this.onUpdate(elapsed, steps);

    // alpha is how far we are between the last and next physics step
    const alpha = this.accumulator / PHYSICS_DT;
    this.onRender(alpha);

    // FPS sampling (update every second)
    this.frameCount++;
    this.fpsWindow += elapsed;
    if (this.fpsWindow >= 1) {
      this.fps = Math.round(this.frameCount / this.fpsWindow);
      this.frameCount = 0;
      this.fpsWindow = 0;
    }
  };
}
