import {
  BufferImageSource,
  Container,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { DensityField } from '../sim/fields/DensityField.js';
import type { ScalarField } from '../sim/fields/ScalarField.js';
import type { RenderQuality, SimStyle } from '../types.js';

export interface DensityMetaballRenderOptions {
  alpha?: number;
  threshold?: number;
  softness?: number;
  glowStrength?: number;
  maxPixels?: number;
  zIndex?: number;
}

export class DensityMetaballRenderer {
  readonly container = new Container();
  private readonly sprite = new Sprite();
  private texture: Texture | null = null;
  private source: BufferImageSource | null = null;
  private pixels: Uint8Array | null = null;
  private textureWidth = 0;
  private textureHeight = 0;
  private quality: RenderQuality = 'basic';

  constructor(app: Application) {
    this.container.addChild(this.sprite);
    app.stage.addChild(this.container);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    if (this.source) this.source.scaleMode = 'linear';
  }

  clear(): void {
    this.sprite.visible = false;
  }

  renderDensity(
    field: DensityField | ScalarField,
    width: number,
    height: number,
    style: SimStyle,
    options: DensityMetaballRenderOptions = {},
  ): void {
    const dimensions = this.computeTextureSize(width, height, options.maxPixels);
    this.ensureTexture(dimensions.width, dimensions.height);
    if (!this.pixels || !this.source || !this.texture) return;

    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    const threshold = options.threshold ?? this.numberUniform(style, 'threshold', 0.42);
    const softness = options.softness ?? (this.quality === 'basic' ? 0.18 : 0.26);
    const glowStrength = options.glowStrength ?? this.numberUniform(style, 'glowStrength', 0.65);
    const lastPaletteIndex = palette.length - 1;

    let offset = 0;
    for (let y = 0; y < this.textureHeight; y++) {
      const ny = this.textureHeight <= 1 ? 0 : y / (this.textureHeight - 1);
      for (let x = 0; x < this.textureWidth; x++) {
        const nx = this.textureWidth <= 1 ? 0 : x / (this.textureWidth - 1);
        const density = Math.max(0, Math.min(1.6, field.sampleBilinearNormalized(nx, ny)));
        const membrane = this.smoothstep(threshold - softness, threshold + softness, density);
        const glow = Math.max(0, Math.min(1, density * glowStrength));
        const value = Math.max(membrane, glow * 0.56);
        const color = this.samplePalette(palette, lastPaletteIndex, Math.max(0, Math.min(1, density * 0.82 + membrane * 0.18)));
        const edge = membrane * (1 - this.smoothstep(threshold + softness * 0.55, threshold + softness * 1.9, density));

        this.pixels[offset] = Math.min(255, Math.round(color.r + edge * 64));
        this.pixels[offset + 1] = Math.min(255, Math.round(color.g + edge * 64));
        this.pixels[offset + 2] = Math.min(255, Math.round(color.b + edge * 64));
        this.pixels[offset + 3] = Math.round(Math.max(0, Math.min(1, value)) * 238);
        offset += 4;
      }
    }

    this.source.update();
    this.sprite.texture = this.texture;
    this.sprite.width = width;
    this.sprite.height = height;
    this.sprite.alpha = options.alpha ?? 1;
    this.sprite.zIndex = options.zIndex ?? 0;
    this.sprite.visible = true;
  }

  get layer(): Sprite {
    return this.sprite;
  }

  destroy(): void {
    this.sprite.texture = Texture.EMPTY;
    this.texture?.destroy(true);
    this.container.destroy({ children: true });
  }

  private computeTextureSize(width: number, height: number, maxPixels = this.quality === 'basic' ? 220_000 : 520_000): { width: number; height: number } {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    const pixels = safeWidth * safeHeight;
    const scale = pixels <= maxPixels ? 1 : Math.sqrt(maxPixels / pixels);
    return {
      width: Math.max(1, Math.floor(safeWidth * scale)),
      height: Math.max(1, Math.floor(safeHeight * scale)),
    };
  }

  private ensureTexture(width: number, height: number): void {
    if (width === this.textureWidth && height === this.textureHeight) return;
    this.sprite.texture = Texture.EMPTY;
    this.texture?.destroy(true);
    this.pixels = new Uint8Array(width * height * 4);
    this.source = new BufferImageSource({
      resource: this.pixels,
      width,
      height,
      scaleMode: 'linear',
    });
    this.texture = new Texture({ source: this.source });
    this.textureWidth = width;
    this.textureHeight = height;
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  private numberUniform(style: SimStyle, key: string, fallback: number): number {
    const value = style.uniforms[key];
    return typeof value === 'number' ? value : fallback;
  }

  private samplePalette(palette: readonly number[], lastPaletteIndex: number, value: number): { r: number; g: number; b: number } {
    if (palette.length <= 1) {
      const color = palette[0] ?? 0xffffff;
      return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
    }
    const palettePosition = value * lastPaletteIndex;
    const paletteIndex = Math.floor(palettePosition);
    const t = palettePosition - paletteIndex;
    const c0 = palette[Math.min(lastPaletteIndex, paletteIndex)];
    const c1 = palette[Math.min(lastPaletteIndex, paletteIndex + 1)];
    return {
      r: Math.round(((c0 >> 16) & 0xff) + (((c1 >> 16) & 0xff) - ((c0 >> 16) & 0xff)) * t),
      g: Math.round(((c0 >> 8) & 0xff) + (((c1 >> 8) & 0xff) - ((c0 >> 8) & 0xff)) * t),
      b: Math.round((c0 & 0xff) + ((c1 & 0xff) - (c0 & 0xff)) * t),
    };
  }
}
