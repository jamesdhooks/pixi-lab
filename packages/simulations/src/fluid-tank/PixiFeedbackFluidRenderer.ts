import {
  BlurFilter,
  Container,
  DisplacementFilter,
  Graphics,
  RenderTexture,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import { SeededRng, type RenderQuality } from '@hooksjam/pixi-lab-core';
import type { FluidSplat, GpuFluidTankOptions, GpuFluidTankStats } from './GpuFluidTankRenderer.js';

interface FeedbackStamp {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  alpha: number;
  color?: number;
}

const BASE_RESOLUTION: Record<RenderQuality, number> = {
  basic: 0.48,
  enhanced: 0.62,
  raw: 0.62,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hsvToRgb(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = v;
  let g = t;
  let b = p;
  switch (i % 6) {
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return ((r * 255) << 16) | ((g * 255) << 8) | (b * 255);
}

export class PixiFeedbackFluidRenderer {
  readonly layer = new Container();
  private rng: SeededRng;
  private quality: RenderQuality;
  private options: GpuFluidTankOptions;
  private elapsed = 0;
  private width = 0;
  private height = 0;
  private simWidth = 0;
  private simHeight = 0;
  private splatCount = 0;
  private hue = 0;
  private rtA: RenderTexture | null = null;
  private rtB: RenderTexture | null = null;
  private flowRT: RenderTexture | null = null;
  private readonly glowSprite = new Sprite();
  private readonly displaySprite = new Sprite();
  private readonly feedbackContainer = new Container();
  private readonly prevSprite = new Sprite();
  private readonly paintLayer = new Container();
  private readonly flowContainer = new Container();
  private readonly flowBase = new Graphics();
  private readonly flowLayer = new Container();
  private readonly ambientNoiseA: Sprite;
  private readonly ambientNoiseB: Sprite;
  private readonly flowSprite = new Sprite();
  private readonly softTexture: Texture;
  private readonly noiseTexture: Texture;
  private readonly displacementFilter: DisplacementFilter;
  private readonly blurFilter: BlurFilter;
  private readonly glowFilter: BlurFilter;

  constructor(private readonly app: Application, options: GpuFluidTankOptions, quality: RenderQuality = 'basic') {
    this.options = { ...options };
    this.quality = quality === 'raw' ? 'enhanced' : quality;
    this.rng = new SeededRng(options.seed);
    this.hue = this.rng.next();
    this.softTexture = this.makeSoftCircleTexture(160);
    this.noiseTexture = this.makeVectorNoiseTexture(384);
    this.ambientNoiseA = new Sprite(this.noiseTexture);
    this.ambientNoiseB = new Sprite(this.noiseTexture);
    this.glowFilter = new BlurFilter({ strength: 18, quality: 4 });
    this.blurFilter = new BlurFilter({ strength: 2.2, quality: 3 });
    this.blurFilter.repeatEdgePixels = true;
    this.displacementFilter = new DisplacementFilter({ sprite: this.flowSprite, scale: { x: 0, y: 0 } });

    this.glowSprite.filters = [this.glowFilter];
    this.glowSprite.blendMode = 'add';
    this.prevSprite.filters = [this.displacementFilter, this.blurFilter];
    this.feedbackContainer.addChild(this.prevSprite);
    this.feedbackContainer.addChild(this.paintLayer);
    this.flowContainer.addChild(this.flowBase, this.ambientNoiseA, this.ambientNoiseB, this.flowLayer);
    this.layer.addChild(this.glowSprite, this.displaySprite);
    this.app.stage.addChild(this.layer);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality === 'raw' ? 'enhanced' : quality;
    this.resize(this.width, this.height, true);
  }

  setOptions(options: Partial<GpuFluidTankOptions>): void {
    const previousCellSize = this.options.cellSize;
    const previousSeed = this.options.seed;
    this.options = { ...this.options, ...options };
    if (options.seed !== undefined) this.hue = new SeededRng(options.seed).next();
    if (options.cellSize !== undefined && options.cellSize !== previousCellSize) {
      this.resize(this.width, this.height, true);
    } else if (options.seed !== undefined && options.seed !== previousSeed) {
      this.randomizeDye(this.options.seed);
    }
  }

  resize(width: number, height: number, force = false): void {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    const resolution = this.resolveResolution();
    const nextSimWidth = Math.max(64, Math.round(safeWidth * resolution));
    const nextSimHeight = Math.max(64, Math.round(safeHeight * resolution));
    if (!force && safeWidth === this.width && safeHeight === this.height && nextSimWidth === this.simWidth && nextSimHeight === this.simHeight) return;

    this.width = safeWidth;
    this.height = safeHeight;
    this.simWidth = nextSimWidth;
    this.simHeight = nextSimHeight;
    this.rtA?.destroy(true);
    this.rtB?.destroy(true);
    this.flowRT?.destroy(true);
    this.rtA = this.createRenderTexture(this.simWidth, this.simHeight);
    this.rtB = this.createRenderTexture(this.simWidth, this.simHeight);
    this.flowRT = this.createRenderTexture(this.simWidth, this.simHeight);
    this.displaySprite.texture = this.rtA;
    this.glowSprite.texture = this.rtA;
    this.flowSprite.texture = this.flowRT;
    this.updateDisplaySprites();
    this.updateFlowBase();
    this.randomizeDye(this.options.seed);
  }

  randomizeDye(seed = this.options.seed + 1, _seedMotion = true): void {
    if (!this.rtA || !this.rtB) return;
    this.rng = new SeededRng(seed);
    this.hue = this.rng.next();
    this.clearTransientLayers();
    const seedContainer = new Container();
    const background = new Graphics();
    background.rect(0, 0, this.simWidth, this.simHeight).fill({ color: 0x080914, alpha: 1 });
    seedContainer.addChild(background);
    for (let i = 0; i < 76; i++) {
      seedContainer.addChild(this.makeStamp({
        x: this.rand(-0.08, 1.08) * this.simWidth,
        y: this.rand(-0.08, 1.08) * this.simHeight,
        dx: this.rand(-1, 1),
        dy: this.rand(-1, 1),
        radius: this.rand(45, 170) * this.resolveResolution(),
        alpha: this.rand(0.1, 0.3),
        color: this.nextColor(),
      }, i < 10 ? 'normal' : 'add', this.rand(0.75, 1.7)));
    }
    for (let i = 0; i < 96; i++) {
      seedContainer.addChild(this.makeStamp({
        x: this.rng.next() * this.simWidth,
        y: this.rng.next() * this.simHeight,
        dx: this.rand(-1, 1),
        dy: this.rand(-1, 1),
        radius: this.rand(12, 44) * this.resolveResolution(),
        alpha: this.rand(0.08, 0.2),
        color: this.nextColor(),
      }, 'add', this.rand(0.8, 1.4)));
    }
    this.renderTo(this.rtA, seedContainer, true);
    this.renderTo(this.rtB, seedContainer, true);
    seedContainer.destroy({ children: true });
  }

  settleVelocity(): void {
    this.clearTransientLayers();
  }

  smallSwirl(x: number, y: number): void {
    const radius = this.resolveFingerRadius();
    for (let i = 0; i < 8; i++) {
      const angle = this.rand(0, Math.PI * 2);
      const distance = this.rand(0.2, 1);
      const dx = Math.cos(angle) * radius * 1.35 * distance;
      const dy = Math.sin(angle) * radius * 1.35 * distance;
      const sx = x * this.simWidth + Math.cos(angle) * radius * this.rand(0, 0.25);
      const sy = y * this.simHeight + Math.sin(angle) * radius * this.rand(0, 0.25);
      this.addFlowStamp(sx, sy, dx, dy, radius * this.rand(0.65, 1.25), 0.58);
      this.addDyeStamp(sx, sy, dx, dy, radius * this.rand(0.55, 1.1), 0.075, this.nextColor());
    }
  }

  splat(splat: FluidSplat): void {
    const x = splat.x * this.simWidth;
    const y = splat.y * this.simHeight;
    const dx = splat.dx * this.simWidth * 0.018;
    const dy = splat.dy * this.simHeight * 0.018;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.1) return;
    const baseRadius = this.resolveFingerRadius() * (splat.radiusScale ?? 1);
    const steps = Math.max(2, Math.ceil(distance / Math.max(baseRadius * 0.38, 4)));
    for (let i = 0; i < steps; i++) {
      const k = i / Math.max(steps - 1, 1);
      const sx = x + dx * k;
      const sy = y + dy * k;
      const wobble = Math.sin(this.elapsed * 8 + i * 1.7) * baseRadius * 0.08;
      this.addFlowStamp(sx + wobble, sy - wobble, dx, dy, baseRadius * this.rand(0.82, 1.18), 0.82);
      this.addDyeStamp(sx, sy, dx, dy, baseRadius * this.rand(0.5, 0.95), 0.032 + this.resolveForce() * 0.018);
    }
  }

  update(dt: number): void {
    this.elapsed += Math.min(dt, 0.033);
    this.addAmbient();
  }

  render(): void {
    if (!this.rtA || !this.rtB || !this.flowRT) return;
    this.updateFlowMap();
    this.blurFilter.strength = clamp((1 - this.options.dyePersistence) * 480, 1.1, this.quality === 'enhanced' ? 4.8 : 3.4);
    this.blurFilter.quality = this.blurFilter.strength > 4 ? 4 : 3;
    const warp = this.resolveWarp();
    const force = this.resolveForce();
    this.displacementFilter.scale.set(10 + warp * 42 + force * 30, 10 + warp * 42 + force * 30);
    this.prevSprite.texture = this.rtA;
    this.prevSprite.alpha = clamp(this.options.dyePersistence, 0.94, 0.999);
    this.prevSprite.x = -this.simWidth * 0.004;
    this.prevSprite.y = -this.simHeight * 0.004;
    this.prevSprite.width = this.simWidth * 1.008;
    this.prevSprite.height = this.simHeight * 1.008;
    this.renderTo(this.rtB, this.feedbackContainer, true);
    const temp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = temp;
    this.displaySprite.texture = this.rtA;
    this.glowSprite.texture = this.rtA;
    this.glowSprite.alpha = clamp((this.options.exposure - 0.86) * 0.8, 0.18, this.quality === 'enhanced' ? 0.52 : 0.36);
    this.glowFilter.strength = 9 + this.glowSprite.alpha * 30;
    this.clearTransientLayers();
  }

  stats(): GpuFluidTankStats {
    return {
      supported: true,
      simWidth: this.simWidth,
      simHeight: this.simHeight,
      dyeWidth: this.simWidth,
      dyeHeight: this.simHeight,
      splats: this.splatCount,
    };
  }

  destroy(): void {
    this.clearTransientLayers();
    this.layer.removeFromParent();
    this.rtA?.destroy(true);
    this.rtB?.destroy(true);
    this.flowRT?.destroy(true);
    this.softTexture.destroy(true);
    this.noiseTexture.destroy(true);
    this.layer.destroy({ children: true });
  }

  private createRenderTexture(width: number, height: number): RenderTexture {
    return RenderTexture.create({ width, height, resolution: 1, antialias: false });
  }

  private renderTo(texture: RenderTexture, container: Container, clear: boolean): void {
    this.app.renderer.render({ container, target: texture, clear });
  }

  private updateDisplaySprites(): void {
    this.displaySprite.position.set(0, 0);
    this.displaySprite.width = this.width;
    this.displaySprite.height = this.height;
    this.glowSprite.position.set(-this.width * 0.02, -this.height * 0.02);
    this.glowSprite.width = this.width * 1.04;
    this.glowSprite.height = this.height * 1.04;
  }

  private updateFlowBase(): void {
    this.flowBase.clear();
    this.flowBase.rect(0, 0, this.simWidth, this.simHeight).fill({ color: 0x808080, alpha: 1 });
    this.ambientNoiseA.position.set(-this.simWidth * 0.15, -this.simHeight * 0.15);
    this.ambientNoiseA.width = this.simWidth * 1.3;
    this.ambientNoiseA.height = this.simHeight * 1.3;
    this.ambientNoiseB.position.set(-this.simWidth * 0.1, -this.simHeight * 0.1);
    this.ambientNoiseB.width = this.simWidth * 1.2;
    this.ambientNoiseB.height = this.simHeight * 1.2;
  }

  private updateFlowMap(): void {
    if (!this.flowRT) return;
    const warp = this.resolveWarp();
    this.ambientNoiseA.rotation = this.elapsed * 0.035;
    this.ambientNoiseA.x = -this.simWidth * 0.15 + Math.sin(this.elapsed * 0.11) * this.simWidth * 0.05;
    this.ambientNoiseA.y = -this.simHeight * 0.15 + Math.cos(this.elapsed * 0.1) * this.simHeight * 0.05;
    this.ambientNoiseA.alpha = 0.055 + warp * 0.1;
    this.ambientNoiseB.rotation = -this.elapsed * 0.047;
    this.ambientNoiseB.x = -this.simWidth * 0.1 + Math.cos(this.elapsed * 0.09) * this.simWidth * 0.04;
    this.ambientNoiseB.y = -this.simHeight * 0.1 + Math.sin(this.elapsed * 0.13) * this.simHeight * 0.04;
    this.ambientNoiseB.alpha = 0.035 + warp * 0.075;
    this.renderTo(this.flowRT, this.flowContainer, true);
  }

  private addAmbient(): void {
    if (!this.options.ambient) return;
    const warp = this.resolveWarp();
    if (warp <= 0.001) return;
    const radius = this.resolveFingerRadius();
    for (let i = 0; i < 2; i++) {
      const phase = i * Math.PI;
      const x = this.simWidth * (0.5 + Math.sin(this.elapsed * 0.21 + phase) * 0.36);
      const y = this.simHeight * (0.5 + Math.cos(this.elapsed * 0.17 + phase * 1.3) * 0.34);
      const dx = Math.cos(this.elapsed * 1.1 + phase) * radius * 0.22;
      const dy = Math.sin(this.elapsed * 0.93 + phase) * radius * 0.22;
      if (this.rng.next() < 0.18 * warp) this.addFlowStamp(x, y, dx, dy, radius * this.rand(0.75, 1.2), 0.25 * warp);
    }
  }

  private addFlowStamp(x: number, y: number, dx: number, dy: number, radius: number, alpha: number): void {
    const force = this.resolveForce();
    const length = Math.hypot(dx, dy) || 1;
    const red = Math.round(clamp(128 + (dx / length) * 112 * force, 0, 255));
    const green = Math.round(clamp(128 + (dy / length) * 112 * force, 0, 255));
    const color = (red << 16) | (green << 8) | 128;
    this.flowLayer.addChild(this.makeStamp({ x, y, dx, dy, radius, alpha, color }, 'normal', 1 + clamp(length / 28, 0, 2.8)));
  }

  private addDyeStamp(x: number, y: number, dx: number, dy: number, radius: number, alpha: number, color = this.nextColor()): void {
    const length = Math.hypot(dx, dy) || 1;
    this.paintLayer.addChild(this.makeStamp({ x, y, dx, dy, radius: radius * 0.82, alpha, color }, 'add', 1 + clamp(length / 40, 0, 2.2)));
    this.splatCount += 1;
  }

  private makeStamp(stamp: FeedbackStamp, blendMode: 'add' | 'normal', stretch = 1): Sprite {
    const sprite = new Sprite(this.softTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(stamp.x, stamp.y);
    sprite.scale.set((stamp.radius * 2 * stretch) / this.softTexture.width, (stamp.radius * 2) / this.softTexture.height);
    sprite.rotation = Math.atan2(stamp.dy, stamp.dx);
    sprite.tint = stamp.color ?? this.nextColor();
    sprite.alpha = stamp.alpha;
    sprite.blendMode = blendMode;
    return sprite;
  }

  private clearTransientLayers(): void {
    for (const child of this.flowLayer.removeChildren()) child.destroy();
    for (const child of this.paintLayer.removeChildren()) child.destroy();
  }

  private makeSoftCircleTexture(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Texture.WHITE;
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.88)');
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(0.72, 'rgba(255,255,255,0.11)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
  }

  private makeVectorNoiseTexture(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Texture.WHITE;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        const a = Math.sin(x * 0.071 + y * 0.029) + Math.sin(x * 0.017 - y * 0.083);
        const b = Math.cos(x * 0.037 - y * 0.061) + Math.sin(x * 0.091 + y * 0.013);
        image.data[index] = clamp(128 + a * 23 + this.rand(-9, 9), 0, 255);
        image.data[index + 1] = clamp(128 + b * 23 + this.rand(-9, 9), 0, 255);
        image.data[index + 2] = 128;
        image.data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return Texture.from(canvas);
  }

  private nextColor(): number {
    this.hue = (this.hue + 0.61803398875) % 1;
    if (this.options.palette.length === 0 || this.rng.next() > this.options.paletteStrength) {
      return hsvToRgb(this.hue, 0.82, 1);
    }
    return this.options.palette[Math.floor(this.rng.next() * this.options.palette.length)] ?? hsvToRgb(this.hue, 0.82, 1);
  }

  private rand(min: number, max: number): number {
    return min + this.rng.next() * (max - min);
  }

  private resolveResolution(): number {
    const qualityBase = BASE_RESOLUTION[this.quality];
    return clamp(qualityBase / Math.sqrt(Math.max(0.5, this.options.cellSize)), 0.28, this.quality === 'enhanced' ? 0.82 : 0.62);
  }

  private resolveForce(): number {
    return clamp(this.options.fingerForce / 20, 0.05, 1.2);
  }

  private resolveFingerRadius(): number {
    return clamp(this.options.fingerRadius * Math.max(this.simWidth, this.simHeight), 8, 92) * this.resolveResolution();
  }

  private resolveWarp(): number {
    return clamp((this.options.curl + this.options.eddyAssist * 12) / 42, 0, 1);
  }
}
