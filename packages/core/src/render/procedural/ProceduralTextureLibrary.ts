import { Graphics, RenderTexture, type Renderer } from 'pixi.js';

export type ProceduralTextureId =
  | 'radial-blob'
  | 'spark'
  | 'noise'
  | 'blue-noise'
  | 'caustics'
  | 'grain'
  | 'scanlines';

export class ProceduralTextureLibrary {
  private readonly textures = new Map<string, RenderTexture>();

  constructor(private readonly renderer: Renderer) {}

  get(id: ProceduralTextureId): RenderTexture {
    const cached = this.textures.get(id);
    if (cached) return cached;

    const texture = this.createTexture(id);
    this.textures.set(id, texture);
    return texture;
  }

  getPaletteStrip(id: string, colors: readonly number[]): RenderTexture {
    const key = `palette:${id}`;
    const cached = this.textures.get(key);
    if (cached) return cached;

    const graphics = new Graphics();
    colors.forEach((color, index) => {
      graphics.rect(index, 0, 1, 1);
      graphics.fill({ color });
    });
    const texture = this.renderer.generateTexture(graphics);
    graphics.destroy();
    this.textures.set(key, texture);
    return texture;
  }

  destroy(): void {
    for (const texture of this.textures.values()) {
      texture.destroy(true);
    }
    this.textures.clear();
  }

  private createTexture(id: ProceduralTextureId): RenderTexture {
    const size = id === 'spark' ? 16 : 64;
    const graphics = new Graphics();
    switch (id) {
      case 'spark':
        graphics.circle(size / 2, size / 2, 3);
        graphics.fill({ color: 0xffffff });
        break;
      case 'scanlines':
        for (let y = 0; y < size; y += 4) {
          graphics.rect(0, y, size, 1);
          graphics.fill({ color: 0xffffff, alpha: 0.25 });
        }
        break;
      default:
        graphics.circle(size / 2, size / 2, size / 2);
        graphics.fill({ color: 0xffffff, alpha: 1 });
        break;
    }
    const texture = this.renderer.generateTexture(graphics);
    graphics.destroy();
    return texture;
  }
}
