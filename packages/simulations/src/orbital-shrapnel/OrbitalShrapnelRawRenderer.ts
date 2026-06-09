import {
  BufferImageSource,
  Container,
  Graphics,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { RenderQuality, SimParticle, SimStyle, TrailField } from '@hooksjam/pixi-lab-core';
import { compositeOrbitalShrapnelRawTrailToRgba } from './OrbitalShrapnelRawCompositeMapper.js';
import { resolveOrbitalShrapnelRawTexturePlan } from './OrbitalShrapnelRawTexturePlan.js';

export interface OrbitalShrapnelRawRenderOptions {
  readonly trailField: TrailField;
  readonly particles: readonly SimParticle[];
  readonly style: SimStyle;
  readonly width: number;
  readonly height: number;
  readonly particleCount: number;
  readonly trailColumns: number;
  readonly rawParticleTextureSize?: number | string;
  readonly rawTrailTextureWidth?: number | string;
  readonly debrisSize?: number;
  readonly bloomStrength?: number;
  readonly streakStrength?: number;
}

interface OrbitalRawTextureLayer {
  readonly sprite: Sprite;
  readonly source: BufferImageSource;
  readonly texture: Texture;
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export class OrbitalShrapnelRawRenderer {
  readonly layer = new Container();
  private quality: RenderQuality = 'raw';
  private textureLayer: OrbitalRawTextureLayer | null = null;
  private readonly debrisLayer = new Graphics();
  private readonly glowLayer = new Graphics();

  constructor(private readonly app: Application, quality: RenderQuality = 'raw') {
    this.quality = quality;
    this.layer.sortableChildren = true;
    this.debrisLayer.zIndex = 2;
    this.glowLayer.zIndex = 1;
    this.debrisLayer.blendMode = 'add';
    this.glowLayer.blendMode = 'add';
    this.layer.addChild(this.glowLayer, this.debrisLayer);
    this.app.stage.addChild(this.layer);
  }

  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.destroyTextureLayer();
  }

  clear(): void {
    if (this.textureLayer) this.textureLayer.sprite.visible = false;
    this.debrisLayer.clear();
    this.glowLayer.clear();
  }

  render(options: OrbitalShrapnelRawRenderOptions): void {
    const plan = resolveOrbitalShrapnelRawTexturePlan({
      width: options.width,
      height: options.height,
      quality: this.quality,
      particleCount: options.particleCount,
      trailColumns: options.trailColumns,
      rawParticleTextureSize: options.rawParticleTextureSize,
      rawTrailTextureWidth: options.rawTrailTextureWidth,
    });
    const layer = this.ensureTextureLayer(plan.trailField.width, plan.trailField.height);
    compositeOrbitalShrapnelRawTrailToRgba(options.trailField, options.style, layer.pixels, {
      width: plan.trailField.width,
      height: plan.trailField.height,
    });
    layer.source.update();
    layer.sprite.width = options.width;
    layer.sprite.height = options.height;
    layer.sprite.visible = true;
    this.renderDebris(options);
  }

  destroy(): void {
    this.destroyTextureLayer();
    this.debrisLayer.destroy();
    this.glowLayer.destroy();
    this.layer.destroy({ children: true });
  }

  private renderDebris(options: OrbitalShrapnelRawRenderOptions): void {
    const palette = options.style.palette.length > 0 ? options.style.palette : [0x9ad7ff, 0xfff4bf];
    const particleColor = palette[1] ?? palette[0] ?? 0x9ad7ff;
    const accentColor = palette[palette.length - 1] ?? particleColor;
    const bloomStrength = clampNumber(options.bloomStrength ?? 1.25, 0, 2.5);
    const streakStrength = clampNumber(options.streakStrength ?? 0.75, 0, 1.5);
    const baseSize = clampNumber(options.debrisSize ?? 1.15, 0.25, 4.5);
    const sampleStride = Math.max(1, Math.ceil(options.particles.length / resolveDrawBudget(options.rawParticleTextureSize)));

    this.debrisLayer.clear();
    this.glowLayer.clear();

    for (let i = 0; i < options.particles.length; i += sampleStride) {
      const particle = options.particles[i];
      const x = particle.position.x;
      const y = particle.position.y;
      if (x < -8 || x > options.width + 8 || y < -8 || y > options.height + 8) continue;

      const speed = Math.hypot(particle.velocity.x, particle.velocity.y);
      const heat = Math.min(1, Math.max(0, (particle.alpha - 0.35) * 1.8));
      const radius = Math.max(0.45, baseSize * (particle.size ?? 1) * (1 + heat * 0.85));
      const alpha = clampNumber((0.22 + heat * 0.42) * bloomStrength, 0.08, 0.92);

      if (streakStrength > 0 && speed > 0.25) {
        const inv = 1 / Math.max(0.0001, speed);
        const sx = particle.velocity.x * inv * Math.min(24, speed * 4.8) * streakStrength;
        const sy = particle.velocity.y * inv * Math.min(24, speed * 4.8) * streakStrength;
        this.glowLayer
          .moveTo(x - sx * 0.45, y - sy * 0.45)
          .lineTo(x + sx, y + sy)
          .stroke({ color: heat > 0.45 ? accentColor : particleColor, alpha: alpha * 0.32, width: Math.max(0.55, radius * 0.72) });
      }

      this.glowLayer.circle(x, y, radius * (2.4 + bloomStrength)).fill({ color: particleColor, alpha: alpha * 0.08 });
      this.debrisLayer.circle(x, y, radius).fill({ color: heat > 0.55 ? accentColor : particleColor, alpha });
    }
  }

  private ensureTextureLayer(width: number, height: number): OrbitalRawTextureLayer {
    if (this.textureLayer?.width === width && this.textureLayer.height === height) return this.textureLayer;
    this.destroyTextureLayer();

    const pixels = new Uint8Array(width * height * 4);
    const source = new BufferImageSource({
      resource: pixels,
      width,
      height,
      scaleMode: 'linear',
    });
    const texture = new Texture({ source });
    const sprite = new Sprite(texture);
    sprite.zIndex = 0;
    sprite.visible = false;
    sprite.blendMode = 'add';
    this.layer.addChild(sprite);

    this.textureLayer = { sprite, source, texture, pixels, width, height };
    return this.textureLayer;
  }

  private destroyTextureLayer(): void {
    if (!this.textureLayer) return;
    this.textureLayer.sprite.texture = Texture.EMPTY;
    this.textureLayer.texture.destroy(true);
    this.textureLayer.sprite.removeFromParent();
    this.textureLayer.sprite.destroy();
    this.textureLayer = null;
  }
}

function resolveDrawBudget(rawParticleTextureSize: number | string | undefined): number {
  const edge = typeof rawParticleTextureSize === 'string' ? Number.parseInt(rawParticleTextureSize, 10) : rawParticleTextureSize;
  if (!edge || !Number.isFinite(edge)) return 96_000;
  return Math.max(16_000, Math.min(180_000, Math.round(edge * edge * 0.7)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
