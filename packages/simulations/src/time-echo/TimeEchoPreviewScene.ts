import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { TimeEchoScene, timeEchoStyleManifest } from './TimeEchoScene.js';

export class TimeEchoPreviewScene extends TimeEchoScene {
  override readonly name = 'TimeEchoPreview';

  constructor() {
    super(40, 140, 24);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = timeEchoStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap', x: ctx.width * 0.32, y: ctx.height * 0.46, timestamp: now },
      { kind: 'hold', x: ctx.width * 0.66, y: ctx.height * 0.52, timestamp: now + 1 },
      { kind: 'drag', x: ctx.width * 0.5, y: ctx.height * 0.48, dx: 120, dy: -45, timestamp: now + 2 },
    ]);
  }
}
