/**
 * components/games/ballpit/BallPitAI.ts
 *
 * Ball Pit-specific AI — extends BasicAI with biased tap bursts at the top.
 */
import { BasicAI } from '@hooksjam/pixi-lab-core';
import type { AIContext } from '@hooksjam/pixi-lab-core';
import type { Intent } from '@hooksjam/pixi-lab-core';

export class BallPitAI extends BasicAI {
  think(ctx: AIContext): Intent[] {
    const base = super.think(ctx);

    // Extra: 20% chance to drop a burst at the top third
    if (Math.random() < 0.2) {
      const x = Math.random() * ctx.width;
      const y = Math.random() * (ctx.height / 3);
      base.push({ kind: 'tap', x, y });
    }

    return base;
  }
}
