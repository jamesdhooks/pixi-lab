/**
 * packages/core/src/screensaver/ScreensaverManager.ts
 *
 * Idle detector + screensaver scene scheduler.
 * Listens for pointer activity; when idle > threshold, calls onEnterScreensaver.
 * Any pointer event exits screensaver mode.
 */

export type ScreensaverHandler = () => void;

export class ScreensaverManager {
  private idleMs = 0;
  private thresholdMs: number;
  private inScreensaver = false;
  private onEnter: ScreensaverHandler;
  private onExit: ScreensaverHandler;

  constructor(opts: {
    thresholdMs?: number;
    onEnter: ScreensaverHandler;
    onExit: ScreensaverHandler;
  }) {
    this.thresholdMs = opts.thresholdMs ?? 60_000;
    this.onEnter = opts.onEnter;
    this.onExit = opts.onExit;
  }

  /** Called every game tick from GameApp. dt in seconds. */
  tick(dt: number, hasHumanInput: boolean) {
    if (hasHumanInput) {
      this.idleMs = 0;
      if (this.inScreensaver) {
        this.inScreensaver = false;
        this.onExit();
      }
      return;
    }

    if (this.inScreensaver) return; // already in screensaver

    this.idleMs += dt * 1000;
    if (this.idleMs >= this.thresholdMs) {
      this.inScreensaver = true;
      this.onEnter();
    }
  }

  setThresholdMs(ms: number) {
    this.thresholdMs = ms;
  }

  forceExit() {
    if (this.inScreensaver) {
      this.inScreensaver = false;
      this.idleMs = 0;
      this.onExit();
    }
  }

  reset() {
    this.idleMs = 0;
    this.inScreensaver = false;
  }

  get active() {
    return this.inScreensaver;
  }
}
