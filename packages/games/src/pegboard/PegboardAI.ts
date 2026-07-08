import type { AIContext, AIController, Intent } from '@hooksjam/pixi-lab-core';

export class PegboardAI implements AIController {
  private elapsed = 0;
  private resetElapsed = 0;
  private nextDropIn = 0.35;
  private readonly pointerId = -1001;

  think(ctx: AIContext): Intent[] {
    this.elapsed += ctx.dt;
    this.resetElapsed += ctx.dt;
    if (this.resetElapsed >= 8) {
      this.resetElapsed = 0;
      this.elapsed = 0;
      return [{ kind: 'tap', id: this.pointerId, x: ctx.width * 0.5, y: ctx.height * 0.1, meta: { resetScene: true } }];
    }
    if (this.elapsed < this.nextDropIn) return [];
    this.elapsed = 0;
    this.nextDropIn = 0.55 + Math.random() * 0.8;
    const wave = Math.sin(performance.now() / 850) * 0.36;
    const x = ctx.width * (0.5 + wave + (Math.random() - 0.5) * 0.18);
    return [{ kind: 'tap', id: this.pointerId, x, y: ctx.height * 0.1 }];
  }

  reset(): void {
    this.elapsed = 0;
    this.resetElapsed = 0;
    this.nextDropIn = 0.35;
  }
}
