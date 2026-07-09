import type { AIContext, AIController, Intent } from '@hooksjam/pixi-lab-core';

export class ColorPitAI implements AIController {
  private elapsed = 0;
  private resetElapsed = 0;
  private nextIntentIn = 0.25;
  private readonly pointerId = -2001;

  think(ctx: AIContext): Intent[] {
    this.elapsed += ctx.dt;
    this.resetElapsed += ctx.dt;
    if (this.resetElapsed >= 10) {
      this.resetElapsed = 0;
      this.elapsed = 0;
      return [{ kind: 'tap', id: this.pointerId, x: ctx.width * 0.5, y: ctx.height * 0.12, meta: { resetScene: true } }];
    }
    if (this.elapsed < this.nextIntentIn) return [];
    this.elapsed = 0;
    this.nextIntentIn = 0.35 + Math.random() * 0.45;
    const wave = Math.sin(performance.now() / 700) * 0.36;
    return [{ kind: 'tap', id: this.pointerId, x: ctx.width * (0.5 + wave), y: ctx.height * 0.45 }];
  }

  reset(): void { this.elapsed = 0; this.resetElapsed = 0; this.nextIntentIn = 0.25; }
}
