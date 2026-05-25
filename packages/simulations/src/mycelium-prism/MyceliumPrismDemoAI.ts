import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

export class MyceliumPrismDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextGestureIn = 0.4;

  reset(): void {
    this.elapsed = 0;
    this.nextGestureIn = 0.4;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsed += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.75 + Math.random() * 1.4;
    const x = ctx.width * (0.15 + Math.random() * 0.7);
    const y = ctx.height * (0.15 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.42) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.84) return [{ kind: 'drag', x, y, dx: -30 + Math.random() * 60, dy: -30 + Math.random() * 60, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -90 + Math.random() * 180, dy: -90 + Math.random() * 180, velocity: 1.2, timestamp: Date.now() }];
  }
}
