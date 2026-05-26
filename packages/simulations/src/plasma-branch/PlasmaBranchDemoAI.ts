import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

export class PlasmaBranchDemoAI implements SimulationAI {
  private nextGestureIn = 0.2;

  reset(): void {
    this.nextGestureIn = 0.2;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.nextGestureIn -= ctx.dt;
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.55 + Math.random() * 1.25;
    const x = ctx.width * (0.18 + Math.random() * 0.64);
    const y = ctx.height * (0.16 + Math.random() * 0.68);
    const roll = Math.random();
    if (roll < 0.28) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.48) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.72) return [{ kind: 'drag', x, y, dx: -90 + Math.random() * 180, dy: -70 + Math.random() * 140, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -220 + Math.random() * 440, dy: -120 + Math.random() * 240, velocity: 2.2, timestamp: Date.now() }];
  }
}
