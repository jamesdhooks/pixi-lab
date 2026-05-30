import type { GameContext, RenderQuality } from '@hooksjam/pixi-lab-core';

/**
 * Scene-owned render variant used by simulations that need to switch renderer
 * implementations by quality without promoting scene-specific renderers into core.
 */
export interface SceneRenderVariant {
  enter(ctx: GameContext): void;
  exit(): void;
  resize(width: number, height: number): void;
  update(dt: number): void;
  render(alpha: number): void;
  setQuality?(quality: RenderQuality): void;
  setStyle?(styleId: string): void;
  setMode?(modeId: string): void;
  reset?(): void;
}
