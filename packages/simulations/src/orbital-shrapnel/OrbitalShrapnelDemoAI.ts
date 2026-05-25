import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

export class OrbitalShrapnelDemoAI implements SimulationAI {
  private nextGestureIn = 0.25;

  reset(): void {
    this.nextGestureIn = 0.25;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.nextGestureIn -= ctx.dt;
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.75 + Math.random() * 1.4;
    const x = ctx.width * (0.22 + Math.random() * 0.56);
    const y = ctx.height * (0.22 + Math.random() * 0.56);
    const roll = Math.random();
    if (roll < 0.18) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.62) return [{ kind: 'drag', x, y, dx: -140 + Math.random() * 280, dy: -70 + Math.random() * 140, timestamp: Date.now() }];
    if (roll < 0.82) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -260 + Math.random() * 520, dy: -40 + Math.random() * 80, velocity: 2.1, timestamp: Date.now() }];
  }
}
