import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number]> = [
  [64, 48, 0.55, 0.62, 0.75, 0.18],
  [96, 72, 0.95, 0.9, 1.05, 0.34],
  [128, 112, 1.35, 1.2, 1.45, 0.52],
  [80, 156, 1.85, 0.42, 1.8, 0.22],
  [160, 188, 0.7, 1.55, 0.95, 0.72],
];

export class LivingVoronoiTissueDemoAI implements SimulationAI {
  private nextGestureIn = 0.12;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.12;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.22 + Math.random() * 0.68;
    const x = ctx.width * (0.12 + Math.random() * 0.76);
    const y = ctx.height * (0.14 + Math.random() * 0.72);
    const roll = Math.random();
    if (roll < 0.3) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.48) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    const angle = Math.random() * Math.PI * 2;
    const length = 110 + Math.random() * 360;
    const kind = roll > 0.82 ? 'fast_swipe' : 'drag';
    return [{ kind, x, y, dx: Math.cos(angle) * length, dy: Math.sin(angle) * length, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, cellCount, migrationRate, membraneTension, signalStrength, divisionRate] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('cellCount', cellCount);
    ctx.applyNumericSetting('migrationRate', migrationRate);
    ctx.applyNumericSetting('membraneTension', membraneTension);
    ctx.applyNumericSetting('signalStrength', signalStrength);
    ctx.applyNumericSetting('divisionRate', divisionRate);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
