/**
 * packages/core/src/ai/DemoAI.ts
 *
 * Screensaver / demo mode AI. Slower cadence, biased toward visually
 * interesting actions: big bursts, long drags, gravity sweeps.
 */
import { BasicAI } from './BasicAI';
import type { AIContext } from './AIController';
import type { Intent } from '../types';

export class DemoAI extends BasicAI {
  constructor() {
    super();
    // Slower, more deliberate
    this.minInterval = 1.0;
    this.maxInterval = 3.5;
    this.nextInterval = 2.0;

    // Favour drags — more visually interesting
    this.actions = [
      { kind: 'tap', weight: 0.25 },
      { kind: 'drag', weight: 0.65 },
      { kind: 'hold_release', weight: 0.1 },
    ];
  }

  override think(ctx: AIContext): Intent[] {
    const intents = super.think(ctx);
    // Add a second tap burst at low probability for ambient chaos
    if (Math.random() < 0.08) {
      intents.push({
        kind: 'tap',
        x: Math.random() * ctx.width,
        y: Math.random() * ctx.height * 0.5, // top half
      });
    }
    return intents;
  }
}
