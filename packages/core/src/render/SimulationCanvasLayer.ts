import { Container, Graphics, type Application } from 'pixi.js';
import type { SimParticle } from '../sim/particles/SimParticleSystem';
import type { SimRenderLayers, SimStyle } from '../types';
import type { ScalarField } from '../sim/fields/ScalarField';

export class SimulationCanvasLayer {
  readonly container = new Container();
  private readonly graphics = new Graphics();

  constructor(app: Application) {
    this.container.addChild(this.graphics);
    app.stage.addChild(this.container);
  }

  clear(): void {
    this.graphics.clear();
  }

  renderField(field: ScalarField, width: number, height: number, style: SimStyle): void {
    const cellWidth = width / field.columns;
    const cellHeight = height / field.rows;
    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    for (let y = 0; y < field.rows; y++) {
      for (let x = 0; x < field.columns; x++) {
        const value = Math.abs(field.get(x, y));
        if (value < 0.08) continue;
        const color = palette[Math.min(palette.length - 1, Math.floor(value * palette.length))];
        const alpha = Math.min(0.28, value * 0.2);
        this.graphics.rect(x * cellWidth, y * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight));
        this.graphics.fill({ color, alpha });
      }
    }
  }

  renderParticles(particles: readonly SimParticle[], style: SimStyle): void {
    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const color = particle.color || palette[i % palette.length];
      this.graphics.circle(particle.position.x, particle.position.y, particle.size);
      this.graphics.fill({ color, alpha: particle.alpha });
    }
  }

  getRenderLayers(): SimRenderLayers {
    return { primitive: this.container, particles: this.container, field: this.container };
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
