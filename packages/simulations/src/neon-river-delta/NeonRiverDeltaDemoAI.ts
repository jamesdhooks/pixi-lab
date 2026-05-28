import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [64, 0.28, 0.22, 0.55, 0.62],
  [96, 0.72, 0.46, 0.9, 1.0],
  [128, 1.15, 0.82, 1.25, 1.48],
  [80, 1.55, 0.34, 1.55, 0.86],
  [160, 0.52, 1.05, 1.08, 2.05],
];

export class NeonRiverDeltaDemoAI implements SimulationAI {
  private nextGestureIn = 0.2;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.2;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.35 + Math.random() * 0.85;
    const x = ctx.width * (0.12 + Math.random() * 0.76);
    const y = ctx.height * (0.08 + Math.random() * 0.84);
    const roll = Math.random();
    if (roll < 0.28) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.42) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.88) return [{ kind: 'drag', x, y, dx: -220 + Math.random() * 440, dy: 120 + Math.random() * 420, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -520 + Math.random() * 1040, dy: 240 + Math.random() * 620, velocity: 3.4, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, rainfall, erosionRate, sedimentGlow, flowSpeed] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('rainfall', rainfall);
    ctx.applyNumericSetting('erosionRate', erosionRate);
    ctx.applyNumericSetting('sedimentGlow', sedimentGlow);
    ctx.applyNumericSetting('flowSpeed', flowSpeed);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
