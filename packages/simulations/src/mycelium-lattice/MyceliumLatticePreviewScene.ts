import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { MyceliumLatticeScene, myceliumLatticeStyleManifest } from './MyceliumLatticeScene.js';

export class MyceliumLatticePreviewScene extends MyceliumLatticeScene {
  override readonly name = 'MyceliumLatticePreview';

  constructor() {
    super(28, 0.18);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = myceliumLatticeStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap',  x: ctx.width * 0.30, y: ctx.height * 0.35, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.65, y: ctx.height * 0.45, dx: 20, dy: -8, timestamp: now + 1 },
    ]);
  }
}
