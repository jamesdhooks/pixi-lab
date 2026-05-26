import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [64, 96, 0.45, 0.72, 0.28],
  [96, 160, 0.9, 1.0, 0.18],
  [128, 224, 1.35, 1.45, 0.12],
  [80, 128, 1.9, 0.82, 0.42],
  [160, 300, 0.72, 1.85, 0.08],
];

export class AlienVascularTreeDemoAI implements SimulationAI {
  private nextGestureIn = 0.15;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.15;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.28 + Math.random() * 0.8;
    const x = ctx.width * (0.14 + Math.random() * 0.72);
    const y = ctx.height * (0.12 + Math.random() * 0.74);
    const roll = Math.random();
    if (roll < 0.26) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.42) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'drag', x, y, dx: -260 + Math.random() * 520, dy: -180 + Math.random() * 360, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, branchBudget, growthRate, nutrientFlow, pruneRate] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('branchBudget', branchBudget);
    ctx.applyNumericSetting('growthRate', growthRate);
    ctx.applyNumericSetting('nutrientFlow', nutrientFlow);
    ctx.applyNumericSetting('pruneRate', pruneRate);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
