import {
  Graphics,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyle,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import {
  GpuFluidTankRenderer,
  velocityFromScreenDelta,
  type FluidSplat,
  type GpuFluidTankOptions,
  type GpuFluidTankStats,
} from './GpuFluidTankRenderer.js';
import { PixiFeedbackFluidRenderer } from './PixiFeedbackFluidRenderer.js';
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

interface FluidRendererAdapter {
  readonly canvas?: unknown;
  readonly layer?: unknown;
  destroy(): void;
  resize(width: number, height: number, force?: boolean): void;
  randomizeDye(seed?: number, seedMotion?: boolean): void;
  setQuality(quality: RenderQuality): void;
  setOptions(options: Partial<GpuFluidTankOptions>): void;
  smallSwirl(x: number, y: number): void;
  settleVelocity(): void;
  splat(splat: FluidSplat): void;
  update(dt: number): void;
  render(): void;
  stats(): GpuFluidTankStats;
}

export const fluidTankStyleManifest: SimStyleManifest = {
  defaultStyleId: 'bounded-cyan',
  capabilities: {
    renderLayers: ['fluid'],
    passes: ['gpuFluid'],
    qualities: ['basic', 'enhanced', 'raw'],
  },
  styles: [boundedCyanStyle, nebulaOilStyle, thermalBloomStyle],
};

export class FluidTankScene extends SimulationScene {
  readonly name = 'FluidTank';
  private renderer: FluidRendererAdapter | null = null;
  private wallLayer: Graphics | null = null;
  private rippleLayer: Graphics | null = null;
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
  private debugStill = false;
  private debugNoSeedMotion = false;
  private debugMinimal = false;

  constructor(private readonly preview = false) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const parent = ctx.systems.pixi.canvas.parentElement;
    if (!parent) return;
    parent.style.position = parent.style.position || 'relative';
    ctx.systems.pixi.canvas.style.zIndex = '2';
    ctx.systems.pixi.canvas.dataset.pixiLabFluidRendererHost = 'pixi-shared';
    const fluidDebugParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
    this.debugStill = Boolean(fluidDebugParams?.has('fluidStill'));
    this.debugNoSeedMotion = Boolean(fluidDebugParams?.has('fluidNoSeedMotion'));
    this.debugMinimal = Boolean(fluidDebugParams?.has('fluidMinimal'));
    const fluidSeed = this.debugMinimal ? Math.random() * 1000 : ctx.seed;
    this.options = this.readOptions(fluidSeed);
    const displayMode = fluidDebugParams?.get('fluidDisplay');
    if (isFluidDisplayMode(displayMode)) {
      this.options = { ...this.options, displayMode };
    }
    if (fluidDebugParams?.has('fluidMinimal')) {
      this.options = {
        ...this.options,
        cellSize: 1.2,
        fingerForce: 8,
        fingerRadius: 0.026,
        viscosity: 0.22,
        curl: 6,
        eddyAssist: 0,
        dyePersistence: 0.9996,
        pressureIterations: 24,
        ambient: false,
        exposure: 1.06,
      };
    }
    this.renderer = this.createRenderer(parent, ctx.quality);
    this.wallLayer = new Graphics();
    this.rippleLayer = new Graphics();
    this.wallLayer.zIndex = 1;
    this.rippleLayer.zIndex = 2;
    ctx.systems.pixi.stage.sortableChildren = true;
    ctx.systems.pixi.stage.addChild(this.wallLayer);
    ctx.systems.pixi.stage.addChild(this.rippleLayer);
    this.cacheOptions(this.options);
    const style = ctx.systems.settings.get('style') as string | undefined;
    if (style && !this.debugMinimal) this.setStyle(style);
    this.renderer.resize(ctx.width, ctx.height, true);
    this.renderer.randomizeDye(this.options.seed, !(this.debugStill || this.debugNoSeedMotion));
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.renderer?.destroy();
    this.wallLayer?.destroy();
    this.rippleLayer?.destroy();
    this.renderer = null;
    this.wallLayer = null;
    this.rippleLayer = null;
    this.options = null;
    this.previousPointers.clear();
    this.ripples = [];
  }

  override update(dt: number): void {
    if (!this.renderer || !this.options) return;
    if (this.debugStill) return;
    if (!this.debugMinimal) this.pollSettings();
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
        const velocity = fluidSplatDeltaForQuality(
          this.quality,
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
    this.drawTankFrame();
    this.drawRipples();
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
    this.drawTankFrame(width, height);
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
    const switchingRenderer = this.renderer !== null && this.usesRawRenderer(quality) !== this.usesRawRenderer(this.quality);
    super.setQuality(quality);
    if (switchingRenderer && this.options) {
      const parent = this.ctx_.systems.pixi.canvas.parentElement;
      if (parent) {
        this.renderer?.destroy();
        this.renderer = this.createRenderer(parent, quality);
        this.renderer.resize(this.ctx_.width, this.ctx_.height, true);
        this.renderer.randomizeDye(this.options.seed, !(this.debugStill || this.debugNoSeedMotion));
        this.applyStyleOptions();
        return;
      }
    }
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
      fluid: this.renderer?.layer ?? this.renderer?.canvas,
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

  private createRenderer(parent: HTMLElement, quality: RenderQuality): FluidRendererAdapter {
    if (!this.options) throw new Error('Fluid Tank renderer options must be initialized before renderer creation.');
    if (this.usesRawRenderer(quality)) {
      return new GpuFluidTankRenderer(parent, this.options, quality);
    }
    return new PixiFeedbackFluidRenderer(this.ctx_.systems.pixi.app, this.options, quality);
  }

  private usesRawRenderer(quality: RenderQuality): boolean {
    return quality === 'raw';
  }

  private applyPointerTrails(): void {
    if (!this.renderer) return;
    const snapshot = this.input_.snapshot;
    for (const pointer of Array.from(snapshot.pointers.values())) {
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
      const velocity = fluidSplatDeltaForQuality(this.quality, dx, dy, this.ctx_.width, this.ctx_.height, stats.simWidth, stats.simHeight);
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
    for (const id of Array.from(snapshot.justUp)) {
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

  private drawTankFrame(width = this.ctx_.width, height = this.ctx_.height): void {
    if (!this.wallLayer) return;
    const pad = 7;
    this.wallLayer.clear();
    this.wallLayer
      .rect(pad, pad, width - pad * 2, height - pad * 2)
      .stroke({ color: 0xffffff, alpha: 0.24, width: 2 });
    this.wallLayer
      .rect(pad + 5, pad + 5, width - (pad + 5) * 2, height - (pad + 5) * 2)
      .stroke({ color: 0xbcecff, alpha: 0.11, width: 1 });
    this.wallLayer
      .rect(pad - 1, pad - 1, width - (pad - 1) * 2, height - (pad - 1) * 2)
      .stroke({ color: 0x000000, alpha: 0.28, width: 4 });
  }

  private drawRipples(): void {
    if (!this.rippleLayer) return;
    this.rippleLayer.clear();
    for (const ripple of this.ripples) {
      this.rippleLayer
        .circle(ripple.x, ripple.y, ripple.radius)
        .stroke({ color: 0xffffff, alpha: Math.max(0, ripple.life * 0.28), width: 2 });
    }
  }

}

function isFluidDisplayMode(value: string | null | undefined): value is NonNullable<GpuFluidTankOptions['displayMode']> {
  return value === 'dye' || value === 'velocity' || value === 'curl' || value === 'divergence' || value === 'pressure';
}

function numberSetting(value: unknown, fallback: unknown): number {
  return typeof value === 'number' ? value : Number(fallback);
}

export function fluidSplatDeltaForQuality(
  quality: RenderQuality,
  dx: number,
  dy: number,
  width: number,
  height: number,
  simWidth: number,
  simHeight: number,
): { dx: number; dy: number } {
  if (quality === 'raw') {
    return velocityFromScreenDelta(dx, dy, width, height, simWidth, simHeight);
  }

  return {
    dx: (dx / Math.max(1, width)) * simWidth,
    dy: (dy / Math.max(1, height)) * simHeight,
  };
}
