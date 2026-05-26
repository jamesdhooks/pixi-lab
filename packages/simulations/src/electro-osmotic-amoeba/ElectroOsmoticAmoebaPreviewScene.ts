import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { ElectroOsmoticAmoebaScene, electroOsmoticAmoebaStyleManifest } from './ElectroOsmoticAmoebaScene.js';

export class ElectroOsmoticAmoebaPreviewScene extends ElectroOsmoticAmoebaScene {
  override readonly name = 'ElectroOsmoticAmoebaPreview';

  constructor() {
    super(40, 42);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = electroOsmoticAmoebaStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'hold', x: ctx.width * 0.48, y: ctx.height * 0.48, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.55, y: ctx.height * 0.42, dx: 48, dy: -12, timestamp: now + 1 },
      { kind: 'fast_swipe', x: ctx.width * 0.52, y: ctx.height * 0.55, dx: 110, dy: 20, velocity: 1.8, timestamp: now + 2 },
    ]);
  }
}
