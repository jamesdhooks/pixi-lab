import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [64, 0.32, 0.1, 0.16, 0.65],
  [96, 0.72, 0.24, 0.26, 0.95],
  [128, 1.05, 0.38, 0.42, 1.2],
  [80, 0.48, 0.55, 0.18, 1.55],
  [160, 1.28, 0.18, 0.62, 0.82],
];

export class OilWaterUniverseDemoAI implements SimulationAI {
  private nextGestureIn = 0.22;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.22;
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
    const y = ctx.height * (0.14 + Math.random() * 0.72);
    const roll = Math.random();
    if (roll < 0.34) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.54) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.88) return [{ kind: 'drag', x, y, dx: -220 + Math.random() * 440, dy: -180 + Math.random() * 360, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -560 + Math.random() * 1120, dy: -420 + Math.random() * 840, velocity: 3.4, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, separationRate, boundaryTension, viscosity, stirStrength] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('separationRate', separationRate);
    ctx.applyNumericSetting('boundaryTension', boundaryTension);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('stirStrength', stirStrength);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
