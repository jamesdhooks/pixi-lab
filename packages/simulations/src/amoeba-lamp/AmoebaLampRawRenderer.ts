import {
  BufferImageSource,
  Container,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { RenderQuality, SimStyle } from '@hooksjam/pixi-lab-core';
import { compositeAmoebaRawFieldsToRgba } from './AmoebaLampRawCompositeMapper.js';
import { createAmoebaRawFramePipeline, stepAmoebaRawFramePipeline, type AmoebaRawFramePipeline } from './AmoebaLampRawFramePipeline.js';
import type { AmoebaRawSourceParticle } from './AmoebaLampRawSplatMapper.js';
export { resolveAmoebaRawTextureSize, type AmoebaRawTextureSizeOptions } from './AmoebaLampRawTextureSizing.js';
import { resolveAmoebaRawTextureSize } from './AmoebaLampRawTextureSizing.js';

export interface AmoebaRawRenderOptions {
  readonly particles: readonly AmoebaRawSourceParticle[];
  readonly style: SimStyle;
  readonly width: number;
  readonly height: number;
  readonly densityRadius: number;
}

interface AmoebaRawTextureLayer {
  readonly sprite: Sprite;
  readonly source: BufferImageSource;
  readonly texture: Texture;
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export class AmoebaLampRawRenderer {
  readonly layer = new Container();
  private quality: RenderQuality = 'raw';
  private textureLayer: AmoebaRawTextureLayer | null = null;
  private pipeline: AmoebaRawFramePipeline | null = null;

  constructor(private readonly app: Application, quality: RenderQuality = 'raw') {
    this.quality = quality;
    this.layer.sortableChildren = true;
    this.app.stage.addChild(this.layer);
  }

  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.pipeline = null;
    this.destroyTextureLayer();
  }

  clear(): void {
    if (this.textureLayer) this.textureLayer.sprite.visible = false;
  }

  render(options: AmoebaRawRenderOptions): void {
    const size = resolveAmoebaRawTextureSize({ width: options.width, height: options.height, quality: this.quality });
    const layer = this.ensureTextureLayer(size.width, size.height);
    const pipeline = this.ensurePipeline(size.width, size.height);
    const upload = stepAmoebaRawFramePipeline(pipeline, {
      particles: options.particles,
      width: options.width,
      height: options.height,
      textureWidth: size.width,
      textureHeight: size.height,
      densityRadius: options.densityRadius,
      maxSplats: this.quality === 'raw' ? 512 : 384,
      densityDecay: this.quality === 'raw' ? 0.988 : 0.982,
      heatDecay: this.quality === 'raw' ? 0.974 : 0.966,
      diffusion: this.quality === 'raw' ? 0.18 : 0.14,
      heatRise: this.quality === 'raw' ? 0.16 : 0.12,
    });

    compositeAmoebaRawFieldsToRgba(upload, options.style, {
      threshold: this.quality === 'raw' ? 0.34 : 0.38,
      edgeGlow: this.quality === 'raw' ? 0.86 : 0.68,
      heatStrength: this.quality === 'raw' ? 0.9 : 0.78,
    }, layer.pixels);

    layer.source.update();
    layer.sprite.width = options.width;
    layer.sprite.height = options.height;
    layer.sprite.visible = true;
  }

  destroy(): void {
    this.destroyTextureLayer();
    this.layer.destroy({ children: true });
    this.pipeline = null;
  }

  private ensurePipeline(width: number, height: number): AmoebaRawFramePipeline {
    if (this.pipeline?.state.width === width && this.pipeline.state.height === height) return this.pipeline;
    this.pipeline = createAmoebaRawFramePipeline({ textureWidth: width, textureHeight: height });
    return this.pipeline;
  }

  private ensureTextureLayer(width: number, height: number): AmoebaRawTextureLayer {
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
