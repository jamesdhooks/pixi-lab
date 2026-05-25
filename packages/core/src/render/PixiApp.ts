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
  backgroundAlpha?: number;
}

export class PixiApp {
  readonly app: Application;
  private _width: number;
  private _height: number;

  private constructor(opts: PixiAppOptions) {
    this._width = opts.width;
    this._height = opts.height;
    this.app = new Application();
  }

  /** Async factory — only supported entry point */
  static async create(opts: PixiAppOptions): Promise<PixiApp> {
    const instance = new PixiApp(opts);
    // Use explicit dimensions instead of resizeTo. The caller's ResizeObserver
    // (in GameApp) handles future resizes. resizeTo was causing a feedback loop
    // where Pixi's internal observer could measure the container at an invalid
    // time (e.g. during layout) and produce absurd canvas dimensions (2^25+1).
    await instance.app.init({
      width: Math.max(opts.width, 1),
      height: Math.max(opts.height, 1),
      background: opts.background ?? 0x1a1a2e,
      backgroundAlpha: opts.backgroundAlpha ?? 1,
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
    // Use { removeView: true } instead of bare `true` to avoid triggering
    // GlobalResourceRegistry.release(), which clears the shared batch pool and
    // corrupts any other Pixi Application instances still running in the same tab
    // (e.g. GameTile preview apps on the home screen behind the GameLauncher).
    this.app.destroy({ removeView: true }, { children: true });
  }
}
