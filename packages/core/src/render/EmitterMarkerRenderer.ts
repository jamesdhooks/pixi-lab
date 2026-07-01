import { Container, Graphics, type Application } from 'pixi.js';
import type { EmitterMarker } from './SimulationCanvasLayer.js';

export class EmitterMarkerRenderer {
  readonly container = new Container();
  private readonly graphics = new Graphics();

  constructor(app: Application) {
    this.container.addChild(this.graphics);
    app.stage.addChild(this.container);
  }

  clear(): void {
    this.graphics.clear();
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  renderEmitters(emitters: readonly EmitterMarker[], time: number): void {
    this.graphics.clear();
    for (const emitter of emitters) {
      const { x, y } = emitter.position;
      const deleteProgress = emitter.deleteProgress ?? 0;
      const pulse = (Math.sin(time * emitter.frequency * Math.PI * 2 + (emitter.phase ?? 0)) + 1) * 0.5;
      const scale = 1 - deleteProgress * 0.9;
      const coreRadius = (6 + pulse * 2) * scale;
      const glowRadius = coreRadius * 1.8;
      const alpha = (0.62 + pulse * 0.15) * (1 - deleteProgress * 0.65);
      const color = deleteProgress > 0 ? 0xff3333 : 0xffffff;

      this.graphics.circle(x, y, glowRadius);
      this.graphics.fill({ color, alpha: alpha * 0.12 });
      this.graphics.circle(x, y, coreRadius);
      this.graphics.fill({ color, alpha });
    }
  }

  get layer(): Graphics {
    return this.graphics;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
