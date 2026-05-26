import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { PlasmaBranchScene, plasmaBranchStyleManifest } from './PlasmaBranchScene.js';

export class PlasmaBranchPreviewScene extends PlasmaBranchScene {
  override readonly name = 'PlasmaBranchPreview';

  constructor() {
    super(36, 90);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = plasmaBranchStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap', x: ctx.width * 0.5, y: ctx.height * 0.48, timestamp: now },
      { kind: 'hold', x: ctx.width * 0.68, y: ctx.height * 0.35, timestamp: now + 1 },
      { kind: 'fast_swipe', x: ctx.width * 0.38, y: ctx.height * 0.6, dx: 120, dy: -50, velocity: 2, timestamp: now + 2 },
    ]);
  }
}
