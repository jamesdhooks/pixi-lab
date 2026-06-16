import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number]> = [
  [64, 140, 3, 0.55, -0.8, 0.36],
  [96, 260, 4, 0.9, 0.35, 0.62],
  [128, 420, 5, 1.25, 0.85, 0.92],
  [160, 620, 7, 1.65, -1.15, 1.24],
  [192, 760, 8, 2.05, 1.3, 1.55],
];

export class ProtoGalaxyForgeDemoAI implements SimulationAI {
  private nextGestureIn = 0.16;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.16;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.18 + Math.random() * 0.72;
    const x = ctx.width * (0.1 + Math.random() * 0.8);
    const y = ctx.height * (0.12 + Math.random() * 0.76);
    const roll = Math.random();
    if (roll < 0.34) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.5) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    const angle = Math.random() * Math.PI * 2;
    const length = 140 + Math.random() * 420;
    const kind = roll > 0.82 ? 'fast_swipe' : 'drag';
    return [{ kind, x, y, dx: Math.cos(angle) * length, dy: Math.sin(angle) * length, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, particleCount, wellCount, gravityStrength, spinBias, fusionRate] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('particleCount', particleCount);
    ctx.applyNumericSetting('wellCount', wellCount);
    ctx.applyNumericSetting('gravityStrength', gravityStrength);
    ctx.applyNumericSetting('spinBias', spinBias);
    ctx.applyNumericSetting('fusionRate', fusionRate);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
