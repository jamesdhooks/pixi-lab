import {
  BufferImageSource,
  Container,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { ScalarField } from '../sim/fields/ScalarField.js';
import type { RenderQuality, SimStyle } from '../types.js';

export interface FieldPaletteRenderOptions {
  alpha?: number;
  gamma?: number;
  maxAlpha?: number;
  absolute?: boolean;
  zIndex?: number;
  palette?: readonly number[];
}

interface FieldLayer {
  readonly sprite: Sprite;
  texture: Texture | null;
  source: BufferImageSource | null;
  pixels: Uint8Array | null;
  columns: number;
  rows: number;
}

export class FieldPaletteRenderer {
  readonly container = new Container();
  private readonly layers = new Map<string, FieldLayer>();
  private quality: RenderQuality = 'basic';

  constructor(app: Application) {
    this.container.sortableChildren = true;
    app.stage.addChild(this.container);
  }

  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    for (const layer of this.layers.values()) {
      if (layer.source) layer.source.scaleMode = this.scaleMode();
    }
  }

  clear(): void {
    for (const layer of this.layers.values()) layer.sprite.visible = false;
  }

  renderField(
    id: string,
    field: ScalarField,
    width: number,
    height: number,
    style: SimStyle,
    options: FieldPaletteRenderOptions = {},
  ): void {
    const layer = this.ensureLayer(id, field.columns, field.rows, options.zIndex ?? 0);
    if (!layer.pixels || !layer.source || !layer.texture) return;

    const palette = options.palette ?? style.palette;
    const colors = palette.length > 0 ? palette : [0xffffff];
    const lastPaletteIndex = colors.length - 1;
    const gamma = options.gamma ?? (this.quality === 'basic' ? 0.65 : 0.45);
    const maxAlpha = options.maxAlpha ?? (this.quality === 'basic' ? 200 : 224);
    const smooth = this.quality !== 'basic';

    let offset = 0;
    for (let y = 0; y < field.rows; y++) {
      for (let x = 0; x < field.columns; x++) {
        const rawValue = options.absolute === false ? field.get(x, y) : Math.abs(field.get(x, y));
        const normalized = Math.max(0, Math.min(1, rawValue));
        const value = Math.pow(normalized, gamma);
        const color = this.samplePalette(colors, lastPaletteIndex, value, smooth);
        layer.pixels[offset] = color.r;
        layer.pixels[offset + 1] = color.g;
        layer.pixels[offset + 2] = color.b;
        layer.pixels[offset + 3] = Math.floor(value * maxAlpha);
        offset += 4;
      }
    }

    layer.source.update();
    layer.sprite.texture = layer.texture;
    layer.sprite.width = width;
    layer.sprite.height = height;
    layer.sprite.alpha = options.alpha ?? 1;
    layer.sprite.visible = true;
  }

  getLayer(id: string): Sprite | undefined {
    return this.layers.get(id)?.sprite;
  }

  destroy(): void {
    for (const layer of this.layers.values()) {
      layer.sprite.texture = Texture.EMPTY;
      layer.texture?.destroy(true);
    }
    this.layers.clear();
    this.container.destroy({ children: true });
  }

  private ensureLayer(id: string, columns: number, rows: number, zIndex: number): FieldLayer {
    const existing = this.layers.get(id);
    if (existing && existing.columns === columns && existing.rows === rows) {
      existing.sprite.zIndex = zIndex;
      return existing;
    }

    if (existing) {
      existing.sprite.texture = Texture.EMPTY;
      existing.texture?.destroy(true);
      this.container.removeChild(existing.sprite);
    }

    const pixels = new Uint8Array(columns * rows * 4);
    const source = new BufferImageSource({
      resource: pixels,
      width: columns,
      height: rows,
      scaleMode: this.scaleMode(),
    });
    const texture = new Texture({ source });
    const sprite = new Sprite(texture);
    sprite.visible = false;
    sprite.zIndex = zIndex;
    this.container.addChild(sprite);

    const next: FieldLayer = { sprite, texture, source, pixels, columns, rows };
    this.layers.set(id, next);
    return next;
  }

  private scaleMode(): 'nearest' | 'linear' {
    return this.quality === 'basic' ? 'nearest' : 'linear';
  }

  private samplePalette(
    palette: readonly number[],
    lastPaletteIndex: number,
    value: number,
    smooth: boolean,
  ): { r: number; g: number; b: number } {
    if (!smooth || palette.length <= 1) {
      const color = palette[Math.min(lastPaletteIndex, Math.floor(value * palette.length))];
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
