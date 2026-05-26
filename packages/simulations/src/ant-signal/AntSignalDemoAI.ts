import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

export class AntSignalDemoAI implements SimulationAI {
  private nextGestureIn = 0.25;

  reset(): void {
    this.nextGestureIn = 0.25;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.nextGestureIn -= ctx.dt;
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.7 + Math.random() * 1.6;
    const x = ctx.width * (0.16 + Math.random() * 0.68);
    const y = ctx.height * (0.16 + Math.random() * 0.68);
    const roll = Math.random();
    if (roll < 0.32) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.52) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.84) return [{ kind: 'drag', x, y, dx: -120 + Math.random() * 240, dy: -90 + Math.random() * 180, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -220 + Math.random() * 440, dy: -140 + Math.random() * 280, velocity: 2.1, timestamp: Date.now() }];
  }
}
