import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { CosmicInkOceanScene, cosmicInkOceanStyleManifest } from './CosmicInkOceanScene.js';

export class CosmicInkOceanPreviewScene extends CosmicInkOceanScene {
  override readonly name = 'CosmicInkOceanPreview';

  constructor() {
    super(48, 180);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.setStyle(cosmicInkOceanStyleManifest.defaultStyleId);
    this.pushGestures([
      { kind: 'tap', x: ctx.width * 0.5, y: ctx.height * 0.5, timestamp: Date.now() },
      { kind: 'drag', x: ctx.width * 0.56, y: ctx.height * 0.48, dx: ctx.width * 0.18, dy: -ctx.height * 0.08, timestamp: Date.now() },
    ]);
  }
}
