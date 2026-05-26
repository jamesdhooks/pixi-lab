import {
  Container,
  Particle,
  ParticleContainer,
  Texture,
  type Application,
} from 'pixi.js';
import type { SimParticle } from '../sim/particles/SimParticleSystem.js';
import type { RenderQuality, SimStyle } from '../types.js';

export interface ParticlePointRenderOptions {
  alpha?: number;
  sizeScale?: number;
  zIndex?: number;
}

export class ParticlePointRenderer {
  readonly container = new Container();
  readonly particles: ParticleContainer<Particle>;
  private readonly texture: Texture;
  private quality: RenderQuality = 'basic';

  constructor(app: Application) {
    this.texture = this.createParticleTexture();
    this.particles = new ParticleContainer<Particle>({
      dynamicProperties: { position: true, scale: true, color: true },
    });
    this.particles.texture = this.texture;
    this.container.addChild(this.particles);
    app.stage.addChild(this.container);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
  }

  clear(): void {
    this.ensureParticleCount(0);
  }

  renderParticles(
    sourceParticles: readonly SimParticle[],
    style: SimStyle,
    options: ParticlePointRenderOptions = {},
  ): void {
    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    const qualityScale = this.quality === 'basic' ? 0.55 : 0.75;
    const sizeScale = options.sizeScale ?? qualityScale;
    this.container.alpha = options.alpha ?? 1;
    this.container.zIndex = options.zIndex ?? this.container.zIndex;
    this.ensureParticleCount(sourceParticles.length);

    for (let i = 0; i < sourceParticles.length; i++) {
      const source = sourceParticles[i];
      const particle = this.particles.particleChildren[i];
      const size = Math.max(1, source.size * sizeScale);
      particle.x = source.position.x;
      particle.y = source.position.y;
      particle.alpha = source.alpha;
      particle.tint = source.color || palette[i % palette.length];
      particle.scaleX = size;
      particle.scaleY = size;
    }
  }

  destroy(): void {
    this.texture.destroy(true);
    this.container.destroy({ children: true });
  }

  private ensureParticleCount(count: number): void {
    const children = this.particles.particleChildren;
    while (children.length < count) {
      const particle = new Particle({
        texture: this.texture,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: 1,
        scaleY: 1,
      });
      this.particles.addParticle(particle);
    }
    if (children.length > count) {
      children.length = count;
      this.particles.update();
    }
  }

  private createParticleTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(4, 4, 0, 4, 4, 4);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.45, 'rgba(255,255,255,0.82)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 8, 8);
    }
    return Texture.from(canvas, true);
  }
}
