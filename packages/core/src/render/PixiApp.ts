/**
 * packages/core/src/render/PixiApp.ts
 *
 * Pixi Application bootstrap. Creates and manages the WebGL renderer.
 * Handles DPR-aware resolution, antialias config, and teardown.
 */
import { Application } from 'pixi.js';

export interface PixiAppOptions {
  container: HTMLElement;
  width: number;
  height: number;
  /** Cap DPR to avoid excessive resolution on high-DPR mobile screens */
  maxDpr?: number;
  antialias?: boolean;
  background?: number;
}

export class PixiApp {
  readonly app: Application;
  private _width: number;
  private _height: number;

  constructor(opts: PixiAppOptions) {
    this._width = opts.width;
    this._height = opts.height;

    this.app = new Application();
    // Pixi v8 init is async but we expose a factory for convenience
    void this.app.init({
      resizeTo: opts.container,
      background: opts.background ?? 0x1a1a2e,
      antialias: opts.antialias ?? false, // off by default for Pi 5 perf
      resolution: Math.min(window.devicePixelRatio, opts.maxDpr ?? 2),
      autoDensity: true,
    });
  }

  /** Async factory — preferred entry point */
  static async create(opts: PixiAppOptions): Promise<PixiApp> {
    const instance = new PixiApp(opts);
    await instance.app.init({
      resizeTo: opts.container,
      background: opts.background ?? 0x1a1a2e,
      antialias: opts.antialias ?? false,
      resolution: Math.min(window.devicePixelRatio, opts.maxDpr ?? 2),
      autoDensity: true,
    });
    opts.container.appendChild(instance.app.canvas);
    return instance;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get stage() {
    return this.app.stage;
  }

  get renderer() {
    return this.app.renderer;
  }

  resize(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.app.renderer.resize(width, height);
  }

  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }

  destroy() {
    this.app.destroy(true, { children: true });
  }
}
