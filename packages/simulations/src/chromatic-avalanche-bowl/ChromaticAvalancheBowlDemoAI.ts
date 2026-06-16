import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number]> = [
  [64, 260, 0.28, 0.18, 0.42, 0.55],
  [96, 520, 0.58, 0.32, 0.64, 0.82],
  [128, 820, 0.86, 0.22, 0.92, 1.18],
  [80, 420, 1.02, 0.58, 0.28, 1.48],
  [160, 980, 0.42, 0.12, 1.08, 0.72],
];

export class ChromaticAvalancheBowlDemoAI implements SimulationAI {
  private nextGestureIn = 0.18;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.18;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.28 + Math.random() * 0.72;
    const x = ctx.width * (0.18 + Math.random() * 0.64);
    const y = ctx.height * (0.1 + Math.random() * 0.68);
    const roll = Math.random();
    if (roll < 0.32) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.5) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.86) return [{ kind: 'drag', x, y, dx: -260 + Math.random() * 520, dy: 80 + Math.random() * 260, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -680 + Math.random() * 1360, dy: -180 + Math.random() * 620, velocity: 3.7, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, grainCount, slopeAngle, friction, chromaMix, pourRate] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('grainCount', grainCount);
    ctx.applyNumericSetting('slopeAngle', slopeAngle);
    ctx.applyNumericSetting('friction', friction);
    ctx.applyNumericSetting('chromaMix', chromaMix);
    ctx.applyNumericSetting('pourRate', pourRate);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
