import {
  RawWebGL2Scene,
  finiteNumberSetting,
  type DomStylePayload,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import { GpuFluidTankRenderer, velocityFromScreenDelta, type GpuFluidTankOptions } from './GpuFluidTankRenderer.js';
import { FLUID_TANK_DEFAULTS } from './fluid-tank.config.js';
import { boundedCyanStyle } from './styles/bounded-cyan.js';

interface RawPointerTrailPoint {
  x: number;
  y: number;
}

const MARKUP = `
  <canvas data-raw-fluid-canvas="true" class="absolute inset-0 h-full w-full touch-none"></canvas>
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
  constructor() {
    let controller: RawFluidTankController | null = null;
    super({
      name: 'RawFluidTank',
      markup: MARKUP,
      canvasSelector: '[data-raw-fluid-canvas="true"]',
      onInit: (state) => {
        controller = new RawFluidTankController(state);
      },
      onSettingsChange: (state) => controller?.applySettings(state),
      onStyleChange: (state) => controller?.applyStyle(state),
      onModeChange: (_state, mode) => controller?.setMode(mode),
      onReset: (state) => controller?.reset(state),
      render: (state) => controller?.render(state),
      onDestroy: () => {
        controller?.destroy();
        controller = null;
      },
    });
  }
}

class RawFluidTankController {
  private readonly renderer: GpuFluidTankRenderer;
  private readonly pointerTrails = new Map<number, RawPointerTrailPoint>();
  private interactionMode: 'stir' | 'inject' = 'stir';
  private options: GpuFluidTankOptions;
  private seed: number;
  private splatCount = 0;
  private disposed = false;

  constructor(state: RawWebGL2RenderState) {
    this.seed = Math.random() * 1000;
    this.options = this.readOptions(state.settings, state.style, this.seed);
    this.renderer = new GpuFluidTankRenderer(state.canvas.parentElement ?? document.body, this.options, 'raw', { canvas: state.canvas });
    this.renderer.resize(state.width, state.height, true);
    this.renderer.randomizeDye(this.seed, true);
    this.bindPointerInput(state.canvas);
  }

  applySettings(state: RawWebGL2RenderState): void {
    const next = this.readOptions(state.settings, state.style, this.seed);
    const rebuild = next.cellSize !== this.options.cellSize;
    this.options = next;
    this.renderer.setOptions(next);
    if (rebuild) this.renderer.randomizeDye(this.seed, true);
  }

  applyStyle(state: RawWebGL2RenderState): void {
    const next = this.readOptions(state.settings, state.style, this.seed);
    this.options = next;
    this.renderer.setOptions({
      exposure: next.exposure,
      palette: next.palette,
      paletteStrength: next.paletteStrength,
      edgeDarkening: next.edgeDarkening,
    });
    this.renderer.randomizeDye(this.seed, false);
  }

  setMode(mode: string): void {
    this.interactionMode = mode === 'inject' ? 'inject' : 'stir';
  }

  reset(state: RawWebGL2RenderState): void {
    this.seed = Math.random() * 1000;
    this.options = this.readOptions(state.settings, state.style, this.seed);
    this.renderer.setOptions(this.options);
    this.renderer.randomizeDye(this.seed, true);
    this.pointerTrails.clear();
    this.splatCount = 0;
  }

  render(state: RawWebGL2RenderState): void {
    if (this.disposed) return;
    this.renderer.resize(state.width, state.height);
    this.renderer.update(Math.min(1 / 30, Math.max(1 / 120, state.deltaSeconds || 1 / 60)));
    this.renderer.render();
  }

  destroy(): void {
    this.disposed = true;
    this.pointerTrails.clear();
    this.renderer.destroy();
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
        this.renderer.splat({ x: point.x, y: point.y, dx: velocity.dx, dy: velocity.dy, radiusScale: this.interactionMode === 'inject' ? 1.2 : 1 });
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
  }

  private toCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): RawPointerTrailPoint {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((event.clientY - rect.top) / Math.max(1, rect.height)),
    };
  }

  private readOptions(settings: Record<string, unknown>, style: DomStylePayload | null, seed: number): GpuFluidTankOptions {
    const palette = style?.palette?.length ? style.palette : boundedCyanStyle.palette;
    const uniforms = style?.uniforms ?? {};
    return {
      cellSize: finiteNumberSetting(settings, 'cellSize', Number(FLUID_TANK_DEFAULTS.cellSize)),
      fingerForce: finiteNumberSetting(settings, 'fingerForce', Number(FLUID_TANK_DEFAULTS.fingerForce)),
      fingerRadius: finiteNumberSetting(settings, 'fingerRadius', Number(FLUID_TANK_DEFAULTS.fingerRadius)),
      viscosity: finiteNumberSetting(settings, 'viscosity', Number(FLUID_TANK_DEFAULTS.viscosity)),
      curl: finiteNumberSetting(settings, 'curl', Number(FLUID_TANK_DEFAULTS.curl)),
      eddyAssist: finiteNumberSetting(settings, 'eddyAssist', Number(FLUID_TANK_DEFAULTS.eddyAssist)),
      dyePersistence: finiteNumberSetting(settings, 'dyePersistence', Number(FLUID_TANK_DEFAULTS.dyePersistence)),
      pressureIterations: Math.round(finiteNumberSetting(settings, 'pressureIterations', Number(FLUID_TANK_DEFAULTS.pressureIterations))),
      injectColorMode: injectColorModeSetting(settings.injectPalette, FLUID_TANK_DEFAULTS.injectPalette),
      ambient: Boolean(settings.ambient ?? FLUID_TANK_DEFAULTS.ambient),
      exposure: typeof uniforms.exposure === 'number' ? uniforms.exposure : 1.06,
      palette,
      paletteStrength: typeof uniforms.paletteStrength === 'number' ? uniforms.paletteStrength : 0.82,
      edgeDarkening: typeof uniforms.edgeDarkening === 'number' ? uniforms.edgeDarkening : 0.35,
      seed,
    };
  }
}

function injectColorModeSetting(value: unknown, fallback: unknown): GpuFluidTankOptions['injectColorMode'] {
  const candidate = typeof value === 'string' ? value : String(fallback ?? 'style');
  if (candidate === 'style' || candidate === 'cyan' || candidate === 'magenta' || candidate === 'amber' || candidate === 'rainbow') return candidate;
  return 'style';
}

function clamp01(value: number): number {
  return Math.max(0.001, Math.min(0.999, value));
}
