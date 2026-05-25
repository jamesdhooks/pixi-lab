import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { AmoebaLampScene, amoebaLampStyleManifest } from './AmoebaLampScene.js';

export class AmoebaLampPreviewScene extends AmoebaLampScene {
  override readonly name = 'AmoebaLampPreview';

  constructor() {
    super(32, 28);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = amoebaLampStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'hold', x: ctx.width * 0.45, y: ctx.height * 0.72, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.55, y: ctx.height * 0.46, dx: 35, dy: -18, timestamp: now + 1 },
      { kind: 'fast_swipe', x: ctx.width * 0.52, y: ctx.height * 0.5, dx: 90, dy: 0, velocity: 1.6, timestamp: now + 2 },
    ]);
  }
}
