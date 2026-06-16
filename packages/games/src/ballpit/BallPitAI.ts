/**
 * components/games/ballpit/BallPitAI.ts
 *
 * Ball Pit-specific AI — extends BasicAI with biased tap bursts at the top.
 */
import { BasicAI } from '@hooksjam/pixi-lab-core';
import type { AIContext } from '@hooksjam/pixi-lab-core';
import type { Intent } from '@hooksjam/pixi-lab-core';

export class BallPitAI extends BasicAI {
  private extraDropCooldown = 0;

  think(ctx: AIContext): Intent[] {
    const base = super.think(ctx);
    this.extraDropCooldown -= ctx.dt;

    // Extra: occasional top-third drops. Keep this time-based, not frame-based,
    // so AI load does not scale up with faster rAF loops.
    if (this.extraDropCooldown <= 0) {
      this.extraDropCooldown = 0.25 + Math.random() * 0.4;
      if (Math.random() < 0.2) {
        const x = Math.random() * ctx.width;
        const y = Math.random() * (ctx.height / 3);
        base.push({ kind: 'tap', x, y });
      }
    }

    return base;
  }

  override reset() {
    super.reset();
    this.extraDropCooldown = 0;
  }
}
