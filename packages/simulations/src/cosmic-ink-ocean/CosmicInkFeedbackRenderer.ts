import {
  BlurFilter,
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { RenderQuality, SimParticle, SimStyle } from '@hooksjam/pixi-lab-core';

export interface CosmicInkFeedbackStamp {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  alpha: number;
  color: number;
}

interface CosmicInkFeedbackStampOptions {
  width: number;
  height: number;
  quality: RenderQuality;
  palette: readonly number[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildCosmicInkFeedbackStamps(
  particles: readonly SimParticle[],
  options: CosmicInkFeedbackStampOptions,
): CosmicInkFeedbackStamp[] {
  if (particles.length === 0 || options.width <= 0 || options.height <= 0) return [];
  const step = options.quality === 'enhanced' ? 1 : 2;
  const stamps: CosmicInkFeedbackStamp[] = [];
  for (let i = 0; i < particles.length; i += step) {
    const particle = particles[i];
    const speed = Math.hypot(particle.velocity.x, particle.velocity.y);
    stamps.push({
      x: clamp(particle.position.x, 0, options.width),
      y: clamp(particle.position.y, 0, options.height),
      dx: particle.velocity.x,
      dy: particle.velocity.y,
      radius: clamp(particle.size * (2.2 + speed * 0.018), 4, 42),
      alpha: clamp(particle.alpha * 0.5 + speed * 0.0018, 0.08, options.quality === 'enhanced' ? 0.44 : 0.34),
      color: options.palette.length > 0 ? options.palette[stamps.length % options.palette.length] : particle.color,
    });
  }
  return stamps;
}

export class CosmicInkFeedbackRenderer {
  readonly layer = new Container();
  private quality: RenderQuality;
  private width = 0;
  private height = 0;
  private feedbackWidth = 0;
  private feedbackHeight = 0;
  private rtA: RenderTexture | null = null;
  private rtB: RenderTexture | null = null;
  private readonly displaySprite = new Sprite();
  private readonly glowSprite = new Sprite();
  private readonly previousSprite = new Sprite();
  private readonly paintLayer = new Container();
  private readonly feedbackContainer = new Container();
  private readonly softTexture: Texture;
  private readonly ownsSoftTexture: boolean;
  private readonly blurFilter = new BlurFilter({ strength: 2.4, quality: 3 });
  private readonly glowFilter = new BlurFilter({ strength: 16, quality: 4 });

  constructor(private readonly app: Application, quality: RenderQuality = 'basic') {
    this.quality = quality === 'raw' ? 'enhanced' : quality;
    const softCircle = this.makeSoftCircleTexture(128);
    this.softTexture = softCircle.texture;
    this.ownsSoftTexture = softCircle.owned;
    this.blurFilter.repeatEdgePixels = true;
    this.previousSprite.filters = [this.blurFilter];
    this.glowSprite.filters = [this.glowFilter];
    this.glowSprite.blendMode = 'add';
    this.feedbackContainer.addChild(this.previousSprite, this.paintLayer);
    this.layer.addChild(this.glowSprite, this.displaySprite);
    this.app.stage.addChild(this.layer);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality === 'raw' ? 'enhanced' : quality;
    this.resize(this.width, this.height, true);
  }

  resize(width: number, height: number, force = false): void {
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    const scale = this.quality === 'enhanced' ? 0.72 : 0.54;
    const nextFeedbackWidth = Math.max(64, Math.round(nextWidth * scale));
    const nextFeedbackHeight = Math.max(64, Math.round(nextHeight * scale));
    if (
      !force &&
      nextWidth === this.width &&
      nextHeight === this.height &&
      nextFeedbackWidth === this.feedbackWidth &&
      nextFeedbackHeight === this.feedbackHeight
    ) {
      return;
    }

    this.width = nextWidth;
    this.height = nextHeight;
    this.feedbackWidth = nextFeedbackWidth;
    this.feedbackHeight = nextFeedbackHeight;
    this.rtA?.destroy(true);
    this.rtB?.destroy(true);
    this.rtA = RenderTexture.create({ width: this.feedbackWidth, height: this.feedbackHeight, resolution: 1, antialias: false });
    this.rtB = RenderTexture.create({ width: this.feedbackWidth, height: this.feedbackHeight, resolution: 1, antialias: false });
    this.displaySprite.texture = this.rtA;
    this.glowSprite.texture = this.rtA;
    this.displaySprite.position.set(0, 0);
    this.displaySprite.width = this.width;
    this.displaySprite.height = this.height;
    this.glowSprite.position.set(-this.width * 0.025, -this.height * 0.025);
    this.glowSprite.width = this.width * 1.05;
    this.glowSprite.height = this.height * 1.05;
    this.clearTargets();
  }

  renderParticles(particles: readonly SimParticle[], style: SimStyle, width: number, height: number): void {
    this.resize(width, height);
    if (!this.rtA || !this.rtB) return;
    const stamps = buildCosmicInkFeedbackStamps(particles, {
      width,
      height,
      quality: this.quality,
      palette: style.palette,
    });
    const sx = this.feedbackWidth / Math.max(1, width);
    const sy = this.feedbackHeight / Math.max(1, height);
    for (const stamp of stamps) {
      this.paintLayer.addChild(this.makeStamp({
        ...stamp,
        x: stamp.x * sx,
        y: stamp.y * sy,
        dx: stamp.dx * sx,
        dy: stamp.dy * sy,
        radius: stamp.radius * Math.max(sx, sy),
      }));
    }
    this.previousSprite.texture = this.rtA;
    this.previousSprite.alpha = this.quality === 'enhanced' ? 0.978 : 0.962;
    this.previousSprite.x = -this.feedbackWidth * 0.003;
    this.previousSprite.y = -this.feedbackHeight * 0.003;
    this.previousSprite.width = this.feedbackWidth * 1.006;
    this.previousSprite.height = this.feedbackHeight * 1.006;
    this.blurFilter.strength = this.quality === 'enhanced' ? 2.8 : 2.1;
    this.renderTo(this.rtB, this.feedbackContainer, true);
    const temp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = temp;
    this.displaySprite.texture = this.rtA;
    this.glowSprite.texture = this.rtA;
    this.glowSprite.alpha = this.quality === 'enhanced' ? 0.38 : 0.25;
    this.glowFilter.strength = this.quality === 'enhanced' ? 22 : 15;
    this.clearPaintLayer();
  }

  destroy(): void {
    this.clearPaintLayer();
    this.layer.removeFromParent();
    this.rtA?.destroy(true);
    this.rtB?.destroy(true);
    if (this.ownsSoftTexture) this.softTexture.destroy(true);
    this.layer.destroy({ children: true });
  }

  private clearTargets(): void {
    if (!this.rtA || !this.rtB) return;
    const clear = new Graphics();
    clear.rect(0, 0, this.feedbackWidth, this.feedbackHeight).fill({ color: 0x03040a, alpha: 1 });
    this.renderTo(this.rtA, clear, true);
    this.renderTo(this.rtB, clear, true);
    clear.destroy();
  }

  private renderTo(texture: RenderTexture, container: Container, clear: boolean): void {
    this.app.renderer.render({ container, target: texture, clear });
  }

  private makeStamp(stamp: CosmicInkFeedbackStamp): Sprite {
    const sprite = new Sprite(this.softTexture);
    const speed = Math.hypot(stamp.dx, stamp.dy);
    sprite.anchor.set(0.5);
    sprite.position.set(stamp.x, stamp.y);
    sprite.scale.set((stamp.radius * 2 * (1 + clamp(speed / 260, 0, 1.7))) / this.softTexture.width, (stamp.radius * 2) / this.softTexture.height);
    sprite.rotation = Math.atan2(stamp.dy, stamp.dx);
    sprite.tint = stamp.color;
    sprite.alpha = stamp.alpha;
    sprite.blendMode = 'add';
    return sprite;
  }

  private clearPaintLayer(): void {
    const children = this.paintLayer.removeChildren();
    for (const child of children) child.destroy();
  }

  private makeSoftCircleTexture(size: number): { texture: Texture; owned: boolean } {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { texture: Texture.WHITE, owned: false };
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.24, 'rgba(255,255,255,0.78)');
    gradient.addColorStop(0.58, 'rgba(255,255,255,0.22)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return { texture: Texture.from(canvas), owned: true };
  }
}
