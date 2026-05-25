/**
 * packages/core/src/render/Sprites.ts
 *
 * Texture cache for balls and other sprites.
 * Basic and enhanced circles use Canvas 2D so that `arc()` — not PixiJS's
 * polygon tessellator — draws the circles. This guarantees smooth,
 * anti-aliased edges at every radius without relying on segment count.
 */
import { Graphics, Texture, Sprite, CanvasSource, type Application } from 'pixi.js';

export class SpriteFactory {
  private app: Application;
  private cache = new Map<string, Texture>();

  constructor(app: Application) {
    this.app = app;
  }

  /** Resolution used for all generated textures (crisp on retina screens). */
  private get dpr(): number {
    return Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 2, 2);
  }

  private generateTexture(g: Graphics): ReturnType<typeof this.app.renderer.generateTexture> {
    return this.app.renderer.generateTexture({ target: g, resolution: this.dpr, antialias: true });
  }

  // ── Canvas2D circle helpers ──────────────────────────────────────────────

  /**
   * Build or retrieve a cached canvas-backed Texture for a circle.
   * Canvas 2D `arc()` is always anti-aliased — no polygon tessellation
   * artefacts regardless of radius. The canvas is drawn at physical DPR
   * pixels so the texture stays crisp on retina screens.
   *
   * Cache key: `c:<intRadius>:<hexColor>` (basic) or `e:…` (enhanced).
   */
  private makeCanvasCircleTexture(radius: number, color: number, enhanced: boolean): Texture {
    const intR = Math.round(radius);
    const cacheKey = `${enhanced ? 'e' : 'c'}:${intR}:${color.toString(16)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const dpr = this.dpr;
    // 2 CSS-px padding on each side prevents AA pixels touching the texture edge
    const pad = 2;
    const cssSize = intR * 2 + pad * 2;
    const physSize = Math.round(cssSize * dpr);

    const canvas = document.createElement('canvas');
    canvas.width = physSize;
    canvas.height = physSize;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const cx = cssSize / 2;
    const cy = cssSize / 2;

    // Clip to circle — gradient fills won't escape the boundary
    ctx.beginPath();
    ctx.arc(cx, cy, intR, 0, Math.PI * 2);
    ctx.clip();

    const ri = (color >> 16) & 0xff;
    const gi = (color >> 8) & 0xff;
    const bi = color & 0xff;

    if (!enhanced) {
      ctx.fillStyle = `rgb(${ri},${gi},${bi})`;
      ctx.fillRect(0, 0, cssSize, cssSize);
    } else {
      this.drawSphereCanvas(ctx, cssSize, cx, cy, intR, ri, gi, bi);
    }

    // resolution=dpr tells PixiJS the canvas pixels map to (cssSize × cssSize)
    // logical pixels, so sprites are sized correctly on retina displays.
    const source = new CanvasSource({ resource: canvas, resolution: dpr });
    const tex = new Texture({ source });
    this.cache.set(cacheKey, tex);
    return tex;
  }

  /**
   * Paints a clean, modern sphere: subtle depth gradient from lighter upper-left
   * to slightly darker lower-right, plus a small soft specular highlight.
   * Avoids heavy shading / rim-lights that look muddy at small sizes.
   *
   * The context must already be clipped to the circle path.
   */
  private drawSphereCanvas(
    ctx: CanvasRenderingContext2D,
    size: number,
    cx: number,
    cy: number,
    r: number,
    ri: number,
    gi: number,
    bi: number,
  ) {
    // Light source direction: upper-left (~10 o'clock)
    const lx = cx - r * 0.3;
    const ly = cy - r * 0.35;

    // Light tints (~×1.4 brightness)
    const lR = Math.min(255, Math.round(ri * 1.4 + 15));
    const lG = Math.min(255, Math.round(gi * 1.4 + 15));
    const lB = Math.min(255, Math.round(bi * 1.4 + 15));

    // Shadow tints (~×0.65 brightness)
    const dR = Math.round(ri * 0.65);
    const dG = Math.round(gi * 0.65);
    const dB = Math.round(bi * 0.65);

    // ── 1. Depth gradient ── lighter upper-left → base → darker lower-right
    const grad = ctx.createRadialGradient(lx, ly, 0, cx + r * 0.2, cy + r * 0.2, r * 1.2);
    grad.addColorStop(0,   `rgb(${lR},${lG},${lB})`);
    grad.addColorStop(0.5, `rgb(${ri},${gi},${bi})`);
    grad.addColorStop(1,   `rgb(${dR},${dG},${dB})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // ── 2. Soft specular highlight ────────────────────────────────────────
    const spec = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.22);
    spec.addColorStop(0,   'rgba(255,255,255,0.80)');
    spec.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    spec.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, size, size);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Get or create a circle Texture (basic, flat-shaded). */
  getCircleTexture(radius: number, color: number): Texture {
    return this.makeCanvasCircleTexture(radius, color, false);
  }

  /** Sprite backed by a smooth Canvas2D circle texture. */
  makeCircleSprite(radius: number, color: number): Sprite {
    const tex = this.makeCanvasCircleTexture(radius, color, false);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  /**
   * Ring (stroke-only) sprite for the hold-explosion countdown indicator.
   * Not cached — each hold creates a fresh instance.
   */
  makeRingSprite(radius: number, strokeWidth: number, color: number): Sprite {
    const g = new Graphics();
    g.circle(0, 0, radius);
    g.stroke({ color, width: strokeWidth, alpha: 1 });

    const tex = this.generateTexture(g);
    g.destroy();

    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  /**
   * Enhanced ball sprite: 5-layer Canvas2D sphere (diffuse + specular + rim).
   * Backed by the same Canvas2D texture cache — O(1) per unique radius/color pair.
   */
  makeEnhancedBallSprite(radius: number, color: number): Sprite {
    const tex = this.makeCanvasCircleTexture(radius, color, true);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  /**
   * Ultra ball sprite: enhanced sphere with a baked soft drop-shadow below.
   * The canvas is taller than the ball to accommodate the shadow, and the
   * sprite anchor is shifted so the physics centre maps correctly.
   */
  makeUltraBallSprite(radius: number, color: number): Sprite {
    const intR = Math.round(radius);
    const pad = 3;
    const extraBottom = Math.round(intR * 0.7);
    const cssW = intR * 2 + pad * 2;
    const cssH = intR * 2 + pad * 2 + extraBottom;
    const cy = pad + intR; // ball centre in the canvas
    const anchorY = cy / cssH;

    const cacheKey = `u:${intR}:${color.toString(16)}`;
    let tex = this.cache.get(cacheKey);
    if (!tex) {
      const dpr = this.dpr;
      const physW = Math.round(cssW * dpr);
      const physH = Math.round(cssH * dpr);

      const canvas = document.createElement('canvas');
      canvas.width = physW;
      canvas.height = physH;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      const cx = cssW / 2;
      const ri = (color >> 16) & 0xff;
      const gi = (color >> 8) & 0xff;
      const bi = color & 0xff;

      // ── 1. Soft drop-shadow below the ball ───────────────────────────────
      const sx = cx;
      const sy = cy + intR + extraBottom * 0.38;
      const swR = intR * 1.05;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1.0, 0.38); // squish radial gradient into an ellipse
      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, swR);
      shadowGrad.addColorStop(0,   'rgba(0,0,0,0.42)');
      shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.18)');
      shadowGrad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(-swR, -swR, swR * 2, swR * 2);
      ctx.restore();

      // ── 2. Sphere with AO darkening at the bottom ────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, intR, 0, Math.PI * 2);
      ctx.clip();
      this.drawSphereCanvas(ctx, cssW, cx, cy, intR, ri, gi, bi);

      // Subtle ambient-occlusion rim — darkens the lower hemisphere
      const aoGrad = ctx.createLinearGradient(cx, cy, cx, cy + intR);
      aoGrad.addColorStop(0.4, 'rgba(0,0,0,0)');
      aoGrad.addColorStop(1,   'rgba(0,0,0,0.25)');
      ctx.fillStyle = aoGrad;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.restore();

      const source = new CanvasSource({ resource: canvas, resolution: dpr });
      tex = new Texture({ source });
      this.cache.set(cacheKey, tex);
    }

    const s = new Sprite(tex);
    s.anchor.set(0.5, anchorY);
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

    const tex = this.generateTexture(g);
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
      tex.destroy(true); // true = destroy underlying CanvasSource too
    }
    this.cache.clear();
  }
}
