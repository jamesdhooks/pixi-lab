import {
  RawWebGL2Scene,
  finiteNumberSetting,
  type DomStylePayload,
  type GestureEvent,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import { GpuFluidTankRenderer, velocityFromScreenDelta, type GpuFluidTankOptions } from './GpuFluidTankRenderer.js';
import { FLUID_TANK_DEFAULTS } from './fluid-tank.config.js';
import { boundedCyanStyle } from './styles/bounded-cyan.js';

const PUBLIC_RANDOM_IMAGE_URL_BASE = 'https://picsum.photos';
const PREVIEW_FINGER_RADIUS = 0.026;
const PREVIEW_INJECT_AMOUNT = 0.62;
const PREVIEW_INJECT_TURBULENCE = 0.32;

interface RawPointerTrailPoint {
  x: number;
  y: number;
}

const MARKUP = `
  <canvas data-raw-fluid-canvas="true" class="absolute inset-0 h-full w-full touch-none"></canvas>
  <div
    data-raw-fluid-loading="true"
    aria-hidden="true"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;opacity:0;pointer-events:none;transition:opacity 260ms ease;color:rgba(255,255,255,0.72);font:700 11px/1.2 system-ui,sans-serif;letter-spacing:0.16em;text-transform:uppercase;"
  >
    Loading image
  </div>
  <div class="hidden" aria-hidden="true" data-raw-fluid-hud></div>
`;

/**
 * Raw WebGL2 Fluid Tank scene.
 *
 * The multi-pass solver still lives in GpuFluidTankRenderer, but mounting,
 * reset, settings, style, mode, render loop, and teardown now flow through the
 * shared RawWebGL2Scene lifecycle instead of the generated standalone runtime.
 */
export class RawFluidTankScene extends RawWebGL2Scene {
  private controller: RawFluidTankController | null = null;

  constructor(private readonly preview = false) {
    super({
      name: 'RawFluidTank',
      markup: MARKUP,
      canvasSelector: '[data-raw-fluid-canvas="true"]',
      onInit: (state) => {
        this.controller = new RawFluidTankController(state, this.preview);
      },
      onSettingsChange: (state) => this.controller?.applySettings(state),
      onStyleChange: (state) => this.controller?.applyStyle(state),
      onModeChange: (_state, mode) => this.controller?.setMode(mode),
      onReset: (state) => this.controller?.reset(state),
      render: (state) => this.controller?.render(state),
      getDebugStats: () => this.controller?.getDebugStats() ?? null,
      onDestroy: () => {
        this.controller?.destroy();
        this.controller = null;
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.controller?.pushGestures(gestures);
  }
}

class RawFluidTankController {
  private readonly renderer: GpuFluidTankRenderer;
  private readonly pointerTrails = new Map<number, RawPointerTrailPoint>();
  private readonly preview: boolean;
  private readonly loadingElement: HTMLElement | null;
  private interactionMode: 'stir' | 'inject';
  private options: GpuFluidTankOptions;
  private seed: number;
  private splatCount = 0;
  private disposed = false;

  constructor(state: RawWebGL2RenderState, preview: boolean) {
    this.preview = preview;
    this.interactionMode = 'inject';
    this.seed = Math.random() * 1000;
    this.options = this.readOptions(state.settings, state.style, this.seed);
    const mount = state.canvas.parentElement ?? document.body;
    this.renderer = new GpuFluidTankRenderer(mount, this.options, 'raw', { canvas: state.canvas });
    this.renderer.canvas.style.pointerEvents = 'auto';
    this.loadingElement = mount.querySelector('[data-raw-fluid-loading="true"]');
    this.renderer.resize(this.canvasCssWidth(state.canvas), this.canvasCssHeight(state.canvas), true);
    this.renderer.randomizeDye(this.seed, this.options.initMode !== 'blank');
    this.bindPointerInput(this.renderer.canvas);
  }

  applySettings(state: RawWebGL2RenderState): void {
    const next = this.readOptions(state.settings, state.style, this.seed);
    const rebuild = next.cellSize !== this.options.cellSize;
    const initChanged = next.initMode !== this.options.initMode || next.initImageUrl !== this.options.initImageUrl;
    this.options = next;
    this.renderer.setOptions(next);
    if (rebuild || initChanged) this.renderer.randomizeDye(this.seed, next.initMode !== 'blank');
  }

  applyStyle(state: RawWebGL2RenderState): void {
    const next = this.readOptions(state.settings, state.style, this.seed);
    this.options = next;
    this.renderer.setOptions({
      exposure: next.exposure,
      palette: next.palette,
      paletteStrength: next.paletteStrength,
      edgeDarkening: next.edgeDarkening,
      shadingStrength: next.shadingStrength,
      bloomStrength: next.bloomStrength,
      bloomThreshold: next.bloomThreshold,
      sunraysStrength: next.sunraysStrength,
      visualPipeline: next.visualPipeline,
    });
    this.renderer.randomizeDye(this.seed, this.options.initMode !== 'blank');
  }

  setMode(mode: string): void {
    this.interactionMode = mode === 'inject' || mode === 'demo' ? 'inject' : 'stir';
  }

  reset(state: RawWebGL2RenderState): void {
    this.seed = Math.random() * 1000;
    this.options = this.readOptions(state.settings, state.style, this.seed);
    this.renderer.resize(this.renderer.canvas.clientWidth || this.canvasCssWidth(state.canvas), this.renderer.canvas.clientHeight || this.canvasCssHeight(state.canvas), true);
    this.renderer.setOptions(this.options);
    this.renderer.randomizeDye(this.seed, this.options.initMode !== 'blank');
    this.pointerTrails.clear();
    this.splatCount = 0;
  }

  render(state: RawWebGL2RenderState): void {
    if (this.disposed) return;
    this.renderer.resize(this.canvasCssWidth(state.canvas), this.canvasCssHeight(state.canvas));
    this.updateImageLoadingState();
    const timescale = finiteNumberSetting(state.settings, 'timescale', Number(FLUID_TANK_DEFAULTS.timescale ?? 1));
    const dt = Math.min(1 / 30, Math.max(1 / 120, state.deltaSeconds || 1 / 60)) * Math.max(0, timescale);
    this.renderer.update(dt);
    this.renderer.render();
  }

  destroy(): void {
    this.disposed = true;
    this.pointerTrails.clear();
    this.renderer.destroy();
  }

  getDebugStats(): Record<string, string | number | boolean | null> {
    const stats = this.renderer.stats();
    return {
      renderer: 'raw-webgl2-fluid',
      supported: stats.supported,
      simulation: stats.simulation,
      rendering: stats.rendering,
      gpuSimulated: stats.gpuSimulated,
      gpuRendered: stats.gpuRendered,
      cpuTopology: stats.cpuTopology,
      cpuUpload: stats.cpuUpload,
      simRt: `${stats.simWidth}x${stats.simHeight}`,
      dyeRt: `${stats.dyeWidth}x${stats.dyeHeight}`,
      gpuTargetTextures: stats.gpuTargetTextures,
      gpuTargetTexels: stats.gpuTargetTexels,
      gpuPasses: stats.gpuPassesPerFrame,
      splats: stats.splats,
    };
  }

  pushGestures(gestures: GestureEvent[]): void {
    const canvas = this.renderer.canvas;
    const width = Math.max(1, canvas.clientWidth || this.canvasCssWidth(canvas));
    const height = Math.max(1, canvas.clientHeight || this.canvasCssHeight(canvas));
    const stats = this.renderer.stats();
    for (const gesture of gestures) {
      const id = gesture.id ?? -1;
      if (gesture.kind === 'release') {
        this.pointerTrails.delete(id);
        continue;
      }
      if (gesture.kind !== 'drag' && gesture.kind !== 'tap' && gesture.kind !== 'hold') continue;
      const point = {
        x: clamp01(gesture.x / width),
        y: clamp01(gesture.y / height),
      };
      const motion = gesture as GestureEvent & { dx?: number; dy?: number };
      const previous = this.pointerTrails.get(id);
      const fallbackDx = previous ? (point.x - previous.x) * width : 0;
      const fallbackDy = previous ? (point.y - previous.y) * height : 0;
      const dx = Number.isFinite(motion.dx) ? Number(motion.dx) : fallbackDx;
      const dy = Number.isFinite(motion.dy) ? Number(motion.dy) : fallbackDy;
      const velocity = velocityFromScreenDelta(
        dx,
        dy,
        width,
        height,
        stats.simWidth || 1,
        stats.simHeight || 1,
      );
      if (this.interactionMode === 'inject') {
        this.renderer.inject(point.x, point.y, velocity.dx, velocity.dy, gesture.kind === 'tap' ? 0.72 : 1);
      } else if (gesture.kind === 'tap' || gesture.kind === 'hold') {
        this.renderer.smallSwirl(point.x, point.y);
      } else {
        this.renderer.stir({ x: point.x, y: point.y, dx: velocity.dx, dy: velocity.dy, radiusScale: 1 });
      }
      this.pointerTrails.set(id, point);
      this.splatCount += 1;
    }
  }

  private bindPointerInput(canvas: HTMLCanvasElement): void {
    canvas.style.pointerEvents = 'auto';
    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture?.(event.pointerId);
      const point = this.toCanvasPoint(canvas, event);
      this.pointerTrails.set(event.pointerId, point);
      if (this.interactionMode === 'inject') {
        this.renderer.inject(point.x, point.y, 0, 0, 1.25);
      } else {
        this.renderer.smallSwirl(point.x, point.y);
      }
      this.splatCount += 1;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        this.pointerTrails.delete(event.pointerId);
        return;
      }
      const previous = this.pointerTrails.get(event.pointerId);
      if (!previous) return;
      const point = this.toCanvasPoint(canvas, event);
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.002) {
        const stats = this.renderer.stats();
        const velocity = velocityFromScreenDelta(
          dx * canvas.clientWidth,
          dy * canvas.clientHeight,
          canvas.clientWidth,
          canvas.clientHeight,
          stats.simWidth || 1,
          stats.simHeight || 1,
        );
        if (this.interactionMode === 'inject') {
          this.renderer.inject(point.x, point.y, velocity.dx, velocity.dy, 1.25);
        } else {
          this.renderer.stir({ x: point.x, y: point.y, dx: velocity.dx, dy: velocity.dy, radiusScale: 1 });
        }
        this.splatCount += 1;
      }
      this.pointerTrails.set(event.pointerId, point);
    };
    const onPointerEnd = (event: PointerEvent) => {
      this.pointerTrails.delete(event.pointerId);
      canvas.releasePointerCapture?.(event.pointerId);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    canvas.addEventListener('lostpointercapture', onPointerEnd);
  }

  private toCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): RawPointerTrailPoint {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((event.clientY - rect.top) / Math.max(1, rect.height)),
    };
  }

  private canvasCssWidth(canvas: HTMLCanvasElement): number {
    const rect = canvas.getBoundingClientRect();
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    return Math.max(1, rect.width || parentRect?.width || canvas.clientWidth || canvas.width);
  }

  private canvasCssHeight(canvas: HTMLCanvasElement): number {
    const rect = canvas.getBoundingClientRect();
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    return Math.max(1, rect.height || parentRect?.height || canvas.clientHeight || canvas.height);
  }

  private updateImageLoadingState(): void {
    if (!this.loadingElement) return;
    this.loadingElement.style.opacity = this.renderer.imageLoadState().loading ? '1' : '0';
  }

  private readOptions(settings: Record<string, unknown>, style: DomStylePayload | null, seed: number): GpuFluidTankOptions {
    const palette = style?.palette?.length ? style.palette : boundedCyanStyle.palette;
    const uniforms = style?.uniforms ?? {};
    const cellSize = finiteNumberSetting(settings, 'cellSize', Number(FLUID_TANK_DEFAULTS.cellSize));
    const pressureIterations = Math.round(finiteNumberSetting(settings, 'pressureIterations', Number(FLUID_TANK_DEFAULTS.pressureIterations)));
    const visualPipeline: GpuFluidTankOptions['visualPipeline'] = style?.id === 'webgl-fluid-glow' ? 'reference' : 'standard';
    const usePostProcessing = visualPipeline === 'reference';
    return {
      cellSize: this.preview ? Math.max(1.85, cellSize) : cellSize,
      fingerForce: this.preview ? Math.min(9, finiteNumberSetting(settings, 'fingerForce', Number(FLUID_TANK_DEFAULTS.fingerForce))) : finiteNumberSetting(settings, 'fingerForce', Number(FLUID_TANK_DEFAULTS.fingerForce)),
      fingerRadius: this.preview ? PREVIEW_FINGER_RADIUS : finiteNumberSetting(settings, 'fingerRadius', Number(FLUID_TANK_DEFAULTS.fingerRadius)),
      viscosity: finiteNumberSetting(settings, 'viscosity', Number(FLUID_TANK_DEFAULTS.viscosity)),
      curl: finiteNumberSetting(settings, 'curl', Number(FLUID_TANK_DEFAULTS.curl)),
      eddyAssist: finiteNumberSetting(settings, 'eddyAssist', Number(FLUID_TANK_DEFAULTS.eddyAssist)),
      velocityPersistence: finiteNumberSetting(settings, 'velocityPersistence', Number(FLUID_TANK_DEFAULTS.velocityPersistence)),
      dyePersistence: finiteNumberSetting(settings, 'dyePersistence', Number(FLUID_TANK_DEFAULTS.dyePersistence)),
      injectAmount: this.preview ? PREVIEW_INJECT_AMOUNT : finiteNumberSetting(settings, 'injectAmount', Number(FLUID_TANK_DEFAULTS.injectAmount)),
      injectTurbulence: this.preview ? PREVIEW_INJECT_TURBULENCE : finiteNumberSetting(settings, 'injectTurbulence', Number(FLUID_TANK_DEFAULTS.injectTurbulence)),
      pressureIterations: this.preview ? Math.min(18, pressureIterations) : pressureIterations,
      injectColorMode: injectColorModeSetting(settings.injectPalette, FLUID_TANK_DEFAULTS.injectPalette),
      ambient: Boolean(settings.ambient ?? FLUID_TANK_DEFAULTS.ambient),
      exposure: typeof uniforms.exposure === 'number' ? uniforms.exposure : Number(boundedCyanStyle.uniforms?.exposure ?? 1),
      palette,
      paletteStrength: typeof uniforms.paletteStrength === 'number' ? uniforms.paletteStrength : Number(boundedCyanStyle.uniforms?.paletteStrength ?? 0.76),
      edgeDarkening: typeof uniforms.edgeDarkening === 'number' ? uniforms.edgeDarkening : Number(boundedCyanStyle.uniforms?.edgeDarkening ?? 0.18),
      shadingStrength: usePostProcessing
        ? finiteNumberSetting(settings, 'shadingStrength', typeof uniforms.shadingStrength === 'number' ? uniforms.shadingStrength : 0.72)
        : 0,
      bloomStrength: usePostProcessing
        ? finiteNumberSetting(settings, 'bloomStrength', typeof uniforms.bloomStrength === 'number' ? uniforms.bloomStrength : 0.55)
        : 0,
      bloomThreshold: finiteNumberSetting(settings, 'bloomThreshold', typeof uniforms.bloomThreshold === 'number' ? uniforms.bloomThreshold : 0.62),
      sunraysStrength: usePostProcessing
        ? finiteNumberSetting(settings, 'sunraysStrength', typeof uniforms.sunraysStrength === 'number' ? uniforms.sunraysStrength : 0.46)
        : 0,
      visualPipeline,
      seed,
      displayMode: 'dye',
      initMode: this.preview ? 'blank' : initModeSetting(settings.renderStyle, FLUID_TANK_DEFAULTS.renderStyle),
      initImageUrl: this.preview ? '' : resolveInitImageUrl(settings.initImageUrl, seed),
    };
  }
}

function initModeSetting(value: unknown, fallback: unknown): GpuFluidTankOptions['initMode'] {
  const candidate = typeof value === 'string' ? value : String(fallback ?? 'cloud');
  if (candidate === 'cloud' || candidate === 'voronoi' || candidate === 'random' || candidate === 'image' || candidate === 'blank') return candidate;
  return 'cloud';
}

function resolveInitImageUrl(value: unknown, seed: number): string {
  const explicit = typeof value === 'string' ? value.trim() : '';
  if (explicit.length > 0) return explicit;
  const size = 1280;
  const imageSeed = Math.abs(Math.floor(seed * 100000)).toString(36);
  return `${PUBLIC_RANDOM_IMAGE_URL_BASE}/seed/fluid-tank-${imageSeed}/${size}/${size}`;
}

function injectColorModeSetting(value: unknown, fallback: unknown): GpuFluidTankOptions['injectColorMode'] {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : String(fallback ?? 'style').trim().toLowerCase();
  if (candidate === 'style' || candidate === 'palette') return 'style';
  if (candidate === 'cyan' || candidate === 'teal') return 'cyan';
  if (candidate === 'magenta' || candidate === 'pink') return 'magenta';
  if (candidate === 'amber' || candidate === 'orange') return 'amber';
  if (candidate === 'green' || candidate === 'lime') return 'green';
  if (candidate === 'blue' || candidate === 'azure') return 'blue';
  if (candidate === 'red' || candidate === 'crimson') return 'red';
  if (candidate === 'white' || candidate === 'bright') return 'white';
  if (candidate === 'rainbow') return 'rainbow';
  return 'style';
}

function clamp01(value: number): number {
  return Math.max(0.001, Math.min(0.999, value));
}
