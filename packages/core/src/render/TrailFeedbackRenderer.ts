import type { Application } from 'pixi.js';
import type { TrailField } from '../sim/fields/TrailField.js';
import type { RenderQuality, SimStyle } from '../types.js';
import { FieldPaletteRenderer, type FieldPaletteRenderOptions } from './FieldPaletteRenderer.js';

export interface TrailFeedbackRenderOptions extends FieldPaletteRenderOptions {
  intensity?: number;
}

export class TrailFeedbackRenderer {
  private readonly fieldRenderer: FieldPaletteRenderer;

  constructor(app: Application) {
    this.fieldRenderer = new FieldPaletteRenderer(app);
  }

  get container() {
    return this.fieldRenderer.container;
  }

  setQuality(quality: RenderQuality): void {
    this.fieldRenderer.setQuality(quality);
  }

  clear(): void {
    this.fieldRenderer.clear();
  }

  renderTrail(
    id: string,
    field: TrailField,
    width: number,
    height: number,
    style: SimStyle,
    options: TrailFeedbackRenderOptions = {},
  ): void {
    this.fieldRenderer.renderField(id, field, width, height, style, {
      alpha: options.alpha ?? 0.86,
      gamma: options.gamma ?? 0.38,
      maxAlpha: options.maxAlpha ?? Math.round(230 * (options.intensity ?? 1)),
      absolute: options.absolute,
      palette: options.palette,
      zIndex: options.zIndex,
    });
  }

  getLayer(id: string) {
    return this.fieldRenderer.getLayer(id);
  }

  destroy(): void {
    this.fieldRenderer.destroy();
  }
}
