import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { JellyWebScene, jellyWebStyleManifest } from './JellyWebScene.js';

export class JellyWebPreviewScene extends JellyWebScene {
  override readonly name = 'JellyWebPreview';

  constructor() {
    super(40, 3, 10);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = jellyWebStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap', x: ctx.width * 0.5, y: ctx.height * 0.45, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.52, y: ctx.height * 0.48, dx: 54, dy: -24, timestamp: now + 1 },
      { kind: 'hold', x: ctx.width * 0.42, y: ctx.height * 0.55, timestamp: now + 2 },
    ]);
  }
}
