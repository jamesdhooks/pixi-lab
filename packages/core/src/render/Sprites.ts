/**
 * packages/core/src/render/Sprites.ts
 *
 * Shared Texture cache so all balls reuse one circle texture.
 * This is the main Pi 5 performance trick — one texture, thousands of sprites.
 */
import { Graphics, Texture, Sprite, type Application } from 'pixi.js';

interface TextureKey {
  radius: number;
  color: number;
}

function key(k: TextureKey): string {
  return `c:${k.radius}:${k.color.toString(16)}`;
}

export class SpriteFactory {
  private app: Application;
  private cache = new Map<string, Texture>();

  constructor(app: Application) {
    this.app = app;
  }

  /** Get or create a circle Texture */
  getCircleTexture(radius: number, color: number): Texture {
    const k = key({ radius, color });
    const cached = this.cache.get(k);
    if (cached) return cached;

    const g = new Graphics();
    g.circle(0, 0, radius);
    g.fill({ color });

    const tex = this.app.renderer.generateTexture(g);
    g.destroy();
    this.cache.set(k, tex);
    return tex;
  }

  /** Sprite backed by a shared circle texture — cheap to create */
  makeCircleSprite(radius: number, color: number): Sprite {
    const tex = this.getCircleTexture(radius, color);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  /** Get or create a box Texture */
  getBoxTexture(width: number, height: number, color: number): Texture {
    const k = `b:${width}:${height}:${color.toString(16)}`;
    const cached = this.cache.get(k);
    if (cached) return cached;

    const g = new Graphics();
    g.rect(-width / 2, -height / 2, width, height);
    g.fill({ color });

    const tex = this.app.renderer.generateTexture(g);
    g.destroy();
    this.cache.set(k, tex);
    return tex;
  }

  makeBoxSprite(width: number, height: number, color: number): Sprite {
    const tex = this.getBoxTexture(width, height, color);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  destroyAll() {
    for (const tex of this.cache.values()) {
      tex.destroy();
    }
    this.cache.clear();
  }
}
