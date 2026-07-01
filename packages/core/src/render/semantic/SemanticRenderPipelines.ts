import type { Application } from 'pixi.js';
import type { RenderQuality } from '../../types.js';
import { FieldPaletteRenderer } from '../FieldPaletteRenderer.js';
import { ParticlePointRenderer } from '../ParticlePointRenderer.js';
import { TrailFeedbackRenderer } from '../TrailFeedbackRenderer.js';
import type { RawWebGL2RenderState } from '../raw/RawWebGL2Scene.js';
import type { RenderFrame, SemanticRenderLayer } from './SemanticRenderFrame.js';

export interface SemanticRenderPipeline {
  render(frame: RenderFrame): void;
  clear(): void;
  setQuality?(quality: RenderQuality): void;
  destroy(): void;
}

export interface PixiSemanticRenderPipelineOptions {
  app: Application;
  quality?: RenderQuality;
}

export class PixiSemanticRenderPipeline implements SemanticRenderPipeline {
  private readonly particleRenderer: ParticlePointRenderer;
  private readonly trailRenderer: TrailFeedbackRenderer;
  private readonly fieldRenderer: FieldPaletteRenderer;
  private quality: RenderQuality;

  constructor(options: PixiSemanticRenderPipelineOptions) {
    this.quality = options.quality ?? 'basic';
    this.particleRenderer = new ParticlePointRenderer(options.app);
    this.trailRenderer = new TrailFeedbackRenderer(options.app);
    this.fieldRenderer = new FieldPaletteRenderer(options.app);
    this.setQuality(this.quality);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.particleRenderer.setQuality(quality);
    this.trailRenderer.setQuality(quality);
    this.fieldRenderer.setQuality(quality);
  }

  render(frame: RenderFrame): void {
    this.clear();
    for (const layer of frame.layers) {
      this.renderLayer(frame, layer);
    }
  }

  clear(): void {
    this.particleRenderer.clear();
    this.trailRenderer.clear();
    this.fieldRenderer.clear();
  }

  destroy(): void {
    this.particleRenderer.destroy();
    this.trailRenderer.destroy();
    this.fieldRenderer.destroy();
  }

  private renderLayer(frame: RenderFrame, layer: SemanticRenderLayer): void {
    switch (layer.kind) {
      case 'particlePoints':
        this.particleRenderer.renderParticles(layer.particles, frame.style, {
          sizeScale: layer.sizeScale,
          zIndex: layer.zIndex,
        });
        return;
      case 'trailFeedback':
        this.trailRenderer.renderTrail(layer.id, layer.field, frame.width, frame.height, frame.style, {
          alpha: layer.alpha,
          gamma: layer.gamma,
          zIndex: layer.zIndex,
        });
        return;
      case 'fieldPalette':
        this.fieldRenderer.renderField(layer.id, layer.field, frame.width, frame.height, frame.style, {
          alpha: layer.alpha,
          gamma: layer.gamma,
          zIndex: layer.zIndex,
        });
        return;
    }
  }
}

export interface WebGL2SemanticRenderPipelineOptions {
  renderLayer?: (state: RawWebGL2RenderState, frame: RenderFrame, layer: SemanticRenderLayer) => void;
  clear?: (state: RawWebGL2RenderState) => void;
  destroy?: () => void;
}

export class WebGL2SemanticRenderPipeline implements SemanticRenderPipeline {
  private frame: RenderFrame | null = null;
  private readonly renderLayerCallback?: WebGL2SemanticRenderPipelineOptions['renderLayer'];
  private readonly clearCallback?: WebGL2SemanticRenderPipelineOptions['clear'];
  private readonly destroyCallback?: WebGL2SemanticRenderPipelineOptions['destroy'];

  constructor(options: WebGL2SemanticRenderPipelineOptions = {}) {
    this.renderLayerCallback = options.renderLayer;
    this.clearCallback = options.clear;
    this.destroyCallback = options.destroy;
  }

  render(frame: RenderFrame): void {
    this.frame = frame;
  }

  renderToState(state: RawWebGL2RenderState): void {
    if (!this.frame) return;
    this.clearCallback?.(state);
    for (const layer of this.frame.layers) {
      this.renderLayerCallback?.(state, this.frame, layer);
    }
  }

  clear(): void {
    this.frame = null;
  }

  destroy(): void {
    this.clear();
    this.destroyCallback?.();
  }
}
