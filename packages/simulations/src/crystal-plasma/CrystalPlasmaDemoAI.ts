import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

export class CrystalPlasmaDemoAI implements SimulationAI {
  private nextGestureIn = 0.25;

  reset(): void {
    this.nextGestureIn = 0.25;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.nextGestureIn -= ctx.dt;
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.7 + Math.random() * 1.35;
    const x = ctx.width * (0.16 + Math.random() * 0.68);
    const y = ctx.height * (0.15 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.3) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.52) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.76) return [{ kind: 'drag', x, y, dx: -80 + Math.random() * 160, dy: -80 + Math.random() * 160, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -240 + Math.random() * 480, dy: -160 + Math.random() * 320, velocity: 2.4, timestamp: Date.now() }];
  }
}
