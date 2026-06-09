import {
  BufferImageSource,
  Container,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { RenderQuality, SimStyle, TrailField } from '@hooksjam/pixi-lab-core';
import { compositeOrbitalShrapnelRawTrailToRgba } from './OrbitalShrapnelRawCompositeMapper.js';
import { resolveOrbitalShrapnelRawTexturePlan } from './OrbitalShrapnelRawTexturePlan.js';

export interface OrbitalShrapnelRawRenderOptions {
  readonly trailField: TrailField;
  readonly style: SimStyle;
  readonly width: number;
  readonly height: number;
  readonly particleCount: number;
  readonly trailColumns: number;
  readonly rawParticleTextureSize?: number | string;
  readonly rawTrailTextureWidth?: number | string;
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

  constructor(private readonly app: Application, quality: RenderQuality = 'raw') {
    this.quality = quality;
    this.layer.sortableChildren = true;
    this.app.stage.addChild(this.layer);
  }

  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.destroyTextureLayer();
  }

  clear(): void {
    if (this.textureLayer) this.textureLayer.sprite.visible = false;
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
  }

  destroy(): void {
    this.destroyTextureLayer();
    this.layer.destroy({ children: true });
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
