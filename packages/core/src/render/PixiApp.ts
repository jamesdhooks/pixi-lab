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
  /**
   * Cap the total rendered pixel count (width × height × resolution²).
   * When the canvas exceeds this budget a sub-1 resolution is computed so the
   * physical render target stays within the limit while CSS dimensions remain
   * unchanged (autoDensity handles upscaling).
   * Example: 921_600 ≈ 1280×720 — useful on fill-rate-constrained devices.
   */
  maxPixels?: number;
  antialias?: boolean;
  background?: number;
  backgroundAlpha?: number;
  /**
   * Force a specific renderer backend.
   * Defaults to 'webgl' — skips WebGPU detection which can be slow or unstable
   * on embedded GPU drivers (e.g. Raspberry Pi VideoCore).
   */
  preference?: 'webgl' | 'webgpu' | 'canvas';
}

export class PixiApp {
  readonly app: Application;
  private _width: number;
  private _height: number;
  private _maxDpr: number;
  private _maxPixels: number | undefined;

  private constructor(opts: PixiAppOptions) {
    this._width = opts.width;
    this._height = opts.height;
    this._maxDpr = opts.maxDpr ?? 2;
    this._maxPixels = opts.maxPixels;
    this.app = new Application();
  }

  /** Async factory — only supported entry point */
  static async create(opts: PixiAppOptions): Promise<PixiApp> {
    const instance = new PixiApp(opts);
    // Use explicit dimensions instead of resizeTo. The caller's ResizeObserver
    // (in GameApp) handles future resizes. resizeTo was causing a feedback loop
    // where Pixi's internal observer could measure the container at an invalid
    // time (e.g. during layout) and produce absurd canvas dimensions (2^25+1).
    const w = Math.max(opts.width, 1);
    const h = Math.max(opts.height, 1);
    // If maxPixels is set, compute the largest resolution that keeps physical
    // pixels (w × resolution) × (h × resolution) within budget.
    const pixelScaleCap =
      opts.maxPixels !== undefined
        ? Math.sqrt(opts.maxPixels / (w * h))
        : Infinity;
    const resolution = Math.max(
      0.25,
      Math.min(window.devicePixelRatio, opts.maxDpr ?? 2, pixelScaleCap),
    );
    await instance.app.init({
      width: w,
      height: h,
      background: opts.background ?? 0x1a1a2e,
      backgroundAlpha: opts.backgroundAlpha ?? 1,
      antialias: opts.antialias ?? true,
      resolution,
      autoDensity: true,
      autoStart: false,
      preference: opts.preference ?? 'webgl',
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

  render() {
    this.app.render();
  }

  setMaxPixels(maxPixels: number | undefined) {
    this._maxPixels = maxPixels;
    const w = Math.max(this._width, 1);
    const h = Math.max(this._height, 1);
    const pixelScaleCap =
      this._maxPixels !== undefined
        ? Math.sqrt(this._maxPixels / (w * h))
        : Infinity;
    const newResolution = Math.max(
      0.25,
      Math.min(window.devicePixelRatio, this._maxDpr, pixelScaleCap),
    );
    if (this.app.renderer.resolution !== newResolution) {
      this.app.renderer.resolution = newResolution;
    }
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
