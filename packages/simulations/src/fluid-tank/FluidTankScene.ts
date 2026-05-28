import {
  GpuFluidTankRenderer,
  SimulationScene,
  velocityFromScreenDelta,
  type GameContext,
  type GpuFluidTankOptions,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyle,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { FLUID_TANK_DEFAULTS } from './fluid-tank.config.js';
import { boundedCyanStyle } from './styles/bounded-cyan.js';
import { nebulaOilStyle } from './styles/nebula-oil.js';
import { thermalBloomStyle } from './styles/thermal-bloom.js';

interface PointerTrailPoint {
  x: number;
  y: number;
  movedDistance: number;
}

interface FluidRipple {
  x: number;
  y: number;
  radius: number;
  life: number;
}

export const fluidTankStyleManifest: SimStyleManifest = {
  defaultStyleId: 'bounded-cyan',
  capabilities: {
    renderLayers: ['fluid', 'glow', 'debug'],
    passes: ['gpuFluid', 'bloom', 'edgeGlow', 'chromaticAberration', 'colorGrade', 'composite'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [boundedCyanStyle, nebulaOilStyle, thermalBloomStyle],
};

export class FluidTankScene extends SimulationScene {
  readonly name = 'FluidTank';
  private renderer: GpuFluidTankRenderer | null = null;
  private rendererParent: HTMLElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayContext: CanvasRenderingContext2D | null = null;
  private options: GpuFluidTankOptions | null = null;
  private previousPointers = new Map<number, PointerTrailPoint>();
  private ripples: FluidRipple[] = [];
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  private interactionMode: 'stir' | 'settle' = 'stir';
  private lastCellSize = 0;
  private lastFingerForce = 0;
  private lastFingerRadius = 0;
  private lastViscosity = 0;
  private lastCurl = 0;
  private lastEddyAssist = 0;
  private lastDyePersistence = 0;
  private lastPressureIterations = 0;
  private lastAmbient = false;
  private lastExposure = 0;
  private lastPaletteKey = '';
  private lastPaletteStrength = 0;
  private lastEdgeDarkening = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const parent = ctx.systems.pixi.canvas.parentElement;
    if (!parent) return;
    parent.style.position = parent.style.position || 'relative';
    this.rendererParent = parent;
    this.options = this.readOptions(ctx.seed);
    this.renderer = new GpuFluidTankRenderer(parent, this.options, ctx.quality);
    this.createOverlay(parent);
    this.cacheOptions(this.options);
    const style = ctx.systems.settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    this.renderer.resize(ctx.width, ctx.height, true);
    this.resizeOverlay(ctx.width, ctx.height);
    this.renderer.randomizeDye(this.options.seed);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.renderer?.destroy();
    this.overlayCanvas?.remove();
    this.renderer = null;
    this.rendererParent = null;
    this.overlayCanvas = null;
    this.overlayContext = null;
    this.options = null;
    this.previousPointers.clear();
    this.ripples = [];
  }

  override update(dt: number): void {
    if (!this.renderer || !this.options) return;
    this.pollSettings();
    this.applyPointerTrails();
    this.updateRipples(dt);
    const hasHumanPointers = this.input_.snapshot.pointers.size > 0;
    for (const gesture of this.consumeGestures()) {
      if (gesture.kind === 'tap') {
        if (this.interactionMode === 'settle') {
          this.renderer.settleVelocity();
        } else {
          this.renderer.smallSwirl(
            gesture.x / Math.max(1, this.ctx_.width),
            gesture.y / Math.max(1, this.ctx_.height),
          );
          this.addRipple(gesture.x, gesture.y, 5, 0.8);
        }
      } else if (
        !hasHumanPointers &&
        (gesture.kind === 'drag' || gesture.kind === 'fast_swipe') &&
        this.interactionMode === 'stir'
      ) {
        const stats = this.renderer.stats();
        const velocity = velocityFromScreenDelta(
          gesture.dx ?? 0,
          gesture.dy ?? 0,
          this.ctx_.width,
          this.ctx_.height,
          stats.simWidth,
          stats.simHeight,
        );
        this.renderer.splat({
          x: gesture.x / Math.max(1, this.ctx_.width),
          y: gesture.y / Math.max(1, this.ctx_.height),
          dx: velocity.dx,
          dy: velocity.dy,
        });
      }
    }
    this.renderer.update(dt);
    const stats = this.renderer.stats();
    this.stagnationReport = stats.supported
      ? { stagnant: false, severity: 0 }
      : { stagnant: true, reason: 'WebGL2 half-float fluid targets are unavailable.', severity: 1 };
  }

  override render(_alpha: number): void {
    this.renderer?.render();
    this.drawOverlay();
    const debug = this.ctx_.systems.debug;
    if (debug?.isEnabled()) {
      const stats = this.renderer?.stats();
      debug.update({
        fps: 0,
        quality: this.quality,
        particleCount: stats?.splats ?? 0,
        renderTargets: stats ? `${stats.simWidth}x${stats.simHeight} / ${stats.dyeWidth}x${stats.dyeHeight}` : 'fluid unavailable',
      });
    }
  }

  override resize(width: number, height: number): void {
    this.renderer?.resize(width, height);
    this.resizeOverlay(width, height);
  }

  override reset(): void {
    if (!this.renderer || !this.options) return;
    const seed = this.options.seed + 1;
    this.options = { ...this.options, seed };
    this.renderer.setOptions({ seed });
    this.renderer.randomizeDye(seed);
  }

  override clearEmitters(): void {
    this.renderer?.settleVelocity();
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.renderer?.setQuality(quality);
  }

  override setStyle(styleId: string): void {
    super.setStyle(styleId);
    this.applyStyleOptions();
  }

  override setMode(id: string): void {
    if (id === 'stir' || id === 'settle') this.interactionMode = id;
  }

  getRenderLayers(): SimRenderLayers {
    return {
      fluid: this.renderer?.canvas,
      glow: this.renderer?.canvas,
      debug: this.rendererParent,
    };
  }

  getStyleManifest(): SimStyleManifest {
    return fluidTankStyleManifest;
  }

  detectStagnation(): StagnationReport {
    return this.stagnationReport;
  }

  stabilize(): void {
    this.renderer?.settleVelocity();
    this.stagnationReport = { stagnant: false, severity: 0 };
  }

  softReset(seed?: number): void {
    if (seed !== undefined && this.renderer && this.options) {
      this.options = { ...this.options, seed };
      this.renderer.setOptions({ seed });
      this.renderer.randomizeDye(seed);
      return;
    }
    this.reset();
  }

  private applyPointerTrails(): void {
    if (!this.renderer) return;
    const snapshot = this.input_.snapshot;
    for (const pointer of snapshot.pointers.values()) {
      const previous = this.previousPointers.get(pointer.id);
      if (!previous) {
        this.previousPointers.set(pointer.id, { x: pointer.x, y: pointer.y, movedDistance: 0 });
        this.addRipple(pointer.x, pointer.y, 3, 0.36);
        continue;
      }
      const dx = pointer.x - previous.x;
      const dy = pointer.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) continue;
      previous.movedDistance += distance;
      const samples = Math.max(1, Math.min(8, Math.ceil(distance / 18)));
      const forceScale = 1 / Math.sqrt(samples);
      const stats = this.renderer.stats();
      const velocity = velocityFromScreenDelta(dx, dy, this.ctx_.width, this.ctx_.height, stats.simWidth, stats.simHeight);
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        this.renderer.splat({
          x: (previous.x + dx * t) / Math.max(1, this.ctx_.width),
          y: (previous.y + dy * t) / Math.max(1, this.ctx_.height),
          dx: velocity.dx * forceScale,
          dy: velocity.dy * forceScale,
        });
      }
      this.addRipple(pointer.x, pointer.y, 3, 0.48);
      previous.x = pointer.x;
      previous.y = pointer.y;
    }
    for (const id of snapshot.justUp) {
      const previous = this.previousPointers.get(id);
      if (previous && previous.movedDistance < 6 && this.interactionMode === 'stir') {
        this.renderer.smallSwirl(
          previous.x / Math.max(1, this.ctx_.width),
          previous.y / Math.max(1, this.ctx_.height),
        );
        this.addRipple(previous.x, previous.y, 5, 0.8);
      } else if (this.interactionMode === 'settle') {
        this.renderer.settleVelocity();
      }
      this.previousPointers.delete(id);
    }
  }

  private pollSettings(): void {
    if (!this.renderer || !this.options) return;
    const next = this.readOptions(this.options.seed);
    if (
      next.cellSize !== this.lastCellSize ||
      next.fingerForce !== this.lastFingerForce ||
      next.fingerRadius !== this.lastFingerRadius ||
      next.viscosity !== this.lastViscosity ||
      next.curl !== this.lastCurl ||
      next.eddyAssist !== this.lastEddyAssist ||
      next.dyePersistence !== this.lastDyePersistence ||
      next.pressureIterations !== this.lastPressureIterations ||
      next.ambient !== this.lastAmbient
    ) {
      this.options = next;
      this.cacheOptions(next);
      this.renderer.setOptions(next);
    }
    this.applyStyleOptions();
  }

  private readOptions(seed: number): GpuFluidTankOptions {
    const settings = this.ctx_.systems.settings;
    const cellSize = this.preview ? 1.55 : numberSetting(settings.get('cellSize'), FLUID_TANK_DEFAULTS.cellSize);
    return {
      cellSize,
      fingerForce: this.preview ? 7 : numberSetting(settings.get('fingerForce'), FLUID_TANK_DEFAULTS.fingerForce),
      fingerRadius: numberSetting(settings.get('fingerRadius'), FLUID_TANK_DEFAULTS.fingerRadius),
      viscosity: numberSetting(settings.get('viscosity'), FLUID_TANK_DEFAULTS.viscosity),
      curl: numberSetting(settings.get('curl'), FLUID_TANK_DEFAULTS.curl),
      eddyAssist: numberSetting(settings.get('eddyAssist'), FLUID_TANK_DEFAULTS.eddyAssist),
      dyePersistence: numberSetting(settings.get('dyePersistence'), FLUID_TANK_DEFAULTS.dyePersistence),
      pressureIterations: this.preview ? 20 : Math.round(numberSetting(settings.get('pressureIterations'), FLUID_TANK_DEFAULTS.pressureIterations)),
      ambient: this.preview || Boolean(settings.get('ambient') ?? FLUID_TANK_DEFAULTS.ambient),
      exposure: this.resolveExposure(this.ctx_.systems.styleManager?.getStyle() ?? undefined),
      palette: this.resolvePalette(this.ctx_.systems.styleManager?.getStyle() ?? undefined),
      paletteStrength: this.resolvePaletteStrength(this.ctx_.systems.styleManager?.getStyle() ?? undefined),
      edgeDarkening: this.resolveEdgeDarkening(this.ctx_.systems.styleManager?.getStyle() ?? undefined),
      seed,
    };
  }

  private applyStyleOptions(): void {
    if (!this.renderer || !this.options) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? undefined;
    const exposure = this.resolveExposure(style);
    const palette = this.resolvePalette(style);
    const paletteStrength = this.resolvePaletteStrength(style);
    const edgeDarkening = this.resolveEdgeDarkening(style);
    const paletteKey = palette.join(',');
    if (
      exposure === this.lastExposure &&
      paletteKey === this.lastPaletteKey &&
      paletteStrength === this.lastPaletteStrength &&
      edgeDarkening === this.lastEdgeDarkening
    ) {
      return;
    }
    this.lastExposure = exposure;
    this.lastPaletteKey = paletteKey;
    this.lastPaletteStrength = paletteStrength;
    this.lastEdgeDarkening = edgeDarkening;
    this.options = { ...this.options, exposure, palette, paletteStrength, edgeDarkening };
    this.renderer.setOptions({ exposure, palette, paletteStrength, edgeDarkening });
  }

  private resolveExposure(style: SimStyle | undefined): number {
    const value = style?.uniforms.exposure;
    return typeof value === 'number' ? value : 1.06;
  }

  private resolvePalette(style: SimStyle | undefined): readonly number[] {
    return style?.palette.length ? style.palette : boundedCyanStyle.palette;
  }

  private resolvePaletteStrength(style: SimStyle | undefined): number {
    const value = style?.uniforms.paletteStrength;
    return typeof value === 'number' ? value : 0.82;
  }

  private resolveEdgeDarkening(style: SimStyle | undefined): number {
    const value = style?.uniforms.edgeDarkening;
    return typeof value === 'number' ? value : 0.35;
  }

  private cacheOptions(options: GpuFluidTankOptions): void {
    this.lastCellSize = options.cellSize;
    this.lastFingerForce = options.fingerForce;
    this.lastFingerRadius = options.fingerRadius;
    this.lastViscosity = options.viscosity;
    this.lastCurl = options.curl;
    this.lastEddyAssist = options.eddyAssist;
    this.lastDyePersistence = options.dyePersistence;
    this.lastPressureIterations = options.pressureIterations;
    this.lastAmbient = options.ambient;
    this.lastExposure = options.exposure;
    this.lastPaletteKey = options.palette.join(',');
    this.lastPaletteStrength = options.paletteStrength;
    this.lastEdgeDarkening = options.edgeDarkening;
  }

  private createOverlay(parent: HTMLElement): void {
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.inset = '0';
    this.overlayCanvas.style.width = '100%';
    this.overlayCanvas.style.height = '100%';
    this.overlayCanvas.style.display = 'block';
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.zIndex = '3';
    parent.appendChild(this.overlayCanvas);
    this.overlayContext = this.overlayCanvas.getContext('2d');
  }

  private resizeOverlay(width: number, height: number): void {
    if (!this.overlayCanvas || !this.overlayContext) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlayCanvas.width = Math.max(2, Math.floor(width * dpr));
    this.overlayCanvas.height = Math.max(2, Math.floor(height * dpr));
    this.overlayContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private addRipple(x: number, y: number, radius: number, life: number): void {
    if (this.preview) return;
    this.ripples.push({ x, y, radius, life });
  }

  private updateRipples(dt: number): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      ripple.life -= dt * 2.3;
      ripple.radius += dt * 65;
      if (ripple.life <= 0) this.ripples.splice(i, 1);
    }
  }

  private drawOverlay(): void {
    if (!this.overlayCanvas || !this.overlayContext) return;
    const ctx = this.overlayContext;
    const width = this.ctx_.width;
    const height = this.ctx_.height;
    ctx.clearRect(0, 0, width, height);

    const pad = 7;
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.strokeStyle = 'rgba(188,236,255,0.11)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 5, pad + 5, width - (pad + 5) * 2, height - (pad + 5) * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(pad - 1, pad - 1, width - (pad - 1) * 2, height - (pad - 1) * 2);

    for (const ripple of this.ripples) {
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, ripple.life * 0.28)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

}

function numberSetting(value: unknown, fallback: unknown): number {
  return typeof value === 'number' ? value : Number(fallback);
}
