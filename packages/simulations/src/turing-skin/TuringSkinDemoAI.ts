import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [64, 0.036, 0.058, 0.92, 0.42],
  [96, 0.046, 0.061, 1, 0.5],
  [128, 0.054, 0.064, 1.1, 0.58],
  [80, 0.026, 0.052, 0.78, 0.32],
  [160, 0.068, 0.071, 1.18, 0.66],
];

export class TuringSkinDemoAI implements SimulationAI {
  private nextGestureIn = 0.25;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }
  reset(): void { this.nextGestureIn = 0.25; this.elapsedSinceOverhaul = 0; this.nextOverhaulIn = 0; }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.45 + Math.random() * 0.9;
    const x = ctx.width * (0.12 + Math.random() * 0.76);
    const y = ctx.height * (0.14 + Math.random() * 0.72);
    const roll = Math.random();
    if (roll < 0.4) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.62) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.9) return [{ kind: 'drag', x, y, dx: -180 + Math.random() * 360, dy: -140 + Math.random() * 280, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -460 + Math.random() * 920, dy: -320 + Math.random() * 640, velocity: 3.2, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, feedRate, killRate, diffusionA, diffusionB] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('feedRate', feedRate);
    ctx.applyNumericSetting('killRate', killRate);
    ctx.applyNumericSetting('diffusionA', diffusionA);
    ctx.applyNumericSetting('diffusionB', diffusionB);
    ctx.applyNumericSetting('brushStrength', 0.45 + Math.random() * 1.15);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
