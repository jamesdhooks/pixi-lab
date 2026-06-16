import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [64, 0.42, 0.45, 0.62, 0.18],
  [96, 0.92, 0.82, 1.05, 0.12],
  [128, 1.35, 1.18, 1.55, 0.08],
  [80, 1.9, 0.72, 1.95, 0.2],
  [160, 0.68, 1.55, 1.28, 0.06],
];

export class PrismPoolDemoAI implements SimulationAI {
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
    this.nextGestureIn = 0.28 + Math.random() * 0.74;
    const x = ctx.width * (0.1 + Math.random() * 0.8);
    const y = ctx.height * (0.12 + Math.random() * 0.76);
    const roll = Math.random();
    if (roll < 0.34) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.5) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.88) return [{ kind: 'drag', x, y, dx: -260 + Math.random() * 520, dy: -180 + Math.random() * 360, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -640 + Math.random() * 1280, dy: -460 + Math.random() * 920, velocity: 3.6, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [resolution, waveSpeed, refractionStrength, causticIntensity, damping] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('waveSpeed', waveSpeed);
    ctx.applyNumericSetting('refractionStrength', refractionStrength);
    ctx.applyNumericSetting('causticIntensity', causticIntensity);
    ctx.applyNumericSetting('damping', damping);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
