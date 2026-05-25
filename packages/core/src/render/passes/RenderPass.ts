import type { RenderTexture } from 'pixi.js';
import type { RenderPassId } from '../../types.js';

export interface RenderPassContext {
  dt: number;
  time: number;
  uniforms: Record<string, number | string | boolean>;
}

export interface RenderPass {
  readonly id: RenderPassId;
  apply(input: RenderTexture, output: RenderTexture, ctx: RenderPassContext): void;
}

export abstract class NoopRenderPass implements RenderPass {
  abstract readonly id: RenderPassId;

  apply(_input: RenderTexture, _output: RenderTexture, _ctx: RenderPassContext): void {
    // No-op placeholder for pass orchestration; concrete GPU passes can replace this.
  }
}
