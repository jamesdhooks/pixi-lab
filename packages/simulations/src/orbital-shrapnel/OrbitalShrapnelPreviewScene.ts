import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { OrbitalShrapnelScene, orbitalShrapnelStyleManifest } from './OrbitalShrapnelScene.js';

export class OrbitalShrapnelPreviewScene extends OrbitalShrapnelScene {
  override readonly name = 'OrbitalShrapnelPreview';

  constructor() {
    super(24, 96);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const styles = orbitalShrapnelStyleManifest.styles;
    this.setStyle(styles[Math.floor(Math.random() * styles.length)].id);
    const now = Date.now();
    this.pushGestures([
      { kind: 'hold', x: ctx.width * 0.72, y: ctx.height * 0.55, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.5, y: ctx.height * 0.45, dx: 70, dy: -22, timestamp: now + 1 },
      { kind: 'fast_swipe', x: ctx.width * 0.42, y: ctx.height * 0.52, dx: 150, dy: 18, velocity: 1.9, timestamp: now + 2 },
    ]);
  }
}
