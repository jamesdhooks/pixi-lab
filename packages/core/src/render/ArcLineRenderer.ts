import { Container, Graphics, type Application } from 'pixi.js';
import type { SimParticle } from '../sim/particles/SimParticleSystem.js';
import type { RenderQuality, SimStyle } from '../types.js';

export interface ArcLineRenderOptions {
  alpha?: number;
  velocityScale?: number;
  zIndex?: number;
}

export class ArcLineRenderer {
  readonly container = new Container();
  private readonly graphics = new Graphics();
  private quality: RenderQuality = 'basic';

  constructor(app: Application) {
    this.container.addChild(this.graphics);
    app.stage.addChild(this.container);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
  }

  clear(): void {
    this.graphics.clear();
  }

  renderParticleArcs(
    particles: readonly SimParticle[],
    style: SimStyle,
    options: ArcLineRenderOptions = {},
  ): void {
    this.graphics.clear();
    this.container.alpha = options.alpha ?? 1;
    this.container.zIndex = options.zIndex ?? this.container.zIndex;
    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    const velocityScale = options.velocityScale ?? (this.quality === 'basic' ? 0.18 : 0.28);

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const speed = Math.hypot(particle.velocity.x, particle.velocity.y);
      const length = Math.max(8, Math.min(70, speed * velocityScale + particle.size * 2));
      const angle = Math.atan2(particle.velocity.y, particle.velocity.x);
      const tailX = particle.position.x - Math.cos(angle) * length;
      const tailY = particle.position.y - Math.sin(angle) * length;
      const color = particle.color || palette[i % palette.length];
      const alpha = Math.max(0.08, Math.min(0.9, particle.alpha));
      const width = this.quality === 'basic' ? 1.2 : Math.max(1.4, particle.size * 0.28);

      this.graphics.moveTo(tailX, tailY);
      this.graphics.lineTo(particle.position.x, particle.position.y);
      this.graphics.stroke({ color, alpha, width });
    }
  }

  get layer(): Graphics {
    return this.graphics;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
