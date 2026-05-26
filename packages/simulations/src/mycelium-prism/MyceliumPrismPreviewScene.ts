import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { MyceliumPrismScene, myceliumPrismStyleManifest } from './MyceliumPrismScene.js';

export class MyceliumPrismPreviewScene extends MyceliumPrismScene {
  override readonly name = 'MyceliumPrismPreview';

  constructor() {
    super(24);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = myceliumPrismStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap', x: ctx.width * 0.28, y: ctx.height * 0.32, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.62, y: ctx.height * 0.42, dx: 25, dy: -10, timestamp: now + 1 },
      { kind: 'hold', x: ctx.width * 0.48, y: ctx.height * 0.68, timestamp: now + 2 },
    ]);
  }
}
