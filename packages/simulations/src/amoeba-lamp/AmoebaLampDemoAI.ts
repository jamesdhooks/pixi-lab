import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

export class AmoebaLampDemoAI implements SimulationAI {
  private nextGestureIn = 0.3;

  reset(): void {
    this.nextGestureIn = 0.3;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.nextGestureIn -= ctx.dt;
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.65 + Math.random() * 1.15;
    const x = ctx.width * (0.18 + Math.random() * 0.64);
    const y = ctx.height * (0.18 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.22) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.58) return [{ kind: 'drag', x, y, dx: -70 + Math.random() * 140, dy: -40 + Math.random() * 80, timestamp: Date.now() }];
    if (roll < 0.82) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -160 + Math.random() * 320, dy: -30 + Math.random() * 60, velocity: 1.8, timestamp: Date.now() }];
  }
}
