import { Container, Text, type Application } from 'pixi.js';
import type { RenderQuality } from '../types';

export interface DebugOverlayState {
  fps: number;
  quality: RenderQuality;
  particleCount?: number;
  fieldVariance?: number;
  renderTargets?: string;
}

export class DebugOverlay {
  readonly container = new Container();
  private readonly text = new Text({ text: '', style: { fill: 0xffffff, fontSize: 12 } });
  private enabled = false;

  constructor(app: Application) {
    this.container.addChild(this.text);
    this.container.visible = false;
    app.stage.addChild(this.container);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.visible = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(state: DebugOverlayState): void {
    if (!this.enabled) return;
    this.text.text = [
      `fps ${state.fps.toFixed(1)}`,
      `quality ${state.quality}`,
      state.particleCount === undefined ? '' : `particles ${state.particleCount}`,
      state.fieldVariance === undefined ? '' : `field var ${state.fieldVariance.toFixed(4)}`,
      state.renderTargets ?? '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
