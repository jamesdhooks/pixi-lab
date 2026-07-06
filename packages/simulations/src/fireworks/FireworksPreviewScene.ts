import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { RawFireworksScene } from './RawFireworksScene.js';

export class FireworksPreviewScene extends RawFireworksScene {
  override onEnter(ctx: GameContext, input: Input): void {
    ctx.systems.settings.set('rawParticleTextureSize', '128');
    ctx.systems.settings.set('burstParticles', 128);
    ctx.systems.settings.set('secondaryChance', 0.34);
    ctx.systems.settings.set('secondaryDepth', 1);
    ctx.systems.settings.set('trailFade', 0.88);
    ctx.systems.settings.set('bloomStrength', 1.35);
    super.onEnter(ctx, input);
    this.setMode('stream');
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap', id: -4101, x: ctx.width * 0.34, y: ctx.height * 0.32, timestamp: now },
      { kind: 'double_tap', id: -4102, x: ctx.width * 0.62, y: ctx.height * 0.25, timestamp: now + 1 },
    ]);
  }
}
