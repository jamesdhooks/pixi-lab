import {
  BufferImageSource,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js';
import type { SimParticle } from '../sim/particles/SimParticleSystem.js';
import type { RenderQuality, SimRenderLayers, SimStyle } from '../types.js';
import type { ScalarField } from '../sim/fields/ScalarField.js';

export interface EmitterMarker {
  position: { x: number; y: number };
  frequency: number;
  amplitude: number;
  /** Current wave phase in radians — drives the rotating tick indicator. */
  phase?: number;
  /** 0 = normal, 0–1 = deletion in progress (for animated removal feedback). */
  deleteProgress?: number;
}

export class SimulationCanvasLayer {
  readonly container = new Container();
  private readonly fieldSprite = new Sprite();
  private readonly particleContainer = new ParticleContainer<Particle>({
    dynamicProperties: { position: true, color: true },
  });
  private readonly emitterLayer = new Graphics();
  private particleTexture: Texture | null = null;
  private fieldTexture: Texture | null = null;
  private fieldSource: BufferImageSource | null = null;
  private fieldPixels: Uint8Array | null = null;
  private fieldColumns = 0;
  private fieldRows = 0;
  private quality: RenderQuality = 'basic';

  /** Call whenever the experience quality changes to switch rendering fidelity. */
  setQuality(q: RenderQuality): void {
    if (q === this.quality) return;
    this.quality = q;
    // Switch GPU filter mode — no texture recreation needed.
    // 'basic' = nearest-neighbour (crisp pixel grid),
    // 'enhanced'/'ultra' = linear (GPU bilinear upscale, much smoother).
    if (this.fieldSource) {
      this.fieldSource.scaleMode = q === 'basic' ? 'nearest' : 'linear';
    }
  }

  constructor(app: Application) {
    this.particleTexture = this.createParticleTexture(app);
    this.particleContainer.texture = this.particleTexture;
    this.container.addChild(this.fieldSprite);
    this.container.addChild(this.particleContainer);
    this.container.addChild(this.emitterLayer);
    app.stage.addChild(this.container);
  }

  clear(): void {
    this.fieldSprite.visible = false;
  }

  renderField(field: ScalarField, width: number, height: number, style: SimStyle): void {
    // Always render at the field's native grid resolution — GPU handles upscaling.
    // 'basic' uses nearest-neighbour; 'enhanced'/'ultra' use linear bilinear filtering
    // (controlled by scaleMode on the source, set in setQuality / ensureFieldTexture).
    this.ensureFieldTexture(field.columns, field.rows);
    if (!this.fieldPixels || !this.fieldSource || !this.fieldTexture) return;

    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    const lastPal = palette.length - 1;
    // Enhanced/ultra: tighter power curve → crisper nodal lines; stronger max alpha.
    const gamma = this.quality === 'basic' ? 0.65 : 0.45;
    const maxAlpha = this.quality === 'basic' ? 200 : 224;
    const smooth = this.quality !== 'basic';

    let offset = 0;
    for (let j = 0; j < field.rows; j++) {
      for (let i = 0; i < field.columns; i++) {
        const raw = Math.min(1, Math.abs(field.get(i, j)));
        const value = Math.pow(raw, gamma);

        let r: number;
        let g: number;
        let b: number;
        if (smooth && palette.length > 1) {
          // Smooth palette interpolation for enhanced/ultra — no hard colour banding.
          const pf = value * lastPal;
          const pi = Math.floor(pf);
          const pt = pf - pi;
          const c0 = palette[Math.min(lastPal, pi)];
          const c1 = palette[Math.min(lastPal, pi + 1)];
          r = ((c0 >> 16) & 0xff) + (((c1 >> 16) & 0xff) - ((c0 >> 16) & 0xff)) * pt;
          g = ((c0 >> 8) & 0xff) + (((c1 >> 8) & 0xff) - ((c0 >> 8) & 0xff)) * pt;
          b = (c0 & 0xff) + ((c1 & 0xff) - (c0 & 0xff)) * pt;
        } else {
          const color = palette[Math.min(lastPal, Math.floor(value * palette.length))];
          r = (color >> 16) & 0xff;
          g = (color >> 8) & 0xff;
          b = color & 0xff;
        }

        this.fieldPixels[offset]     = r | 0;
        this.fieldPixels[offset + 1] = g | 0;
        this.fieldPixels[offset + 2] = b | 0;
        this.fieldPixels[offset + 3] = Math.floor(value * maxAlpha);
        offset += 4;
      }
    }

    this.fieldSource.update();
    this.fieldSprite.texture = this.fieldTexture;
    this.fieldSprite.width = width;
    this.fieldSprite.height = height;
    this.fieldSprite.alpha = 1;
    this.fieldSprite.visible = true;
  }

  renderParticles(particles: readonly SimParticle[], style: SimStyle): void {
    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    this.ensureParticleCount(particles.length);
    for (let i = 0; i < particles.length; i++) {
      const source = particles[i];
      const particle = this.particleContainer.particleChildren[i];
      particle.x = source.position.x;
      particle.y = source.position.y;
      particle.alpha = source.alpha;
      particle.tint = source.color || palette[i % palette.length];
    }
  }

  /**
   * Draws a simple pulsing orb at every emitter position.
   * During deletion (deleteProgress > 0) the orb turns red and shrinks away.
   */
  renderEmitters(emitters: readonly EmitterMarker[], time: number): void {
    this.emitterLayer.clear();
    for (const emitter of emitters) {
      const { x, y } = emitter.position;
      const del = emitter.deleteProgress ?? 0;

      // Pulse: gentle oscillation, 6–8 px core, 0.62–0.77 alpha
      const pulse = (Math.sin(time * emitter.frequency * Math.PI * 2 + (emitter.phase ?? 0)) + 1) * 0.5;
      const scale = 1 - del * 0.9;
      const coreR = (6 + pulse * 2) * scale;
      const glowR = coreR * 1.8;
      const alpha = (0.62 + pulse * 0.15) * (1 - del * 0.65);
      const color = del > 0 ? 0xff3333 : 0xffffff;

      // Outer glow
      this.emitterLayer.circle(x, y, glowR);
      this.emitterLayer.fill({ color, alpha: alpha * 0.12 });

      // Core orb
      this.emitterLayer.circle(x, y, coreR);
      this.emitterLayer.fill({ color, alpha });
    }
  }

  getRenderLayers(): SimRenderLayers {
    return { primitive: this.container, particles: this.particleContainer, field: this.fieldSprite };
  }

  /** Show or hide the emitter marker layer (e.g. when UI is hidden). */
  setEmittersVisible(visible: boolean): void {
    this.emitterLayer.visible = visible;
  }

  destroy(): void {
    this.fieldTexture?.destroy(true);
    this.particleTexture?.destroy(true);
    this.container.destroy({ children: true });
  }

  private ensureFieldTexture(columns: number, rows: number): void {
    if (columns === this.fieldColumns && rows === this.fieldRows) return;
    // Detach before destroying so PixiJS doesn't reference a dead GPU resource.
    this.fieldSprite.texture = Texture.EMPTY;
    this.fieldTexture?.destroy(true);
    this.fieldPixels = new Uint8Array(columns * rows * 4);
    this.fieldSource = new BufferImageSource({
      resource: this.fieldPixels,
      width: columns,
      height: rows,
      scaleMode: this.quality === 'basic' ? 'nearest' : 'linear',
    });
    this.fieldTexture = new Texture({ source: this.fieldSource });
    this.fieldColumns = columns;
    this.fieldRows = rows;
  }

  private ensureParticleCount(count: number): void {
    if (!this.particleTexture) return;
    const children = this.particleContainer.particleChildren;
    while (children.length < count) {
      const particle = new Particle({
        texture: this.particleTexture,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: 1,
        scaleY: 1,
      });
      this.particleContainer.addParticle(particle);
    }
    if (children.length > count) {
      children.length = count;
      this.particleContainer.update();
    }
  }

  private createParticleTexture(app: Application): Texture {
    // 4×4 canvas gives ~2px effective dots at scale=0.5, which looks like
    // fine sand grains rather than large blobs.
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(2, 2, 0, 2, 2, 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 4, 4);
    }
    void app;
    return Texture.from(canvas, true);
  }
}
