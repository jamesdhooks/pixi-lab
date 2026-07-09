import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { RawSparksScene } from './RawSparksScene.js';

export class SparksPreviewScene extends RawSparksScene {
  override onEnter(ctx: GameContext, input: Input): void {
    ctx.systems.settings.set('rawParticleTextureSize', '128');
    ctx.systems.settings.set('emissionRate', 520);
    ctx.systems.settings.set('sparkPower', 320);
    ctx.systems.settings.set('renderStyle', 'enhanced');
    ctx.systems.settings.set('bloomStrength', 1.65);
    ctx.systems.settings.set('trailFade', 0.86);
    super.onEnter(ctx, input);
    this.setMode('welding');
    this.pushGestures([
      { kind: 'drag', id: -7601, x: ctx.width * 0.42, y: ctx.height * 0.58, dx: 24, dy: -4, strength: 1, timestamp: Date.now() },
      { kind: 'drag', id: -7601, x: ctx.width * 0.54, y: ctx.height * 0.6, dx: 32, dy: 6, strength: 1, timestamp: Date.now() + 1 },
    ]);
  }
}
